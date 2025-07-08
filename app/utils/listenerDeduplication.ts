/**
 * Listener Deduplication System
 * 
 * Prevents multiple Firebase listeners from being created for the same data,
 * reducing Firebase read costs and improving performance.
 */

import type { Unsubscribe } from 'firebase/firestore';

interface ListenerInfo {
  unsubscribe: Unsubscribe;
  callbacks: Set<Function>;
  lastUpdate: number;
  throttleInterval: number;
  isActive: boolean;
}

class ListenerDeduplicationManager {
  private listeners: Map<string, ListenerInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupProcess();
  }

  /**
   * Register a listener or add callback to existing listener
   */
  registerListener(
    key: string,
    createListener: () => Unsubscribe,
    callback: Function,
    throttleInterval: number = 45000
  ): Unsubscribe {
    const existing = this.listeners.get(key);

    if (existing && existing.isActive) {
      // Add callback to existing listener
      existing.callbacks.add(callback);
      console.log(`[ListenerDedup] Added callback to existing listener: ${key} (${existing.callbacks.size} total callbacks)`);
      
      // Return unsubscribe function that only removes this callback
      return () => {
        existing.callbacks.delete(callback);
        if (existing.callbacks.size === 0) {
          this.removeListener(key);
        }
      };
    }

    // Create new listener
    console.log(`[ListenerDedup] Creating new listener: ${key}`);
    const unsubscribe = createListener();
    
    const listenerInfo: ListenerInfo = {
      unsubscribe,
      callbacks: new Set([callback]),
      lastUpdate: 0,
      throttleInterval,
      isActive: true
    };

    this.listeners.set(key, listenerInfo);

    // Return unsubscribe function
    return () => {
      listenerInfo.callbacks.delete(callback);
      if (listenerInfo.callbacks.size === 0) {
        this.removeListener(key);
      }
    };
  }

  /**
   * Notify all callbacks for a listener with throttling
   */
  notifyCallbacks(key: string, data: any): void {
    const listener = this.listeners.get(key);
    if (!listener || !listener.isActive) return;

    const now = Date.now();
    if (now - listener.lastUpdate < listener.throttleInterval) {
      return; // Throttle updates
    }

    listener.lastUpdate = now;
    listener.callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[ListenerDedup] Error in callback for ${key}:`, error);
      }
    });
  }

  /**
   * Remove a listener
   */
  private removeListener(key: string): void {
    const listener = this.listeners.get(key);
    if (listener) {
      listener.isActive = false;
      listener.unsubscribe();
      this.listeners.delete(key);
      console.log(`[ListenerDedup] Removed listener: ${key}`);
    }
  }

  /**
   * Get statistics about active listeners
   */
  getStats() {
    const activeListeners = Array.from(this.listeners.values()).filter(l => l.isActive);
    return {
      totalListeners: activeListeners.length,
      totalCallbacks: activeListeners.reduce((sum, l) => sum + l.callbacks.size, 0),
      listenerKeys: Array.from(this.listeners.keys()),
      avgCallbacksPerListener: activeListeners.length > 0 
        ? activeListeners.reduce((sum, l) => sum + l.callbacks.size, 0) / activeListeners.length 
        : 0
    };
  }

  /**
   * Cleanup inactive listeners periodically
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes

      for (const [key, listener] of this.listeners.entries()) {
        if (!listener.isActive || (now - listener.lastUpdate > staleThreshold && listener.callbacks.size === 0)) {
          this.removeListener(key);
        }
      }
    }, 5 * 60 * 1000); // Run cleanup every 5 minutes
  }

  /**
   * Cleanup all listeners (for app shutdown)
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [key] of this.listeners.entries()) {
      this.removeListener(key);
    }
  }
}

// Global instance
const listenerManager = new ListenerDeduplicationManager();

/**
 * Create or reuse a Firebase listener with deduplication
 */
export const createDedupedListener = (
  key: string,
  createListener: () => Unsubscribe,
  callback: Function,
  throttleInterval?: number
): Unsubscribe => {
  return listenerManager.registerListener(key, createListener, callback, throttleInterval);
};

/**
 * Notify callbacks for a specific listener
 */
export const notifyListenerCallbacks = (key: string, data: any): void => {
  listenerManager.notifyCallbacks(key, data);
};

/**
 * Get listener deduplication statistics
 */
export const getListenerStats = () => {
  return listenerManager.getStats();
};

/**
 * Cleanup all listeners
 */
export const cleanupAllListeners = () => {
  listenerManager.cleanup();
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAllListeners);
}
