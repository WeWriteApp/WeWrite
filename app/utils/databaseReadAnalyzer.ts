/**
 * Database Read Analyzer - Advanced Monitoring and Optimization
 * 
 * Provides detailed analysis of database read patterns to identify
 * and resolve high-volume read sources causing cost overruns.
 */

interface ReadEvent {
  endpoint: string;
  readCount: number;
  timestamp: number;
  responseTime: number;
  fromCache: boolean;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

interface ReadPattern {
  endpoint: string;
  totalReads: number;
  frequency: number; // reads per minute
  avgResponseTime: number;
  cacheHitRate: number;
  lastSeen: number;
  suspiciousActivity: boolean;
  recommendations: string[];
}

interface ReadAnalysis {
  totalReads: number;
  readsPerMinute: number;
  topOffenders: ReadPattern[];
  suspiciousPatterns: ReadPattern[];
  costEstimate: number;
  recommendations: string[];
  timestamp: number;
}

class DatabaseReadAnalyzer {
  private events: ReadEvent[] = [];
  private readonly MAX_EVENTS = 10000; // Keep last 10k events
  private readonly ANALYSIS_WINDOW = 5 * 60 * 1000; // 5 minutes
  private readonly SUSPICIOUS_THRESHOLD = 100; // reads per minute per endpoint

  /**
   * Record a database read event
   */
  recordRead(
    endpoint: string,
    readCount: number = 1,
    responseTime: number = 0,
    fromCache: boolean = false,
    userId?: string,
    sessionId?: string
  ): void {
    const event: ReadEvent = {
      endpoint,
      readCount,
      timestamp: Date.now(),
      responseTime,
      fromCache,
      userId,
      sessionId,
      stackTrace: this.captureStackTrace()
    };

    this.events.push(event);

    // Trim events to prevent memory issues
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log suspicious activity immediately
    if (readCount > 50) {
      console.warn(`🚨 HIGH READ COUNT: ${endpoint} - ${readCount} reads from ${userId || 'anonymous'}`);
    }
  }

  /**
   * Analyze read patterns and identify issues
   */
  analyzeReads(): ReadAnalysis {
    const now = Date.now();
    const windowStart = now - this.ANALYSIS_WINDOW;
    
    // Filter events to analysis window
    const recentEvents = this.events.filter(event => event.timestamp >= windowStart);
    
    // Group by endpoint
    const endpointStats = new Map<string, {
      reads: number;
      responseTime: number;
      cacheHits: number;
      cacheMisses: number;
      events: ReadEvent[];
    }>();

    let totalReads = 0;

    for (const event of recentEvents) {
      totalReads += event.readCount;
      
      const stats = endpointStats.get(event.endpoint) || {
        reads: 0,
        responseTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        events: []
      };

      stats.reads += event.readCount;
      stats.responseTime += event.responseTime;
      stats.events.push(event);
      
      if (event.fromCache) {
        stats.cacheHits++;
      } else {
        stats.cacheMisses++;
      }

      endpointStats.set(event.endpoint, stats);
    }

    // Convert to patterns and analyze
    const patterns: ReadPattern[] = [];
    const suspiciousPatterns: ReadPattern[] = [];

    for (const [endpoint, stats] of endpointStats.entries()) {
      const frequency = (stats.reads / this.ANALYSIS_WINDOW) * 60 * 1000; // per minute
      const avgResponseTime = stats.responseTime / stats.events.length;
      const cacheHitRate = stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100;
      
      const pattern: ReadPattern = {
        endpoint,
        totalReads: stats.reads,
        frequency,
        avgResponseTime,
        cacheHitRate,
        lastSeen: Math.max(...stats.events.map(e => e.timestamp)),
        suspiciousActivity: frequency > this.SUSPICIOUS_THRESHOLD,
        recommendations: this.generateRecommendations(endpoint, stats, frequency, cacheHitRate)
      };

      patterns.push(pattern);

      if (pattern.suspiciousActivity) {
        suspiciousPatterns.push(pattern);
      }
    }

    // Sort by total reads
    patterns.sort((a, b) => b.totalReads - a.totalReads);
    suspiciousPatterns.sort((a, b) => b.frequency - a.frequency);

    const readsPerMinute = (totalReads / this.ANALYSIS_WINDOW) * 60 * 1000;
    const costEstimate = totalReads * 0.00036 / 1000; // Firestore pricing

    return {
      totalReads,
      readsPerMinute,
      topOffenders: patterns.slice(0, 10),
      suspiciousPatterns,
      costEstimate,
      recommendations: this.generateGlobalRecommendations(patterns, readsPerMinute),
      timestamp: now
    };
  }

  /**
   * Generate recommendations for specific endpoint
   */
  private generateRecommendations(
    endpoint: string,
    stats: any,
    frequency: number,
    cacheHitRate: number
  ): string[] {
    const recommendations: string[] = [];

    if (frequency > 200) {
      recommendations.push(`CRITICAL: ${frequency.toFixed(1)} reads/min - implement aggressive caching`);
    } else if (frequency > 100) {
      recommendations.push(`HIGH: ${frequency.toFixed(1)} reads/min - add request deduplication`);
    }

    if (cacheHitRate < 30) {
      recommendations.push(`LOW CACHE HIT RATE: ${cacheHitRate.toFixed(1)}% - increase cache TTL`);
    }

    if (stats.responseTime / stats.events.length > 1000) {
      recommendations.push(`SLOW QUERIES: ${(stats.responseTime / stats.events.length).toFixed(0)}ms avg - optimize database queries`);
    }

    // Endpoint-specific recommendations
    if (endpoint.includes('visitor-tracking')) {
      recommendations.push('Consider batching visitor updates or reducing tracking frequency');
    }

    if (endpoint.includes('pledge-bar') || endpoint.includes('allocation')) {
      recommendations.push('Implement optimistic updates with background sync');
    }

    if (endpoint.includes('recent-edits') || endpoint.includes('activity')) {
      recommendations.push('Use smart polling with exponential backoff');
    }

    return recommendations;
  }

  /**
   * Generate global recommendations
   */
  private generateGlobalRecommendations(patterns: ReadPattern[], readsPerMinute: number): string[] {
    const recommendations: string[] = [];

    if (readsPerMinute > 1000) {
      recommendations.push('EMERGENCY: Implement circuit breakers to prevent API spam');
      recommendations.push('URGENT: Add global rate limiting per user/session');
    }

    if (readsPerMinute > 500) {
      recommendations.push('HIGH: Implement request batching for related operations');
      recommendations.push('HIGH: Add global cache layer (Redis/Memcached)');
    }

    const lowCacheEndpoints = patterns.filter(p => p.cacheHitRate < 50 && p.totalReads > 10);
    if (lowCacheEndpoints.length > 0) {
      recommendations.push(`CACHING: ${lowCacheEndpoints.length} endpoints have low cache hit rates`);
    }

    const highFrequencyEndpoints = patterns.filter(p => p.frequency > 100);
    if (highFrequencyEndpoints.length > 0) {
      recommendations.push(`FREQUENCY: ${highFrequencyEndpoints.length} endpoints exceed 100 reads/min`);
    }

    return recommendations;
  }

  /**
   * Capture stack trace for debugging
   */
  private captureStackTrace(): string {
    try {
      const stack = new Error().stack;
      return stack?.split('\n').slice(2, 5).join('\n') || '';
    } catch {
      return '';
    }
  }

  /**
   * Get detailed report for specific endpoint
   */
  getEndpointReport(endpoint: string): any {
    const events = this.events.filter(e => e.endpoint === endpoint);
    const recentEvents = events.filter(e => e.timestamp >= Date.now() - this.ANALYSIS_WINDOW);

    return {
      endpoint,
      totalEvents: events.length,
      recentEvents: recentEvents.length,
      totalReads: recentEvents.reduce((sum, e) => sum + e.readCount, 0),
      avgResponseTime: recentEvents.reduce((sum, e) => sum + e.responseTime, 0) / recentEvents.length,
      cacheHitRate: recentEvents.filter(e => e.fromCache).length / recentEvents.length * 100,
      uniqueUsers: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
      uniqueSessions: new Set(recentEvents.map(e => e.sessionId).filter(Boolean)).size,
      timeline: this.generateTimeline(recentEvents)
    };
  }

  /**
   * Generate timeline of reads for visualization
   */
  private generateTimeline(events: ReadEvent[]): any[] {
    const buckets = new Map<number, number>();
    const bucketSize = 30 * 1000; // 30 second buckets

    for (const event of events) {
      const bucket = Math.floor(event.timestamp / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + event.readCount);
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, reads]) => ({ timestamp, reads }));
  }

  /**
   * Clear old events
   */
  clearOldEvents(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.events = this.events.filter(event => event.timestamp >= cutoff);
  }

  /**
   * Export data for external analysis
   */
  exportData(): any {
    return {
      events: this.events,
      analysis: this.analyzeReads(),
      timestamp: Date.now()
    };
  }
}

// Singleton instance
export const databaseReadAnalyzer = new DatabaseReadAnalyzer();

// Convenience functions
export const recordDatabaseRead = (
  endpoint: string,
  readCount: number = 1,
  responseTime: number = 0,
  fromCache: boolean = false,
  userId?: string,
  sessionId?: string
) => {
  databaseReadAnalyzer.recordRead(endpoint, readCount, responseTime, fromCache, userId, sessionId);
};

export const analyzeDatabaseReads = () => databaseReadAnalyzer.analyzeReads();
export const getEndpointReport = (endpoint: string) => databaseReadAnalyzer.getEndpointReport(endpoint);
export const exportReadData = () => databaseReadAnalyzer.exportData();
