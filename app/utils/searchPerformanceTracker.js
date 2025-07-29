/**
 * OPTIMIZED: Enhanced Search Performance Tracker
 * 
 * Comprehensive performance monitoring for search operations with
 * detailed metrics, bottleneck identification, and optimization suggestions.
 */

class SearchPerformanceTracker {
  constructor() {
    this.metrics = {
      totalSearches: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      fastSearches: 0, // < 200ms
      normalSearches: 0, // 200-500ms
      slowSearches: 0, // 500-1000ms
      verySlowSearches: 0, // > 1000ms
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      apiErrors: 0,
      timeouts: 0
    };

    this.recentSearches = [];
    this.slowSearches = [];
    this.searchPatterns = new Map(); // Track common search patterns
    this.performanceAlerts = [];
    
    // Performance thresholds
    this.thresholds = {
      fast: 200,
      normal: 500,
      slow: 1000,
      timeout: 10000
    };
  }

  /**
   * OPTIMIZATION: Record search performance with detailed metrics
   */
  recordSearch(searchTerm, startTime, endTime, resultCount, cacheHit = false, source = 'api', error = null) {
    const duration = endTime - startTime;
    const timestamp = new Date().toISOString();
    
    // Update basic metrics
    this.metrics.totalSearches++;
    this.metrics.totalSearchTime += duration;
    this.metrics.averageSearchTime = Math.round(this.metrics.totalSearchTime / this.metrics.totalSearches);
    
    // Categorize search speed
    if (duration < this.thresholds.fast) {
      this.metrics.fastSearches++;
    } else if (duration < this.thresholds.normal) {
      this.metrics.normalSearches++;
    } else if (duration < this.thresholds.slow) {
      this.metrics.slowSearches++;
    } else {
      this.metrics.verySlowSearches++;
    }
    
    // Update cache metrics
    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    this.metrics.cacheHitRate = Math.round((this.metrics.cacheHits / this.metrics.totalSearches) * 100);
    
    // Track errors
    if (error) {
      this.metrics.apiErrors++;
      if (duration > this.thresholds.timeout) {
        this.metrics.timeouts++;
      }
    }
    
    // Record search details
    const searchRecord = {
      searchTerm: searchTerm.substring(0, 100), // Limit for privacy
      duration,
      resultCount,
      cacheHit,
      source,
      error: error ? error.message : null,
      timestamp
    };
    
    // Track recent searches (last 50)
    this.recentSearches.unshift(searchRecord);
    if (this.recentSearches.length > 50) {
      this.recentSearches = this.recentSearches.slice(0, 50);
    }
    
    // Track slow searches for analysis
    if (duration > this.thresholds.slow) {
      this.slowSearches.unshift(searchRecord);
      if (this.slowSearches.length > 20) {
        this.slowSearches = this.slowSearches.slice(0, 20);
      }
    }
    
    // Track search patterns
    const pattern = this._getSearchPattern(searchTerm);
    const patternStats = this.searchPatterns.get(pattern) || { count: 0, totalTime: 0, avgTime: 0 };
    patternStats.count++;
    patternStats.totalTime += duration;
    patternStats.avgTime = Math.round(patternStats.totalTime / patternStats.count);
    this.searchPatterns.set(pattern, patternStats);
    
    // Generate performance alerts
    this._checkPerformanceAlerts(searchRecord);
    
    // Log performance
    this._logPerformance(searchRecord);
  }

  /**
   * OPTIMIZATION: Analyze search patterns for optimization opportunities
   */
  _getSearchPattern(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (term.length === 0) return 'empty';
    if (term.length === 1) return 'single-char';
    if (term.length === 2) return 'two-char';
    if (term.length <= 5) return 'short';
    if (term.length <= 10) return 'medium';
    if (term.length <= 20) return 'long';
    return 'very-long';
  }

  /**
   * OPTIMIZATION: Check for performance issues and generate alerts
   */
  _checkPerformanceAlerts(searchRecord) {
    const { duration, searchTerm, cacheHit } = searchRecord;
    
    // Very slow search alert
    if (duration > this.thresholds.slow) {
      this.performanceAlerts.unshift({
        type: 'slow-search',
        severity: duration > 2000 ? 'critical' : 'warning',
        message: `Slow search detected: "${searchTerm}" took ${duration}ms`,
        timestamp: new Date().toISOString(),
        suggestions: [
          'Consider adding more specific search indexes',
          'Implement search result pagination',
          'Add search term preprocessing'
        ]
      });
    }
    
    // Low cache hit rate alert
    if (this.metrics.totalSearches > 10 && this.metrics.cacheHitRate < 30) {
      this.performanceAlerts.unshift({
        type: 'low-cache-hit-rate',
        severity: 'warning',
        message: `Low cache hit rate: ${this.metrics.cacheHitRate}%`,
        timestamp: new Date().toISOString(),
        suggestions: [
          'Increase cache TTL for stable results',
          'Implement smarter cache key generation',
          'Add cache warming for common searches'
        ]
      });
    }
    
    // Keep only recent alerts
    if (this.performanceAlerts.length > 10) {
      this.performanceAlerts = this.performanceAlerts.slice(0, 10);
    }
  }

  /**
   * OPTIMIZATION: Smart performance logging
   */
  _logPerformance(searchRecord) {
    const { duration, searchTerm, cacheHit, resultCount } = searchRecord;
    
    if (duration > 2000) {
      console.error(`🐌 CRITICAL: Very slow search "${searchTerm}" took ${duration}ms`);
    } else if (duration > this.thresholds.slow) {
      console.warn(`⚠️ Slow search "${searchTerm}" took ${duration}ms`);
    } else if (duration < this.thresholds.fast && cacheHit) {
      console.log(`⚡ Fast cached search "${searchTerm}" took ${duration}ms (${resultCount} results)`);
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getStats() {
    return {
      ...this.metrics,
      recentSearches: this.recentSearches.slice(0, 10),
      slowSearches: this.slowSearches.slice(0, 5),
      searchPatterns: Object.fromEntries(this.searchPatterns),
      performanceAlerts: this.performanceAlerts.slice(0, 5),
      recommendations: this._getRecommendations()
    };
  }

  /**
   * OPTIMIZATION: Generate performance recommendations
   */
  _getRecommendations() {
    const recommendations = [];
    
    if (this.metrics.cacheHitRate < 40) {
      recommendations.push({
        type: 'caching',
        priority: 'high',
        message: 'Improve cache hit rate by optimizing cache keys and TTL'
      });
    }
    
    if (this.metrics.verySlowSearches > this.metrics.totalSearches * 0.1) {
      recommendations.push({
        type: 'indexing',
        priority: 'critical',
        message: 'Add database indexes for common search patterns'
      });
    }
    
    if (this.metrics.averageSearchTime > 800) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        message: 'Implement search result pagination and query optimization'
      });
    }
    
    return recommendations;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      totalSearches: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      fastSearches: 0,
      normalSearches: 0,
      slowSearches: 0,
      verySlowSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      apiErrors: 0,
      timeouts: 0
    };
    
    this.recentSearches = [];
    this.slowSearches = [];
    this.searchPatterns.clear();
    this.performanceAlerts = [];
  }
}

// Export singleton instance
export const searchPerformanceTracker = new SearchPerformanceTracker();

/**
 * OPTIMIZATION: Wrapper function to automatically track search performance
 */
export function trackSearchPerformance(searchFunction) {
  return async function(searchTerm, ...args) {
    const startTime = Date.now();
    let error = null;
    let resultCount = 0;
    let cacheHit = false;
    
    try {
      const result = await searchFunction(searchTerm, ...args);
      resultCount = Array.isArray(result) ? result.length : (result?.pages?.length || 0);
      cacheHit = result?.source?.includes('cache') || false;
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const endTime = Date.now();
      searchPerformanceTracker.recordSearch(
        searchTerm,
        startTime,
        endTime,
        resultCount,
        cacheHit,
        'api',
        error
      );
    }
  };
}
