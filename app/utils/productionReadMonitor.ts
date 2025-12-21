/**
 * Production Read Monitor - Backwards compatibility wrapper
 *
 * This module now delegates to the main costMonitor for simplicity.
 * The detailed production monitoring has been consolidated.
 *
 * @deprecated Use trackFirebaseRead from costMonitor.ts directly
 */

import { trackFirebaseRead, getCostStats, costMonitor } from './costMonitor';

interface ProductionReadEvent {
  timestamp: number;
  endpoint: string;
  operation: string;
  readCount: number;
  userId?: string;
  cacheStatus: 'HIT' | 'MISS' | 'STALE';
  responseTime: number;
}

interface ProductionAnalysis {
  timeWindow: string;
  totalReads: number;
  readsPerMinute: number;
  uniqueUsers: number;
  topEndpoints: any[];
  suspiciousPatterns: any[];
  navigationPatterns: {
    rapidNavigationEvents: number;
    avgNavigationsPerSession: number;
    topNavigationPaths: string[];
  };
  optimizationOpportunities: {
    highReadEndpoints: string[];
    lowCacheHitRateEndpoints: string[];
    redundantQueries: string[];
    batchingOpportunities: string[];
  };
  costEstimate: {
    currentHourly: number;
    projectedDaily: number;
    projectedMonthly: number;
  };
}

class ProductionReadMonitorAdapter {
  /**
   * Record a production read event
   * @deprecated Use trackFirebaseRead from costMonitor.ts
   */
  recordRead(
    endpoint: string,
    operation: string,
    readCount: number = 1,
    metadata: {
      userId?: string;
      cacheStatus?: 'HIT' | 'MISS' | 'STALE';
      responseTime?: number;
    } = {}
  ): void {
    // Only track in production or when explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PRODUCTION_MONITORING === 'true') {
      trackFirebaseRead(endpoint, operation, readCount, metadata.cacheStatus || 'api');
    }
  }

  /**
   * Analyze production read patterns
   * @deprecated Use getCostStats from costMonitor.ts
   */
  analyzeProductionReads(): ProductionAnalysis {
    const stats = getCostStats();

    return {
      timeWindow: 'Last hour',
      totalReads: stats.totalOperations,
      readsPerMinute: Math.round(stats.totalOperations / 60),
      uniqueUsers: 0, // Not tracked in simplified version
      topEndpoints: Object.entries(stats.breakdown).map(([endpoint, cost]) => ({
        endpoint,
        totalReads: Math.round(cost / (0.00036 / 1000)),
        cacheHitRate: 0,
        recommendations: []
      })),
      suspiciousPatterns: stats.alerts.critical ? [{ message: 'High cost alert triggered' }] : [],
      navigationPatterns: {
        rapidNavigationEvents: 0,
        avgNavigationsPerSession: 0,
        topNavigationPaths: []
      },
      optimizationOpportunities: {
        highReadEndpoints: Object.keys(stats.breakdown).slice(0, 5),
        lowCacheHitRateEndpoints: [],
        redundantQueries: [],
        batchingOpportunities: []
      },
      costEstimate: {
        currentHourly: stats.hourlyCost,
        projectedDaily: stats.projectedDailyCost,
        projectedMonthly: stats.projectedDailyCost * 30
      }
    };
  }

  /**
   * Get recent events for debugging
   */
  getRecentEvents(_limit: number = 100): ProductionReadEvent[] {
    // Events not stored in simplified version
    return [];
  }

  /**
   * Clear all events
   */
  clear(): void {
    costMonitor.reset();
  }

  /**
   * Export data for external analysis
   */
  exportData() {
    return {
      events: [],
      analysis: this.analyzeProductionReads(),
      timestamp: Date.now()
    };
  }
}

// Global instance
export const productionReadMonitor = new ProductionReadMonitorAdapter();

// Convenience functions for backwards compatibility
export const recordProductionRead = (
  endpoint: string,
  operation: string,
  readCount: number = 1,
  metadata: any = {}
) => {
  productionReadMonitor.recordRead(endpoint, operation, readCount, metadata);
};

export const getProductionAnalysis = () => {
  return productionReadMonitor.analyzeProductionReads();
};

export const exportProductionData = () => {
  return productionReadMonitor.exportData();
};
