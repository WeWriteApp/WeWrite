/**
 * Cache Warming Utility - Intelligent Preloading for Cost Optimization
 * 
 * Proactively loads and caches frequently accessed data to reduce
 * Firebase reads during user interactions.
 */

interface WarmingTask {
  id: string;
  priority: number;
  fetcher: () => Promise<any>;
  cacheKey: string;
  ttl: number;
  lastWarmed: number;
  warmingInterval: number;
}

class CacheWarmingManager {
  private tasks = new Map<string, WarmingTask>();
  private isWarming = false;
  private warmingQueue: string[] = [];
  private stats = {
    totalWarmed: 0,
    successfulWarms: 0,
    failedWarms: 0,
    lastWarmingSession: 0
  };

  constructor() {
    this.setupAutomaticWarming();
  }

  /**
   * Add a cache warming task
   */
  addWarmingTask(
    id: string,
    fetcher: () => Promise<any>,
    cacheKey: string,
    options: {
      priority?: number;
      ttl?: number;
      warmingInterval?: number;
    } = {}
  ): void {
    const {
      priority = 1,
      ttl = 4 * 60 * 60 * 1000, // 4 hours default
      warmingInterval = 2 * 60 * 60 * 1000 // 2 hours default
    } = options;

    const task: WarmingTask = {
      id,
      priority,
      fetcher,
      cacheKey,
      ttl,
      lastWarmed: 0,
      warmingInterval
    };

    this.tasks.set(id, task);
    console.log(`🔥 [CacheWarming] Added warming task: ${id} (priority: ${priority})`);
  }

  /**
   * Remove a warming task
   */
  removeWarmingTask(id: string): void {
    this.tasks.delete(id);
    console.log(`🔥 [CacheWarming] Removed warming task: ${id}`);
  }

  /**
   * Manually trigger cache warming for specific task
   */
  async warmCache(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`🔥 [CacheWarming] Task not found: ${taskId}`);
      return false;
    }

    try {
      console.log(`🔥 [CacheWarming] Warming cache for: ${taskId}`);
      const data = await task.fetcher();
      
      // Store in cache
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheItem = {
          data,
          timestamp: Date.now(),
          ttl: task.ttl
        };
        localStorage.setItem(task.cacheKey, JSON.stringify(cacheItem));
      }

      task.lastWarmed = Date.now();
      this.stats.successfulWarms++;
      console.log(`🔥 [CacheWarming] Successfully warmed: ${taskId}`);
      return true;

    } catch (error) {
      console.error(`🔥 [CacheWarming] Failed to warm ${taskId}:`, error);
      this.stats.failedWarms++;
      return false;
    }
  }

  /**
   * Warm all caches based on priority
   */
  async warmAllCaches(): Promise<void> {
    if (this.isWarming) {
      console.log('🔥 [CacheWarming] Already warming, skipping');
      return;
    }

    this.isWarming = true;
    this.stats.lastWarmingSession = Date.now();

    try {
      // Sort tasks by priority (higher priority first)
      const sortedTasks = Array.from(this.tasks.values())
        .sort((a, b) => b.priority - a.priority);

      console.log(`🔥 [CacheWarming] Starting warming session for ${sortedTasks.length} tasks`);

      // Warm caches in priority order with delays to avoid overwhelming the server
      for (const task of sortedTasks) {
        const timeSinceLastWarm = Date.now() - task.lastWarmed;
        
        // Only warm if enough time has passed
        if (timeSinceLastWarm >= task.warmingInterval) {
          await this.warmCache(task.id);
          
          // Add delay between warming tasks to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('🔥 [CacheWarming] Warming session completed');

    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Setup automatic cache warming
   */
  private setupAutomaticWarming(): void {
    // 🚨 EMERGENCY: Cache warming disabled to prevent database read crisis
    console.warn('🚨 EMERGENCY: Cache warming system disabled to prevent excessive database reads (174K reads/min crisis)');
    return;

    // DISABLED: All automatic cache warming to prevent database read overload
    // // Warm caches on page load
    // if (typeof window !== 'undefined') {
    //   window.addEventListener('load', () => {
    //     setTimeout(() => this.warmAllCaches(), 2000); // Wait 2 seconds after load
    //   });

    //   // Warm caches periodically
    //   setInterval(() => {
    //     this.warmAllCaches();
    //   }, 30 * 60 * 1000); // Every 30 minutes

    //   // Warm caches when user becomes active
    //   let isUserActive = true;
    //   let inactivityTimer: NodeJS.Timeout;

    //   const resetInactivityTimer = () => {
    //     clearTimeout(inactivityTimer);
    //     if (!isUserActive) {
    //       isUserActive = true;
    //       console.log('🔥 [CacheWarming] User became active, warming critical caches');
    //       this.warmCriticalCaches();
    //     }

    //     inactivityTimer = setTimeout(() => {
    //       isUserActive = false;
    //     }, 5 * 60 * 1000); // 5 minutes of inactivity
    //   };

    //   ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    //     window.addEventListener(event, resetInactivityTimer, { passive: true });
    //   });
    // }
  }

  /**
   * Warm only critical/high-priority caches
   */
  async warmCriticalCaches(): Promise<void> {
    const criticalTasks = Array.from(this.tasks.values())
      .filter(task => task.priority >= 3)
      .sort((a, b) => b.priority - a.priority);

    for (const task of criticalTasks) {
      await this.warmCache(task.id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalTasks: this.tasks.size,
      isWarming: this.isWarming,
      queueLength: this.warmingQueue.length
    };
  }
}

// Global cache warming manager
const cacheWarmingManager = new CacheWarmingManager();

/**
 * Predefined warming tasks for common data
 */

// Warm home page data
export const warmHomeData = (userId?: string) => {
  cacheWarmingManager.addWarmingTask(
    'home-data',
    async () => {
      const response = await fetch(`/api/home${userId ? `?userId=${userId}` : ''}`);
      return response.ok ? response.json() : null;
    },
    `wewrite_home_${userId || 'anonymous'}`,
    {
      priority: 5, // High priority
      ttl: 10 * 60 * 1000, // 10 minutes
      warmingInterval: 5 * 60 * 1000 // Warm every 5 minutes
    }
  );
};

// Warm user profile data
export const warmUserProfile = (userId: string) => {
  cacheWarmingManager.addWarmingTask(
    `user-profile-${userId}`,
    async () => {
      const response = await fetch(`/api/users/${userId}/profile-data`);
      return response.ok ? response.json() : null;
    },
    `wewrite_user_profile_${userId}`,
    {
      priority: 4, // High priority
      ttl: 12 * 60 * 60 * 1000, // 12 hours
      warmingInterval: 6 * 60 * 60 * 1000 // Warm every 6 hours
    }
  );
};

// Warm recent activity
export const warmRecentActivity = () => {
  cacheWarmingManager.addWarmingTask(
    'recent-activity',
    async () => {
      const response = await fetch('/api/recent-edits/global');
      return response.ok ? response.json() : null;
    },
    'wewrite_recent_activity',
    {
      priority: 3, // Medium priority
      ttl: 15 * 60 * 1000, // 15 minutes
      warmingInterval: 10 * 60 * 1000 // Warm every 10 minutes
    }
  );
};

// Warm trending pages
export const warmTrendingPages = () => {
  cacheWarmingManager.addWarmingTask(
    'trending-pages',
    async () => {
      const response = await fetch('/api/trending');
      return response.ok ? response.json() : null;
    },
    'wewrite_trending_pages',
    {
      priority: 2, // Medium priority
      ttl: 2 * 60 * 60 * 1000, // 2 hours
      warmingInterval: 1 * 60 * 60 * 1000 // Warm every hour
    }
  );
};

// Export the manager and utility functions
export { cacheWarmingManager };
export const addWarmingTask = (id: string, fetcher: () => Promise<any>, cacheKey: string, options?: any) => 
  cacheWarmingManager.addWarmingTask(id, fetcher, cacheKey, options);
export const removeWarmingTask = (id: string) => cacheWarmingManager.removeWarmingTask(id);
export const warmAllCaches = () => cacheWarmingManager.warmAllCaches();
export const getWarmingStats = () => cacheWarmingManager.getStats();
