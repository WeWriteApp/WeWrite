import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  Timestamp,
  type Unsubscribe,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';

import { BotDetectionService, type VisitorFingerprint } from './BotDetectionService';

interface VisitorSession {
  id: string;
  fingerprint: VisitorFingerprint;
  userId?: string;
  isAuthenticated: boolean;
  isBot: boolean;
  botConfidence: number;
  botCategory?: string;
  startTime: Timestamp;
  lastSeen: Timestamp;
  pageViews: number;
  userAgent: string;
  ipHash?: string;
  sessionDuration: number;
  interactions: {
    mouseMovements: number;
    clicks: number;
    scrollEvents: number;
    keystrokes: number;
  };
}

/**
 * Enterprise-grade visitor tracking service with comprehensive bot detection
 * and accurate session management for business-critical analytics
 */
class VisitorTrackingService {
  private activeSubscriptions: Map<string, Unsubscribe>;
  private currentSession: VisitorSession | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  private interactionTracking: boolean = false;
  private sessionStartTime: number = 0;

  // Session management constants
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private static readonly HEARTBEAT_INTERVAL = 15 * 1000; // 15 seconds
  private static readonly INTERACTION_DEBOUNCE = 1000; // 1 second

  constructor() {
    this.activeSubscriptions = new Map();
    this.setupInteractionTracking();
  }

  /**
   * Generate a unique session ID combining timestamp and fingerprint
   */
  private generateSessionId(fingerprint: VisitorFingerprint): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const fpHash = fingerprint.id.substr(-8); // Last 8 chars of fingerprint
    return `session_${timestamp}_${fpHash}_${random}`;
  }

  /**
   * Setup interaction tracking for bot detection
   */
  private setupInteractionTracking(): void {
    if (typeof window === 'undefined' || this.interactionTracking) return;

    let mouseMovements = 0;
    let clicks = 0;
    let scrollEvents = 0;
    let keystrokes = 0;

    // Debounced interaction tracking
    let interactionTimeout: NodeJS.Timeout | null = null;

    const updateInteractions = () => {
      if (this.currentSession) {
        // Ensure interactions object exists
        if (!this.currentSession.interactions) {
          this.currentSession.interactions = {
            mouseMovements: 0,
            clicks: 0,
            scrollEvents: 0,
            keystrokes: 0
          };
        }

        this.currentSession.interactions = {
          mouseMovements,
          clicks,
          scrollEvents,
          keystrokes
        };
      }
    };

    const debouncedUpdate = () => {
      if (interactionTimeout) clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(updateInteractions, VisitorTrackingService.INTERACTION_DEBOUNCE);
    };

    // Mouse movement tracking
    document.addEventListener('mousemove', () => {
      mouseMovements++;
      debouncedUpdate();
    }, { passive: true });

    // Click tracking
    document.addEventListener('click', () => {
      clicks++;
      debouncedUpdate();
    }, { passive: true });

    // Scroll tracking
    document.addEventListener('scroll', () => {
      scrollEvents++;
      debouncedUpdate();
    }, { passive: true });

    // Keystroke tracking
    document.addEventListener('keydown', () => {
      keystrokes++;
      debouncedUpdate();
    }, { passive: true });

    this.interactionTracking = true;
  }

  /**
   * Track a visitor with comprehensive bot detection and session management
   * @param userId - Optional authenticated user ID
   * @param isAuthenticated - Whether the visitor is authenticated
   */
  async trackVisitor(userId?: string, isAuthenticated: boolean = false): Promise<void> {
    try {
      // Check if already tracking this session
      if (this.isTracking && this.currentSession) {
        // Update authentication status if changed
        if (this.currentSession.isAuthenticated !== isAuthenticated || this.currentSession.userId !== userId) {
          await this.updateSessionAuth(userId, isAuthenticated);
        }
        return;
      }

      // Generate browser fingerprint
      const fingerprint = BotDetectionService.generateFingerprint();

      // Perform bot detection
      const botDetection = BotDetectionService.detectBot(fingerprint.userAgent, fingerprint);

      // Skip tracking if high-confidence bot (unless it's a legitimate search engine)
      if (botDetection.isBot && botDetection.confidence > 0.8 && botDetection.category !== 'search_engine') {
        console.log('🤖 Bot detected, skipping tracking:', {
          confidence: botDetection.confidence,
          category: botDetection.category,
          reasons: botDetection.reasons
        });
        return;
      }

      // Check for existing session with same fingerprint (prevent duplicates)
      const existingSession = await this.findExistingSession(fingerprint.id, userId);
      if (existingSession) {
        console.log('📱 Resuming existing session:', existingSession.id);
        this.currentSession = existingSession;
        this.isTracking = true;
        this.sessionStartTime = Date.now();
        this.setupHeartbeat();
        return;
      }

      // Create new session
      const sessionId = this.generateSessionId(fingerprint);
      this.sessionStartTime = Date.now();

      this.currentSession = {
        id: sessionId,
        fingerprint,
        userId,
        isAuthenticated,
        isBot: botDetection.isBot || false,
        botConfidence: botDetection.confidence || 0,
        botCategory: botDetection.category || 'unknown',
        startTime: Timestamp.now(),
        lastSeen: Timestamp.now(),
        pageViews: 1,
        userAgent: fingerprint.userAgent,
        sessionDuration: 0,
        interactions: {
          mouseMovements: 0,
          clicks: 0,
          scrollEvents: 0,
          keystrokes: 0
        }
      };

      // Store session in Firestore
      const sessionRef = doc(db, 'siteVisitors', sessionId);
      await setDoc(sessionRef, {
        ...this.currentSession,
        startTime: this.currentSession.startTime,
        lastSeen: this.currentSession.lastSeen
      });

      this.isTracking = true;
      this.setupHeartbeat();

      console.log('✅ New visitor session started:', {
        sessionId,
        isBot: botDetection.isBot,
        confidence: botDetection.confidence,
        category: botDetection.category
      });

    } catch (error) {
      // Handle permission denied errors gracefully - this is expected for private data
      if (error?.code === 'permission-denied') {
        console.log('Permission denied tracking visitor - this is expected for private data');
      } else {
        console.error('Error tracking visitor:', error);
      }
      this.isTracking = false;
    }
  }

  /**
   * Find existing session for the same fingerprint/user to prevent duplicates
   */
  private async findExistingSession(fingerprintId: string, userId?: string): Promise<VisitorSession | null> {
    try {
      const now = new Date();
      const sessionTimeout = new Date(now.getTime() - VisitorTrackingService.SESSION_TIMEOUT);

      const visitorsRef = collection(db, 'siteVisitors');
      let q;

      if (userId) {
        // For authenticated users, check by userId
        q = query(
          visitorsRef,
          where('userId', '==', userId),
          where('lastSeen', '>=', Timestamp.fromDate(sessionTimeout))
        );
      } else {
        // For anonymous users, check by fingerprint
        q = query(
          visitorsRef,
          where('fingerprint.id', '==', fingerprintId),
          where('lastSeen', '>=', Timestamp.fromDate(sessionTimeout))
        );
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as VisitorSession;
      }

      return null;
    } catch (error) {
      // Handle permission denied errors gracefully - this is expected for private data
      if (error?.code === 'permission-denied') {
        console.log('Permission denied finding existing session - this is expected for private data');
      } else {
        console.error('Error finding existing session:', error);
      }
      return null;
    }
  }

  /**
   * Update session authentication status
   */
  private async updateSessionAuth(userId?: string, isAuthenticated: boolean = false): Promise<void> {
    if (!this.currentSession) return;

    try {
      this.currentSession.userId = userId;
      this.currentSession.isAuthenticated = isAuthenticated;

      const sessionRef = doc(db, 'siteVisitors', this.currentSession.id);
      await updateDoc(sessionRef, {
        userId: userId || null,
        isAuthenticated,
        lastSeen: Timestamp.now()
      });

      console.log('🔄 Session authentication updated:', { userId, isAuthenticated });
    } catch (error) {
      console.error('Error updating session auth:', error);
    }
  }

  /**
   * Enhanced heartbeat with interaction validation and bot behavior analysis
   */
  private setupHeartbeat(): void {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (!this.currentSession) return;

      try {
        // Update session duration
        this.currentSession.sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        this.currentSession.lastSeen = Timestamp.now();

        // Ensure interactions object exists
        if (!this.currentSession.interactions) {
          this.currentSession.interactions = {
            mouseMovements: 0,
            clicks: 0,
            scrollEvents: 0,
            keystrokes: 0
          };
        }

        // Validate visitor behavior for additional bot detection
        const behaviorValidation = BotDetectionService.validateVisitorBehavior({
          pageViews: this.currentSession.pageViews,
          sessionDuration: this.currentSession.sessionDuration,
          mouseMovements: this.currentSession.interactions?.mouseMovements || 0,
          clicks: this.currentSession.interactions?.clicks || 0,
          scrollEvents: this.currentSession.interactions?.scrollEvents || 0,
          keystrokes: this.currentSession.interactions?.keystrokes || 0
        });

        // Update bot status if suspicious behavior detected
        if (behaviorValidation.isSuspicious && !this.currentSession.isBot) {
          this.currentSession.isBot = true;
          this.currentSession.botConfidence = Math.max(this.currentSession.botConfidence, 0.8);
          this.currentSession.botCategory = 'suspicious';

          console.log('🚨 Suspicious behavior detected:', behaviorValidation.reasons);
        }

        // Update session in Firestore
        const sessionRef = doc(db, 'siteVisitors', this.currentSession.id);
        await updateDoc(sessionRef, {
          lastSeen: this.currentSession.lastSeen,
          sessionDuration: this.currentSession.sessionDuration,
          interactions: this.currentSession.interactions,
          isBot: this.currentSession.isBot || false,
          botConfidence: this.currentSession.botConfidence || 0,
          botCategory: this.currentSession.botCategory || 'unknown'
        });

      } catch (error) {
        console.error('Error updating visitor heartbeat:', error);
      }
    }, VisitorTrackingService.HEARTBEAT_INTERVAL);
  }

  /**
   * Subscribe to live visitor count with bot filtering
   */
  subscribeToVisitorCount(callback: (counts: {
    total: number;
    authenticated: number;
    anonymous: number;
    bots: number;
    legitimateVisitors: number;
  }) => void): Unsubscribe | null {
    try {
      // Query active visitors from the last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const visitorsRef = collection(db, 'siteVisitors');
      const q = query(
        visitorsRef,
        where('lastSeen', '>=', Timestamp.fromDate(tenMinutesAgo))
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let total = 0;
        let authenticated = 0;
        let anonymous = 0;
        let bots = 0;
        let legitimateVisitors = 0;

        snapshot.forEach(doc => {
          const data = doc.data() as VisitorSession;

          // Filter out high-confidence bots (except search engines for SEO)
          const isHighConfidenceBot = data.isBot &&
                                     data.botConfidence > 0.7 &&
                                     data.botCategory !== 'search_engine';

          if (isHighConfidenceBot) {
            bots++;
            return; // Skip counting bots in main metrics
          }

          // Count legitimate visitors
          legitimateVisitors++;
          total++;

          if (data.isAuthenticated) {
            authenticated++;
          } else {
            anonymous++;
          }
        });

        const counts = {
          total,
          authenticated,
          anonymous,
          bots,
          legitimateVisitors
        };

        callback(counts);
      });

      // Store the subscription for cleanup
      this.activeSubscriptions.set('visitor-counts', unsubscribe);

      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to visitor count:', error);
      return null;
    }
  }

  /**
   * Track a page view for the current session
   */
  trackPageView(pageUrl: string): void {
    if (!this.currentSession) return;

    try {
      this.currentSession.pageViews++;

      // Update page view count in Firestore
      const sessionRef = doc(db, 'siteVisitors', this.currentSession.id);
      updateDoc(sessionRef, {
        pageViews: this.currentSession.pageViews,
        lastSeen: Timestamp.now()
      });

      console.log('📄 Page view tracked:', {
        sessionId: this.currentSession.id,
        pageViews: this.currentSession.pageViews,
        url: pageUrl
      });
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }

  /**
   * Get current session information for debugging
   */
  getCurrentSession(): VisitorSession | null {
    return this.currentSession;
  }

  /**
   * Unsubscribe from visitor count updates
   */
  unsubscribeFromVisitorCount(): void {
    try {
      const unsubscribe = this.activeSubscriptions.get('visitor-counts');
      if (unsubscribe) {
        unsubscribe();
        this.activeSubscriptions.delete('visitor-counts');
      }
    } catch (error) {
      console.error('Error unsubscribing from visitor count:', error);
    }
  }

  /**
   * Clean up visitor tracking
   */
  async cleanup(): Promise<void> {
    try {
      // Clear heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Mark session as ended instead of deleting (for analytics)
      if (this.currentSession) {
        const sessionRef = doc(db, 'siteVisitors', this.currentSession.id);
        await updateDoc(sessionRef, {
          endTime: Timestamp.now(),
          sessionDuration: Math.floor((Date.now() - this.sessionStartTime) / 1000),
          active: false
        });

        console.log('📊 Session ended:', {
          sessionId: this.currentSession.id,
          duration: this.currentSession.sessionDuration,
          pageViews: this.currentSession.pageViews
        });

        this.currentSession = null;
      }

      // Clean up all subscriptions
      this.activeSubscriptions.forEach(unsubscribe => unsubscribe());
      this.activeSubscriptions.clear();

      this.isTracking = false;
    } catch (error) {
      console.error('Error cleaning up visitor tracking:', error);
    }
  }

  /**
   * Clean up stale visitors with enhanced filtering
   */
  async cleanupStaleVisitors(): Promise<void> {
    try {
      const sessionTimeout = new Date(Date.now() - VisitorTrackingService.SESSION_TIMEOUT);
      const visitorsRef = collection(db, 'siteVisitors');
      const q = query(
        visitorsRef,
        where('lastSeen', '<', Timestamp.fromDate(sessionTimeout))
      );

      const snapshot = await getDocs(q);
      let cleanedCount = 0;
      let botCount = 0;

      const updatePromises = snapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data() as VisitorSession;

        // Count bots for analytics
        if (data.isBot) {
          botCount++;
        }

        // Mark as inactive instead of deleting for data retention
        await updateDoc(docSnapshot.ref, {
          active: false,
          endTime: Timestamp.now(),
          cleanedAt: Timestamp.now()
        });

        cleanedCount++;
      });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    } catch (error) {
      console.error('Error cleaning up stale visitors:', error);
    }
  }

  /**
   * Get analytics summary for debugging and monitoring
   */
  async getAnalyticsSummary(): Promise<{
    activeSessions: number;
    totalBots: number;
    legitimateVisitors: number;
    topBotCategories: Record<string, number>;
  }> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const visitorsRef = collection(db, 'siteVisitors');
      const q = query(
        visitorsRef,
        where('lastSeen', '>=', Timestamp.fromDate(tenMinutesAgo))
      );

      const snapshot = await getDocs(q);
      let activeSessions = 0;
      let totalBots = 0;
      let legitimateVisitors = 0;
      const botCategories: Record<string, number> = {};

      snapshot.forEach(doc => {
        const data = doc.data() as VisitorSession;
        activeSessions++;

        if (data.isBot) {
          totalBots++;
          const category = data.botCategory || 'unknown';
          botCategories[category] = (botCategories[category] || 0) + 1;
        } else {
          legitimateVisitors++;
        }
      });

      return {
        activeSessions,
        totalBots,
        legitimateVisitors,
        topBotCategories: botCategories
      };
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      return {
        activeSessions: 0,
        totalBots: 0,
        legitimateVisitors: 0,
        topBotCategories: {}
      };
    }
  }
}

// Create a singleton instance
export const visitorTrackingService = new VisitorTrackingService();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    visitorTrackingService.cleanup();
  });
}
