/**
 * Smart Polling Utility - Cost-Optimized Alternative to Real-time Listeners
 * 
 * Implements intelligent polling with:
 * - Exponential backoff for inactive users
 * - Activity-based interval adjustment
 * - Automatic cleanup and resource management
 * - Deduplication and caching
 */

interface PollingConfig {
  baseInterval: number;        // Base polling interval in ms
  maxInterval: number;         // Maximum interval in ms
  backoffMultiplier: number;   // Multiplier for exponential backoff
  activityThreshold: number;   // Time in ms to consider user inactive
  enableBackoff: boolean;      // Whether to use exponential backoff
}

interface PollingSession {
  id: string;
  callback: (data: any) => void;
  fetcher: () => Promise<any>;
  config: PollingConfig;
  currentInterval: number;
  lastActivity: number;
  lastFetch: number;
  intervalId: NodeJS.Timeout | null;
  isActive: boolean;
  errorCount: number;
  lastData: any;
}

class SmartPollingManager {
  private sessions = new Map<string, PollingSession>();
  private activityTracker = new Map<string, number>();
  private globalActivity = Date.now();

  // Default configurations for different data types
  private readonly DEFAULT_CONFIGS: Record<string, PollingConfig> = {
    // Critical data - frequent polling
    critical: {
      baseInterval: 15000,      // 15 seconds
      maxInterval: 120000,      // 2 minutes
      backoffMultiplier: 1.5,
      activityThreshold: 300000, // 5 minutes
      enableBackoff: true
    },
    
    // High priority data - moderate polling
    high: {
      baseInterval: 30000,      // 30 seconds
      maxInterval: 300000,      // 5 minutes
      backoffMultiplier: 2,
      activityThreshold: 600000, // 10 minutes
      enableBackoff: true
    },
    
    // Medium priority data - slower polling
    medium: {
      baseInterval: 60000,      // 1 minute
      maxInterval: 600000,      // 10 minutes
      backoffMultiplier: 2,
      activityThreshold: 900000, // 15 minutes
      enableBackoff: true
    },
    
    // Low priority data - very slow polling
    low: {
      baseInterval: 300000,     // 5 minutes
      maxInterval: 1800000,     // 30 minutes
      backoffMultiplier: 2,
      activityThreshold: 1800000, // 30 minutes
      enableBackoff: true
    }
  };

  constructor() {
    this.setupActivityTracking();
    this.startCleanupInterval();
  }

  /**
   * Start a smart polling session
   */
  startPolling(
    sessionId: string,
    fetcher: () => Promise<any>,
    callback: (data: any) => void,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'medium',
    customConfig?: Partial<PollingConfig>
  ): string {
    // Stop existing session if it exists
    this.stopPolling(sessionId);

    const config = {
      ...this.DEFAULT_CONFIGS[priority],
      ...customConfig
    };

    const session: PollingSession = {
      id: sessionId,
      callback,
      fetcher,
      config,
      currentInterval: config.baseInterval,
      lastActivity: Date.now(),
      lastFetch: 0,
      intervalId: null,
      isActive: true,
      errorCount: 0,
      lastData: null
    };

    this.sessions.set(sessionId, session);
    this.scheduleNextPoll(sessionId);

    console.log(`📊 [SmartPolling] Started polling session: ${sessionId} (${priority} priority)`);
    return sessionId;
  }

  /**
   * Stop a polling session
   */
  stopPolling(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.intervalId) {
        clearTimeout(session.intervalId);
      }
      session.isActive = false;
      this.sessions.delete(sessionId);
      console.log(`📊 [SmartPolling] Stopped polling session: ${sessionId}`);
    }
  }

  /**
   * Update user activity to adjust polling intervals
   */
  updateActivity(userId?: string): void {
    this.globalActivity = Date.now();
    if (userId) {
      this.activityTracker.set(userId, Date.now());
    }

    // Adjust intervals for all active sessions
    this.sessions.forEach((session, sessionId) => {
      this.adjustPollingInterval(sessionId);
    });
  }

  /**
   * Schedule the next poll for a session
   */
  private scheduleNextPoll(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    session.intervalId = setTimeout(async () => {
      await this.executePoll(sessionId);
    }, session.currentInterval);
  }

  /**
   * Execute a poll for a session
   */
  private async executePoll(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    try {
      const startTime = Date.now();
      const data = await session.fetcher();
      const fetchTime = Date.now() - startTime;

      // Only call callback if data has changed (deduplication)
      if (JSON.stringify(data) !== JSON.stringify(session.lastData)) {
        session.callback(data);
        session.lastData = data;
        console.log(`📊 [SmartPolling] Data updated for ${sessionId} (fetch: ${fetchTime}ms)`);
      }

      session.lastFetch = Date.now();
      session.errorCount = 0;

      // Adjust interval based on activity
      this.adjustPollingInterval(sessionId);

    } catch (error) {
      session.errorCount++;
      console.error(`📊 [SmartPolling] Error in session ${sessionId}:`, error);

      // Increase interval on errors (exponential backoff)
      if (session.errorCount > 3) {
        session.currentInterval = Math.min(
          session.currentInterval * session.config.backoffMultiplier,
          session.config.maxInterval
        );
      }
    }

    // Schedule next poll
    this.scheduleNextPoll(sessionId);
  }

  /**
   * Adjust polling interval based on user activity
   */
  private adjustPollingInterval(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.config.enableBackoff) return;

    const timeSinceActivity = Date.now() - this.globalActivity;
    const isInactive = timeSinceActivity > session.config.activityThreshold;

    if (isInactive) {
      // User is inactive, increase interval (exponential backoff)
      session.currentInterval = Math.min(
        session.currentInterval * session.config.backoffMultiplier,
        session.config.maxInterval
      );
    } else {
      // User is active, reset to base interval
      session.currentInterval = session.config.baseInterval;
    }
  }

  /**
   * Setup activity tracking
   */
  private setupActivityTracking(): void {
    if (typeof window !== 'undefined') {
      // Track user interactions
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      events.forEach(event => {
        window.addEventListener(event, () => this.updateActivity(), { passive: true });
      });

      // Track page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.updateActivity();
        }
      });
    }
  }

  /**
   * Start cleanup interval to remove inactive sessions
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

      this.sessions.forEach((session, sessionId) => {
        if (now - session.lastActivity > inactiveThreshold) {
          console.log(`📊 [SmartPolling] Cleaning up inactive session: ${sessionId}`);
          this.stopPolling(sessionId);
        }
      });
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      globalActivity: this.globalActivity,
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        currentInterval: session.currentInterval,
        lastActivity: session.lastActivity,
        errorCount: session.errorCount,
        isActive: session.isActive
      }))
    };
  }
}

// Global instance
const smartPollingManager = new SmartPollingManager();

/**
 * Convenience functions for common use cases
 */

// Replace real-time listeners with smart polling
export const pollPageStats = (pageId: string, callback: (stats: any) => void) => {
  return smartPollingManager.startPolling(
    `page-stats-${pageId}`,
    async () => {
      const response = await fetch(`/api/pages/${pageId}/stats`);
      return response.ok ? response.json() : null;
    },
    callback,
    'medium'
  );
};

export const pollUserData = (userId: string, callback: (data: any) => void) => {
  return smartPollingManager.startPolling(
    `user-data-${userId}`,
    async () => {
      const response = await fetch(`/api/users/${userId}/profile-data`);
      return response.ok ? response.json() : null;
    },
    callback,
    'low'
  );
};

export const pollRecentActivity = (callback: (activity: any) => void) => {
  return smartPollingManager.startPolling(
    'recent-activity',
    async () => {
      const response = await fetch('/api/recent-edits/global');
      return response.ok ? response.json() : null;
    },
    callback,
    'high'
  );
};

// Export the manager and utility functions
export { smartPollingManager };
export const updateActivity = (userId?: string) => smartPollingManager.updateActivity(userId);
export const stopPolling = (sessionId: string) => smartPollingManager.stopPolling(sessionId);
export const getPollingStats = () => smartPollingManager.getStats();
