/**
 * Global cache invalidation utility
 * Provides a simple way to invalidate caches across the application
 * without relying on complex event systems
 */

type CacheInvalidationCallback = () => void;

class GlobalCacheInvalidation {
  private callbacks: Map<string, CacheInvalidationCallback[]> = new Map();
  private pendingInvalidations: Set<string> = new Set();

  /**
   * Register a callback for a specific cache type
   */
  register(cacheType: string, callback: CacheInvalidationCallback): () => void {
    if (!this.callbacks.has(cacheType)) {
      this.callbacks.set(cacheType, []);
    }

    const callbacks = this.callbacks.get(cacheType)!;
    callbacks.push(callback);

    // Check if there's a pending invalidation for this cache type
    if (this.pendingInvalidations.has(cacheType)) {
      this.pendingInvalidations.delete(cacheType);
      // Trigger the callback immediately
      setTimeout(() => {
        try {
          callback();
        } catch (error) {
          console.error(`GlobalCache: Error in ${cacheType} callback:`, error);
        }
      }, 0);
    }

    // Return unregister function
    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Invalidate all caches of a specific type
   */
  invalidate(cacheType: string, data?: any): void {
    const callbacks = this.callbacks.get(cacheType);
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(`GlobalCache: Error in ${cacheType} callback:`, error);
        }
      });
    } else {
      this.pendingInvalidations.add(cacheType);
    }
  }

  /**
   * Get the number of registered callbacks for a cache type
   */
  getCallbackCount(cacheType: string): number {
    return this.callbacks.get(cacheType)?.length || 0;
  }

  /**
   * Clear all callbacks (useful for cleanup)
   */
  clear(): void {
    this.callbacks.clear();
  }
}

// Create a global instance
export const globalCacheInvalidation = new GlobalCacheInvalidation();

// Convenience functions for common cache types
export const invalidateUserPages = (userId?: string) => {
  globalCacheInvalidation.invalidate('user-pages', { userId });
};

export const invalidateRecentActivity = () => {
  globalCacheInvalidation.invalidate('recent-activity');
};

export const invalidateHomeActivity = () => {
  globalCacheInvalidation.invalidate('home-activity');
};

// Register a callback for user pages cache invalidation
export const registerUserPagesInvalidation = (callback: CacheInvalidationCallback): (() => void) => {
  return globalCacheInvalidation.register('user-pages', callback);
};

// Register a callback for recent activity cache invalidation
export const registerRecentActivityInvalidation = (callback: CacheInvalidationCallback): (() => void) => {
  return globalCacheInvalidation.register('recent-activity', callback);
};

// Register a callback for home activity cache invalidation
export const registerHomeActivityInvalidation = (callback: CacheInvalidationCallback): (() => void) => {
  return globalCacheInvalidation.register('home-activity', callback);
};
