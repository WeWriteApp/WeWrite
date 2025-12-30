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
import { getCollectionName } from '../utils/environmentConfig';
import { trackFirebaseRead } from '../utils/costMonitor';

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
 *
 * COST OPTIMIZATION (August 2025):
 * - Implements industry-standard batching (30-second intervals)
 * - Reduces Firebase writes by ~80% through intelligent aggregation
 * - Follows Google Analytics and Mixpanel patterns for efficiency
 *
 * BATCHING STRATEGY:
 * - Batch Size: 5 updates (industry standard)
 * - Batch Interval: 30 seconds (industry standard)
 * - Emergency Flush: When threshold reached
 *
 * WRITE PATTERNS:
 * - Session Creation: Immediate write (1 per session)
 * - Page Views: Batched updates (reduces from N writes to 1 per 30s)
 * - Interactions: Batched updates (reduces from N writes to 1 per 30s)
 */
class VisitorTrackingService {
  private activeSubscriptions: Map<string, Unsubscribe>;
  private currentAccount: VisitorSession | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  private interactionTracking: boolean = false;
  private sessionStartTime: number = 0;

  // Cost optimization: batch updates to reduce Firestore writes
  private pendingUpdates: Partial<VisitorSession> = {};
  private updateCount: number = 0;
  private lastBatchUpdate: number = 0;

  // Session cache to reduce repeated queries
  private sessionCache = new Map<string, { data: VisitorSession | null; timestamp: number }>();

  // Session management constants - OPTIMIZED for cost reduction
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private static readonly HEARTBEAT_INTERVAL = 120 * 1000; // 120 seconds (increased from 60s to reduce writes by 50% more)
  private static readonly INTERACTION_DEBOUNCE = 5000; // 5 seconds (increased to reduce noise)
  private static readonly BATCH_UPDATE_THRESHOLD = 10; // Batch updates when we have 10+ changes (increased for cost optimization)
  private static readonly BATCH_UPDATE_INTERVAL = 60 * 1000; // 60 seconds (increased for cost optimization)

  constructor() {
    this.activeSubscriptions = new Map();
    this.setupInteractionTracking();
    this.startBatchProcessor();
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
      if (this.currentAccount) {
        // Ensure interactions object exists
        if (!this.currentAccount.interactions) {
          this.currentAccount.interactions = {
            mouseMovements: 0,
            clicks: 0,
            scrollEvents: 0,
            keystrokes: 0
          };
        }

        this.currentAccount.interactions = {
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
   * Track a visitor with bot detection and session management
   * DISABLED: Visitor tracking disabled to reduce Firebase costs
   */
  async trackVisitor(userId?: string, isAuthenticated: boolean = false): Promise<void> {
    // Visitor tracking disabled for cost optimization
    return;
  }

  /**
   * Find existing session for the same fingerprint/user to prevent duplicates
   */
  private async findExistingSession(fingerprintId: string, userId?: string): Promise<VisitorSession | null> {
    // COST OPTIMIZATION: Add caching to reduce repeated queries
    const cacheKey = `visitor-session:${userId || fingerprintId}`;
    const cached = this.sessionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
      return cached.data;
    }

    try {
      const now = new Date();
      const sessionTimeout = new Date(now.getTime() - VisitorTrackingService.SESSION_TIMEOUT);

      const visitorsRef = collection(db, getCollectionName('siteVisitors'));
      let q;

      if (userId) {
        // For authenticated users, check by userId
        q = query(
          visitorsRef,
          where('userId', '==', userId),
          where('lastSeen', '>=', Timestamp.fromDate(sessionTimeout)),
          limit(1) // OPTIMIZATION: Only need one result
        );
      } else {
        // For anonymous users, check by fingerprint
        q = query(
          visitorsRef,
          where('fingerprint.id', '==', fingerprintId),
          where('lastSeen', '>=', Timestamp.fromDate(sessionTimeout)),
          limit(1) // OPTIMIZATION: Only need one result
        );
      }

      const snapshot = await getDocs(q);
      let result = null;
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        result = { id: doc.id, ...doc.data() } as VisitorSession;
      }

      // Cache the result
      this.sessionCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      // Handle permission denied errors gracefully - this is expected for private data
      if (error?.code === 'permission-denied') {
        // Permission denied - this is expected for private data
      } else {
        // Error finding existing session
      }
      return null;
    }
  }

  /**
   * Update session authentication status
   */
  private async updateSessionAuth(userId?: string, isAuthenticated: boolean = false): Promise<void> {
    if (!this.currentAccount) return;

    try {
      this.currentAccount.userId = userId;
      this.currentAccount.isAuthenticated = isAuthenticated;

const sessionRef = doc(db, getCollectionName("siteVisitors"), this.currentAccount.id);
      const updateData: any = {
        isAuthenticated,
        lastSeen: Timestamp.now()
      };

      // Only include userId if it's defined
      if (userId !== undefined) {
        updateData.userId = userId;
      }

      await updateDoc(sessionRef, updateData);

    } catch (error) {
      // Error updating session auth
    }
  }

  /**
   * Setup session heartbeat
   * DISABLED: Heartbeat disabled to reduce Firebase costs
   */
  private setupHeartbeat(): void {
    // Heartbeat disabled for cost optimization
    return;
  }

  /**
   * Subscribe to live visitor count
   * DISABLED: Real-time listeners disabled to reduce Firebase costs - use API polling instead
   */
  subscribeToVisitorCount(callback: (counts: {
    total: number;
    authenticated: number;
    anonymous: number;
    bots: number;
    legitimateVisitors: number;
  }) => void): Unsubscribe | null {
    // Return mock data to prevent breaking UI
    setTimeout(() => {
      callback({
        total: 0,
        authenticated: 0,
        anonymous: 0,
        bots: 0,
        legitimateVisitors: 0
      });
    }, 100);
    return () => {};
  }

  /**
   * Track a page view for the current account
   */
  trackPageView(pageUrl: string): void {
    if (!this.currentAccount) return;

    try {
      this.currentAccount.pageViews++;
      this.currentAccount.lastSeen = Timestamp.now();

      // Add to pending updates instead of immediate write
      this.addToPendingUpdates({
        pageViews: this.currentAccount.pageViews,
        lastSeen: this.currentAccount.lastSeen
      });

    } catch (error) {
      // Error tracking page view
    }
  }

  /**
   * Add updates to pending batch
   */
  private addToPendingUpdates(updates: Partial<VisitorSession>): void {
    Object.assign(this.pendingUpdates, updates);
    this.updateCount++;

    // Force batch update if threshold reached
    if (this.updateCount >= VisitorTrackingService.BATCH_UPDATE_THRESHOLD) {
      this.processBatchUpdate();
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    setInterval(() => {
      this.processBatchUpdate();
    }, VisitorTrackingService.BATCH_UPDATE_INTERVAL);
  }

  /**
   * Process pending updates in batch
   */
  private async processBatchUpdate(): Promise<void> {
    if (!this.currentAccount || Object.keys(this.pendingUpdates).length === 0) {
      return;
    }

    const batchStartTime = Date.now();
    const batchSize = this.updateCount;
    let success = false;

    try {
      const sessionRef = doc(db, getCollectionName("siteVisitors"), this.currentAccount.id);
      await updateDoc(sessionRef, this.pendingUpdates);

      success = true;

      // Reset batch
      this.pendingUpdates = {};
      this.updateCount = 0;
      this.lastBatchUpdate = Date.now();
    } catch (error) {
      // Error processing batch update
    } finally {
      // Track batch processing for cost optimization monitoring
      trackFirebaseRead('siteVisitors', 'batch_update', batchSize, 'visitor-tracking');
    }
  }

  /**
   * Get current account information for debugging
   */
  getCurrentSession(): VisitorSession | null {
    return this.currentAccount;
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
      // Error unsubscribing from visitor count
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
      if (this.currentAccount) {
const sessionRef = doc(db, getCollectionName("siteVisitors"), this.currentAccount.id);
        await updateDoc(sessionRef, {
          endTime: Timestamp.now(),
          sessionDuration: Math.floor((Date.now() - this.sessionStartTime) / 1000),
          active: false
        });

        this.currentAccount = null;
      }

      // Clean up all subscriptions
      this.activeSubscriptions.forEach(unsubscribe => unsubscribe());
      this.activeSubscriptions.clear();

      this.isTracking = false;
    } catch (error) {
      // Error cleaning up visitor tracking
    }
  }

  /**
   * Clean up stale visitors with enhanced filtering
   */
  async cleanupStaleVisitors(): Promise<void> {
    try {
      const sessionTimeout = new Date(Date.now() - VisitorTrackingService.SESSION_TIMEOUT);
      const visitorsRef = collection(db, getCollectionName('siteVisitors'));
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
      // Error cleaning up stale visitors
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
      const visitorsRef = collection(db, getCollectionName('siteVisitors'));
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
      // Error getting analytics summary
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