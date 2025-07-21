/**
 * Advanced Listener Optimization for Firebase Cost Reduction
 * 
 * Implements intelligent listener management with connection pooling,
 * adaptive throttling, and automatic cleanup to minimize Firebase costs.
 */

import type { Unsubscribe } from 'firebase/firestore';

interface ListenerMetrics {
  createdAt: number;
  lastUpdate: number;
  updateCount: number;
  throttleHits: number;
  dataSize: number;
  isActive: boolean;
}

interface AdaptiveThrottleConfig {
  baseInterval: number;
  maxInterval: number;
  activityMultiplier: number;
  inactivityMultiplier: number;
}

interface ListenerPool {
  listeners: Map<string, {
    unsubscribe: Unsubscribe;
    callbacks: Set<Function>;
    metrics: ListenerMetrics;
    throttleConfig: AdaptiveThrottleConfig;
    lastActivity: number;
  }>;
  connectionCount: number;
  maxConnections: number;
}

class AdvancedListenerOptimizer {
  private pools = new Map<string, ListenerPool>();
  private globalMetrics = {
    totalListeners: 0,
    totalCallbacks: 0,
    totalThrottleHits: 0,
    totalDataTransferred: 0,
    costSavings: 0
  };

  private readonly DEFAULT_THROTTLE_CONFIG: AdaptiveThrottleConfig = {
    baseInterval: 5 * 60 * 1000,      // 5 minutes base (increased for cost optimization)
    maxInterval: 30 * 60 * 1000,      // 30 minutes max (increased for cost optimization)
    activityMultiplier: 0.3,          // More aggressive reduction when active
    inactivityMultiplier: 3.0         // More aggressive increase when inactive
  };

  private readonly MAX_CONNECTIONS_PER_POOL = 5;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupProcess();
    this.startMetricsLogging();
  }

  /**
   * Create or join an optimized listener pool
   */
  createOptimizedListener(
    poolName: string,
    listenerKey: string,
    createListener: () => Unsubscribe,
    callback: Function,
    throttleConfig?: Partial<AdaptiveThrottleConfig>
  ): Unsubscribe {
    const pool = this.getOrCreatePool(poolName);
    const fullThrottleConfig = { ...this.DEFAULT_THROTTLE_CONFIG, ...throttleConfig };

    const existingListener = pool.listeners.get(listenerKey);
    
    if (existingListener && existingListener.metrics.isActive) {
      // Add to existing listener
      existingListener.callbacks.add(callback);
      existingListener.lastActivity = Date.now();
      
      console.log(`[ListenerOptimizer] Joined existing listener: ${poolName}:${listenerKey} (${existingListener.callbacks.size} callbacks)`);
      
      return () => this.removeCallback(poolName, listenerKey, callback);
    }

    // Create new listener if pool has capacity
    if (pool.connectionCount >= pool.maxConnections) {
      console.warn(`[ListenerOptimizer] Pool ${poolName} at capacity, optimizing...`);
      this.optimizePool(poolName);
    }

    const unsubscribe = createListener();
    const now = Date.now();

    pool.listeners.set(listenerKey, {
      unsubscribe,
      callbacks: new Set([callback]),
      metrics: {
        createdAt: now,
        lastUpdate: now,
        updateCount: 0,
        throttleHits: 0,
        dataSize: 0,
        isActive: true
      },
      throttleConfig: fullThrottleConfig,
      lastActivity: now
    });

    pool.connectionCount++;
    this.globalMetrics.totalListeners++;
    this.globalMetrics.totalCallbacks++;

    console.log(`[ListenerOptimizer] Created new listener: ${poolName}:${listenerKey}`);

    return () => this.removeCallback(poolName, listenerKey, callback);
  }

  /**
   * Notify callbacks with adaptive throttling
   */
  notifyCallbacks(poolName: string, listenerKey: string, data: any): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const listener = pool.listeners.get(listenerKey);
    if (!listener || !listener.metrics.isActive) return;

    const now = Date.now();
    const throttleInterval = this.calculateAdaptiveThrottle(listener);

    if (now - listener.metrics.lastUpdate < throttleInterval) {
      listener.metrics.throttleHits++;
      this.globalMetrics.totalThrottleHits++;
      
      // Calculate cost savings (approximate)
      const estimatedSavings = listener.callbacks.size * 0.001; // $0.001 per read saved
      this.globalMetrics.costSavings += estimatedSavings;
      
      return; // Throttled
    }

    // Update metrics
    listener.metrics.lastUpdate = now;
    listener.metrics.updateCount++;
    listener.lastActivity = now;
    
    // Estimate data size
    const dataSize = JSON.stringify(data).length;
    listener.metrics.dataSize += dataSize;
    this.globalMetrics.totalDataTransferred += dataSize;

    // Notify all callbacks
    listener.callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[ListenerOptimizer] Callback error in ${poolName}:${listenerKey}:`, error);
      }
    });
  }

  /**
   * Calculate adaptive throttle interval based on activity
   */
  private calculateAdaptiveThrottle(listener: any): number {
    const { throttleConfig, lastActivity, metrics } = listener;
    const now = Date.now();
    const timeSinceActivity = now - lastActivity;
    const activityLevel = metrics.updateCount / Math.max(1, (now - metrics.createdAt) / 60000); // Updates per minute

    let interval = throttleConfig.baseInterval;

    // Adjust based on activity level
    if (activityLevel > 5) {
      // High activity - reduce throttle
      interval *= throttleConfig.activityMultiplier;
    } else if (timeSinceActivity > 5 * 60 * 1000) {
      // Low activity - increase throttle
      interval *= throttleConfig.inactivityMultiplier;
    }

    return Math.min(interval, throttleConfig.maxInterval);
  }

  /**
   * Remove callback from listener
   */
  private removeCallback(poolName: string, listenerKey: string, callback: Function): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const listener = pool.listeners.get(listenerKey);
    if (!listener) return;

    listener.callbacks.delete(callback);
    this.globalMetrics.totalCallbacks--;

    if (listener.callbacks.size === 0) {
      // No more callbacks, remove listener
      listener.metrics.isActive = false;
      listener.unsubscribe();
      pool.listeners.delete(listenerKey);
      pool.connectionCount--;
      this.globalMetrics.totalListeners--;
      
      console.log(`[ListenerOptimizer] Removed listener: ${poolName}:${listenerKey}`);
    }
  }

  /**
   * Get or create listener pool
   */
  private getOrCreatePool(poolName: string): ListenerPool {
    if (!this.pools.has(poolName)) {
      this.pools.set(poolName, {
        listeners: new Map(),
        connectionCount: 0,
        maxConnections: this.MAX_CONNECTIONS_PER_POOL
      });
    }
    return this.pools.get(poolName)!;
  }

  /**
   * Optimize pool by removing inactive listeners
   */
  private optimizePool(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    let removedCount = 0;

    for (const [key, listener] of pool.listeners.entries()) {
      if (now - listener.lastActivity > inactiveThreshold) {
        listener.metrics.isActive = false;
        listener.unsubscribe();
        pool.listeners.delete(key);
        pool.connectionCount--;
        removedCount++;
      }
    }

    console.log(`[ListenerOptimizer] Optimized pool ${poolName}: removed ${removedCount} inactive listeners`);
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      for (const poolName of this.pools.keys()) {
        this.optimizePool(poolName);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Start metrics logging
   */
  private startMetricsLogging(): void {
    setInterval(() => {
      if (this.globalMetrics.totalListeners > 0) {
        console.log('[ListenerOptimizer] Metrics:', {
          ...this.globalMetrics,
          avgCallbacksPerListener: this.globalMetrics.totalCallbacks / this.globalMetrics.totalListeners,
          throttleEfficiency: this.globalMetrics.totalThrottleHits / Math.max(1, this.globalMetrics.totalListeners),
          estimatedMonthlySavings: this.globalMetrics.costSavings * 30
        });
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const poolStats = Array.from(this.pools.entries()).map(([name, pool]) => ({
      name,
      listeners: pool.listeners.size,
      connections: pool.connectionCount,
      maxConnections: pool.maxConnections,
      utilization: (pool.connectionCount / pool.maxConnections) * 100
    }));

    return {
      global: this.globalMetrics,
      pools: poolStats,
      totalPools: this.pools.size
    };
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const pool of this.pools.values()) {
      for (const listener of pool.listeners.values()) {
        listener.unsubscribe();
      }
    }

    this.pools.clear();
    console.log('[ListenerOptimizer] Destroyed all listeners and pools');
  }
}

// Global optimizer instance
const listenerOptimizer = new AdvancedListenerOptimizer();

/**
 * Create an optimized Firebase listener
 */
export const createOptimizedListener = (
  poolName: string,
  listenerKey: string,
  createListener: () => Unsubscribe,
  callback: Function,
  throttleConfig?: Partial<AdaptiveThrottleConfig>
): Unsubscribe => {
  return listenerOptimizer.createOptimizedListener(
    poolName,
    listenerKey,
    createListener,
    callback,
    throttleConfig
  );
};

/**
 * Notify optimized listener callbacks
 */
export const notifyOptimizedCallbacks = (
  poolName: string,
  listenerKey: string,
  data: any
): void => {
  listenerOptimizer.notifyCallbacks(poolName, listenerKey, data);
};

/**
 * Get listener optimization statistics
 */
export const getListenerOptimizationStats = () => {
  return listenerOptimizer.getStats();
};

/**
 * Cleanup listener optimizer
 */
export const destroyListenerOptimizer = () => {
  listenerOptimizer.destroy();
};
