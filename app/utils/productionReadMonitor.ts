/**
 * Production Database Read Monitor
 * 
 * Real-time monitoring system specifically designed to track production
 * Firebase reads and identify optimization opportunities.
 * 
 * This system helps identify the root causes of the 25k reads/minute spikes
 * by tracking actual production usage patterns.
 */

interface ProductionReadEvent {
  timestamp: number;
  endpoint: string;
  operation: string;
  readCount: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  referer?: string;
  cacheStatus: 'HIT' | 'MISS' | 'STALE';
  responseTime: number;
  stackTrace?: string;
}

interface ReadPattern {
  endpoint: string;
  totalReads: number;
  uniqueUsers: number;
  avgReadsPerUser: number;
  peakReadsPerMinute: number;
  cacheHitRate: number;
  avgResponseTime: number;
  suspiciousActivity: boolean;
  recommendations: string[];
}

interface ProductionAnalysis {
  timeWindow: string;
  totalReads: number;
  readsPerMinute: number;
  uniqueUsers: number;
  topEndpoints: ReadPattern[];
  suspiciousPatterns: ReadPattern[];
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

class ProductionReadMonitor {
  private events: ProductionReadEvent[] = [];
  private readonly MAX_EVENTS = 10000; // Keep last 10k events
  private readonly ANALYSIS_WINDOW = 60 * 60 * 1000; // 1 hour
  private readonly SUSPICIOUS_READS_PER_MINUTE = 100; // Flag endpoints with >100 reads/min
  
  /**
   * Record a production read event
   */
  recordRead(
    endpoint: string,
    operation: string,
    readCount: number = 1,
    metadata: {
      userId?: string;
      sessionId?: string;
      userAgent?: string;
      referer?: string;
      cacheStatus?: 'HIT' | 'MISS' | 'STALE';
      responseTime?: number;
    } = {}
  ): void {
    const event: ProductionReadEvent = {
      timestamp: Date.now(),
      endpoint,
      operation,
      readCount,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      userAgent: metadata.userAgent,
      referer: metadata.referer,
      cacheStatus: metadata.cacheStatus || 'MISS',
      responseTime: metadata.responseTime || 0,
      stackTrace: this.captureStackTrace()
    };

    this.events.push(event);

    // Trim events to prevent memory issues
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log high-read operations immediately
    if (readCount > 50) {
      console.warn(`🚨 HIGH READ COUNT: ${endpoint} - ${readCount} reads from ${metadata.userId || 'anonymous'}`);
    }

    // Log suspicious rapid reads from same user/session
    if (metadata.userId || metadata.sessionId) {
      const identifier = metadata.userId || metadata.sessionId;
      const recentEvents = this.events.filter(e => 
        (e.userId === identifier || e.sessionId === identifier) &&
        e.timestamp > Date.now() - 60000 // Last minute
      );
      
      if (recentEvents.length > 20) {
        console.warn(`🚨 RAPID READS: ${identifier} made ${recentEvents.length} reads in last minute`);
      }
    }
  }

  /**
   * Analyze production read patterns
   */
  analyzeProductionReads(): ProductionAnalysis {
    const now = Date.now();
    const windowStart = now - this.ANALYSIS_WINDOW;
    
    // Filter events to analysis window
    const windowEvents = this.events.filter(e => e.timestamp >= windowStart);
    
    if (windowEvents.length === 0) {
      return this.getEmptyAnalysis();
    }

    // Group events by endpoint
    const endpointStats = new Map<string, {
      events: ProductionReadEvent[];
      totalReads: number;
      uniqueUsers: Set<string>;
      cacheHits: number;
      cacheMisses: number;
      totalResponseTime: number;
    }>();

    windowEvents.forEach(event => {
      const key = event.endpoint;
      if (!endpointStats.has(key)) {
        endpointStats.set(key, {
          events: [],
          totalReads: 0,
          uniqueUsers: new Set(),
          cacheHits: 0,
          cacheMisses: 0,
          totalResponseTime: 0
        });
      }

      const stats = endpointStats.get(key)!;
      stats.events.push(event);
      stats.totalReads += event.readCount;
      if (event.userId) stats.uniqueUsers.add(event.userId);
      if (event.cacheStatus === 'HIT') stats.cacheHits++;
      else stats.cacheMisses++;
      stats.totalResponseTime += event.responseTime;
    });

    // Analyze patterns
    const patterns: ReadPattern[] = [];
    const suspiciousPatterns: ReadPattern[] = [];

    for (const [endpoint, stats] of endpointStats.entries()) {
      const readsPerMinute = (stats.totalReads / this.ANALYSIS_WINDOW) * 60 * 1000;
      const avgResponseTime = stats.totalResponseTime / stats.events.length;
      const cacheHitRate = (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100;
      
      const pattern: ReadPattern = {
        endpoint,
        totalReads: stats.totalReads,
        uniqueUsers: stats.uniqueUsers.size,
        avgReadsPerUser: stats.totalReads / Math.max(stats.uniqueUsers.size, 1),
        peakReadsPerMinute: readsPerMinute,
        cacheHitRate,
        avgResponseTime,
        suspiciousActivity: readsPerMinute > this.SUSPICIOUS_READS_PER_MINUTE,
        recommendations: this.generateRecommendations(endpoint, stats, readsPerMinute, cacheHitRate)
      };

      patterns.push(pattern);

      if (pattern.suspiciousActivity) {
        suspiciousPatterns.push(pattern);
      }
    }

    // Sort patterns by total reads
    patterns.sort((a, b) => b.totalReads - a.totalReads);
    suspiciousPatterns.sort((a, b) => b.peakReadsPerMinute - a.peakReadsPerMinute);

    const totalReads = windowEvents.reduce((sum, e) => sum + e.readCount, 0);
    const readsPerMinute = (totalReads / this.ANALYSIS_WINDOW) * 60 * 1000;
    const uniqueUsers = new Set(windowEvents.map(e => e.userId).filter(Boolean)).size;

    return {
      timeWindow: `${new Date(windowStart).toISOString()} - ${new Date(now).toISOString()}`,
      totalReads,
      readsPerMinute,
      uniqueUsers,
      topEndpoints: patterns.slice(0, 10),
      suspiciousPatterns,
      navigationPatterns: this.analyzeNavigationPatterns(windowEvents),
      optimizationOpportunities: this.identifyOptimizationOpportunities(patterns),
      costEstimate: this.calculateCostEstimate(totalReads, readsPerMinute)
    };
  }

  private captureStackTrace(): string {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 5).join('\n') : '';
  }

  private generateRecommendations(
    endpoint: string, 
    stats: any, 
    readsPerMinute: number, 
    cacheHitRate: number
  ): string[] {
    const recommendations: string[] = [];

    if (readsPerMinute > 100) {
      recommendations.push('HIGH PRIORITY: Implement aggressive caching');
    }

    if (cacheHitRate < 50) {
      recommendations.push('Improve cache hit rate with longer TTLs');
    }

    if (endpoint.includes('/search')) {
      recommendations.push('Consider search result caching and debouncing');
    }

    if (endpoint.includes('/user/') || endpoint.includes('/profile')) {
      recommendations.push('Implement user profile caching with background refresh');
    }

    if (stats.avgReadsPerUser > 10) {
      recommendations.push('Implement request deduplication for rapid navigation');
    }

    return recommendations;
  }

  private analyzeNavigationPatterns(events: ProductionReadEvent[]) {
    // Analyze navigation-specific patterns
    const navigationEvents = events.filter(e => 
      e.referer && (
        e.endpoint.includes('/home') ||
        e.endpoint.includes('/search') ||
        e.endpoint.includes('/user/') ||
        e.endpoint.includes('/profile')
      )
    );

    const sessionNavigations = new Map<string, number>();
    navigationEvents.forEach(e => {
      if (e.sessionId) {
        sessionNavigations.set(e.sessionId, (sessionNavigations.get(e.sessionId) || 0) + 1);
      }
    });

    const rapidNavigationEvents = Array.from(sessionNavigations.values()).filter(count => count > 10).length;
    const avgNavigationsPerSession = Array.from(sessionNavigations.values()).reduce((a, b) => a + b, 0) / sessionNavigations.size || 0;

    return {
      rapidNavigationEvents,
      avgNavigationsPerSession,
      topNavigationPaths: this.getTopNavigationPaths(events)
    };
  }

  private getTopNavigationPaths(events: ProductionReadEvent[]): string[] {
    const pathCounts = new Map<string, number>();
    events.forEach(e => {
      pathCounts.set(e.endpoint, (pathCounts.get(e.endpoint) || 0) + 1);
    });

    return Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path]) => path);
  }

  private identifyOptimizationOpportunities(patterns: ReadPattern[]) {
    return {
      highReadEndpoints: patterns
        .filter(p => p.totalReads > 1000)
        .map(p => p.endpoint),
      lowCacheHitRateEndpoints: patterns
        .filter(p => p.cacheHitRate < 50)
        .map(p => p.endpoint),
      redundantQueries: patterns
        .filter(p => p.avgReadsPerUser > 5)
        .map(p => p.endpoint),
      batchingOpportunities: patterns
        .filter(p => p.endpoint.includes('/user/') && p.uniqueUsers > 10)
        .map(p => p.endpoint)
    };
  }

  private calculateCostEstimate(totalReads: number, readsPerMinute: number) {
    const costPerRead = 0.00036 / 1000; // Firestore pricing per read
    const currentHourly = totalReads * costPerRead;
    const projectedDaily = readsPerMinute * 60 * 24 * costPerRead;
    const projectedMonthly = projectedDaily * 30;

    return {
      currentHourly,
      projectedDaily,
      projectedMonthly
    };
  }

  private getEmptyAnalysis(): ProductionAnalysis {
    return {
      timeWindow: 'No data available',
      totalReads: 0,
      readsPerMinute: 0,
      uniqueUsers: 0,
      topEndpoints: [],
      suspiciousPatterns: [],
      navigationPatterns: {
        rapidNavigationEvents: 0,
        avgNavigationsPerSession: 0,
        topNavigationPaths: []
      },
      optimizationOpportunities: {
        highReadEndpoints: [],
        lowCacheHitRateEndpoints: [],
        redundantQueries: [],
        batchingOpportunities: []
      },
      costEstimate: {
        currentHourly: 0,
        projectedDaily: 0,
        projectedMonthly: 0
      }
    };
  }

  /**
   * Get recent events for debugging
   */
  getRecentEvents(limit: number = 100): ProductionReadEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events = [];
    console.log('🔄 Production read monitor cleared');
  }

  /**
   * Export data for external analysis
   */
  exportData() {
    return {
      events: this.events,
      analysis: this.analyzeProductionReads(),
      timestamp: Date.now()
    };
  }
}

// Global instance
export const productionReadMonitor = new ProductionReadMonitor();

// Convenience functions
export const recordProductionRead = (
  endpoint: string,
  operation: string,
  readCount: number = 1,
  metadata: any = {}
) => {
  // Only track in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PRODUCTION_MONITORING === 'true') {
    productionReadMonitor.recordRead(endpoint, operation, readCount, metadata);
  }
};

export const getProductionAnalysis = () => {
  return productionReadMonitor.analyzeProductionReads();
};

export const exportProductionData = () => {
  return productionReadMonitor.exportData();
};
