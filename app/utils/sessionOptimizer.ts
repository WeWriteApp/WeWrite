/**
 * Session Management Optimizer for Firebase Cost Reduction
 * 
 * Provides intelligent session caching, authentication optimization,
 * and reduced Firebase operations for session management.
 */

import { getCacheItem, setCacheItem } from './cacheUtils';
import { UNIFIED_CACHE_TTL } from './serverCache';
import Cookies from 'js-cookie';

interface SessionData {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  emailVerified: boolean;
  isDevelopment?: boolean;
  createdAt: string;
  lastActiveAt: string;
}

interface SessionCache {
  data: SessionData;
  timestamp: number;
  ttl: number;
  verified: boolean;
}

interface SessionOptimizationConfig {
  cacheSessionTTL: number;
  verificationInterval: number;
  maxRetries: number;
  batchVerificationSize: number;
  enableOfflineMode: boolean;
}

class SessionOptimizer {
  private config: SessionOptimizationConfig = {
    cacheSessionTTL: UNIFIED_CACHE_TTL.SESSION_DATA,  // Use unified session cache TTL
    verificationInterval: 30 * 60 * 1000,             // 30 minutes verification
    maxRetries: 3,                                     // Max retry attempts
    batchVerificationSize: 10,                         // Batch size for verification
    enableOfflineMode: true                            // Enable offline session mode
  };

  private sessionCache = new Map<string, SessionCache>();
  private verificationQueue = new Set<string>();
  private verificationTimer: NodeJS.Timeout | null = null;
  private costSavings = 0;

  constructor() {
    this.startVerificationProcessor();
    this.loadCachedSessions();
  }

  /**
   * Get session with intelligent caching
   */
  async getSession(uid: string, forceRefresh: boolean = false): Promise<SessionData | null> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getCachedSession(uid);
      if (cached) {
        this.costSavings += 0.00036; // Saved one Firebase read
        return cached.data;
      }
    }

    // Try cookie-based session first (no Firebase call needed)
    const cookieSession = this.getSessionFromCookie();
    if (cookieSession && cookieSession.uid === uid) {
      this.cacheSession(uid, cookieSession, true);
      return cookieSession;
    }

    // If offline mode enabled and we have stale cache, use it
    if (this.config.enableOfflineMode) {
      const staleSession = this.sessionCache.get(uid);
      if (staleSession) {
        console.log(`[SessionOptimizer] Using stale session for offline mode: ${uid}`);
        return staleSession.data;
      }
    }

    // Last resort: fetch from Firebase (this is what we want to minimize)
    return await this.fetchSessionFromFirebase(uid);
  }

  /**
   * Cache session data efficiently
   */
  cacheSession(uid: string, sessionData: SessionData, verified: boolean = false): void {
    const now = Date.now();
    
    this.sessionCache.set(uid, {
      data: sessionData,
      timestamp: now,
      ttl: this.config.cacheSessionTTL,
      verified
    });

    // Also cache in localStorage for persistence
    setCacheItem(`session_${uid}`, sessionData, this.config.cacheSessionTTL);

    // Update cookie if this is the current session
    this.updateSessionCookie(sessionData);

    console.log(`[SessionOptimizer] Cached session for ${uid} (verified: ${verified})`);
  }

  /**
   * Get cached session if valid
   */
  private getCachedSession(uid: string): SessionCache | null {
    const cached = this.sessionCache.get(uid);
    if (!cached) {
      // Try localStorage cache
      const stored = getCacheItem<SessionData>(`session_${uid}`);
      if (stored) {
        this.sessionCache.set(uid, {
          data: stored,
          timestamp: Date.now(),
          ttl: this.config.cacheSessionTTL,
          verified: false // Needs verification
        });
        return this.sessionCache.get(uid)!;
      }
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.sessionCache.delete(uid);
      return null;
    }

    // Schedule verification if needed
    if (!cached.verified && now - cached.timestamp > this.config.verificationInterval) {
      this.scheduleVerification(uid);
    }

    return cached;
  }

  /**
   * Get session from cookie (fastest method)
   */
  private getSessionFromCookie(): SessionData | null {
    try {
      const isDev = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
      const cookieName = isDev ? 'devUserSession' : 'userSession';
      const cookieValue = Cookies.get(cookieName);
      
      if (cookieValue) {
        return JSON.parse(cookieValue);
      }
    } catch (error) {
      console.error('[SessionOptimizer] Error parsing session cookie:', error);
    }
    return null;
  }

  /**
   * Update session cookie efficiently
   */
  private updateSessionCookie(sessionData: SessionData): void {
    try {
      const isDev = sessionData.isDevelopment || false;
      const cookieName = isDev ? 'devUserSession' : 'userSession';
      const expires = new Date();
      expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      Cookies.set(cookieName, JSON.stringify(sessionData), {
        expires,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
    } catch (error) {
      console.error('[SessionOptimizer] Error updating session cookie:', error);
    }
  }

  /**
   * Fetch session from Firebase (expensive operation)
   */
  private async fetchSessionFromFirebase(uid: string): Promise<SessionData | null> {
    try {
      console.log(`[SessionOptimizer] Fetching session from Firebase for ${uid} (expensive operation)`);
      
      // This would normally be a Firebase call - we'll simulate it
      // In real implementation, this would call the session API
      const response = await fetch(`/api/auth/session?uid=${uid}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          this.cacheSession(uid, data.session, true);
          return data.session;
        }
      }
    } catch (error) {
      console.error('[SessionOptimizer] Error fetching session from Firebase:', error);
    }
    return null;
  }

  /**
   * Schedule session verification
   */
  private scheduleVerification(uid: string): void {
    this.verificationQueue.add(uid);
  }

  /**
   * Start verification processor
   */
  private startVerificationProcessor(): void {
    this.verificationTimer = setInterval(async () => {
      if (this.verificationQueue.size > 0) {
        await this.processVerificationQueue();
      }
    }, this.config.verificationInterval);
  }

  /**
   * Process verification queue in batches
   */
  private async processVerificationQueue(): Promise<void> {
    const uidsToVerify = Array.from(this.verificationQueue).slice(0, this.config.batchVerificationSize);
    this.verificationQueue.clear();

    if (uidsToVerify.length === 0) return;

    console.log(`[SessionOptimizer] Verifying ${uidsToVerify.length} sessions`);

    // Batch verify sessions
    try {
      const verificationPromises = uidsToVerify.map(uid => this.verifySession(uid));
      await Promise.allSettled(verificationPromises);
    } catch (error) {
      console.error('[SessionOptimizer] Error in batch verification:', error);
    }
  }

  /**
   * Verify a single session
   */
  private async verifySession(uid: string): Promise<void> {
    try {
      const response = await fetch(`/api/auth/verify-session?uid=${uid}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'max-age=300' // 5 minutes cache
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.session) {
          // Update cache with verified session
          this.cacheSession(uid, data.session, true);
        } else {
          // Remove invalid session
          this.sessionCache.delete(uid);
          this.clearSessionCookie();
        }
      }
    } catch (error) {
      console.error(`[SessionOptimizer] Error verifying session ${uid}:`, error);
    }
  }

  /**
   * Clear session cookie
   */
  private clearSessionCookie(): void {
    Cookies.remove('userSession');
    Cookies.remove('devUserSession');
    Cookies.remove('authToken');
  }

  /**
   * Load cached sessions from localStorage
   */
  private loadCachedSessions(): void {
    try {
      // Load sessions from localStorage on startup
      const keys = Object.keys(localStorage).filter(key => key.startsWith('wewrite_session_'));
      
      for (const key of keys) {
        const uid = key.replace('wewrite_session_', '');
        const cached = getCacheItem<SessionData>(key);
        
        if (cached) {
          this.sessionCache.set(uid, {
            data: cached,
            timestamp: Date.now(),
            ttl: this.config.cacheSessionTTL,
            verified: false
          });
        }
      }

      console.log(`[SessionOptimizer] Loaded ${keys.length} cached sessions`);
    } catch (error) {
      console.error('[SessionOptimizer] Error loading cached sessions:', error);
    }
  }

  /**
   * Optimize session for multiple accounts
   */
  optimizeMultiAccountSessions(accounts: SessionData[]): void {
    // Cache all accounts efficiently
    accounts.forEach(account => {
      this.cacheSession(account.uid, account, false);
    });

    // Schedule batch verification for all accounts
    accounts.forEach(account => {
      this.scheduleVerification(account.uid);
    });

    console.log(`[SessionOptimizer] Optimized ${accounts.length} multi-account sessions`);
  }

  /**
   * Preload session for account switching
   */
  async preloadSession(uid: string): Promise<void> {
    // Preload session in background to make switching faster
    const cached = this.getCachedSession(uid);
    if (!cached) {
      // Fetch and cache in background
      setTimeout(async () => {
        await this.getSession(uid);
      }, 100);
    }
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      cachedSessions: this.sessionCache.size,
      verificationQueue: this.verificationQueue.size,
      costSavings: this.costSavings,
      config: this.config,
      cacheHitRate: this.costSavings > 0 ? (this.costSavings / (this.costSavings + 1)) * 100 : 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SessionOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[SessionOptimizer] Configuration updated:', this.config);
  }

  /**
   * Clear all cached sessions
   */
  clearCache(): void {
    this.sessionCache.clear();
    this.verificationQueue.clear();
    
    // Clear localStorage cache
    const keys = Object.keys(localStorage).filter(key => key.startsWith('wewrite_session_'));
    keys.forEach(key => localStorage.removeItem(key));
    
    console.log('[SessionOptimizer] All session cache cleared');
  }

  /**
   * Cleanup and stop processors
   */
  destroy(): void {
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
      this.verificationTimer = null;
    }
    
    this.clearCache();
    console.log('[SessionOptimizer] Destroyed session optimizer');
  }
}

// Export singleton instance
export const sessionOptimizer = new SessionOptimizer();

// Convenience functions
export const getOptimizedSession = (uid: string, forceRefresh?: boolean) => {
  return sessionOptimizer.getSession(uid, forceRefresh);
};

export const cacheUserSession = (uid: string, sessionData: SessionData) => {
  sessionOptimizer.cacheSession(uid, sessionData, true);
};

export const preloadUserSession = (uid: string) => {
  return sessionOptimizer.preloadSession(uid);
};

export const optimizeMultiAccountSessions = (accounts: SessionData[]) => {
  sessionOptimizer.optimizeMultiAccountSessions(accounts);
};

export const getSessionOptimizationStats = () => {
  return sessionOptimizer.getStats();
};

export const updateSessionConfig = (config: Partial<SessionOptimizationConfig>) => {
  sessionOptimizer.updateConfig(config);
};

export const clearSessionCache = () => {
  sessionOptimizer.clearCache();
};

export const destroySessionOptimizer = () => {
  sessionOptimizer.destroy();
};
