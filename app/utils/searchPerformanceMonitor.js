/**
 * Search Performance Monitor
 * 
 * Tracks search performance metrics to monitor optimization effectiveness
 */

class SearchPerformanceMonitor {
  constructor() {
    this.metrics = {
      totalSearches: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      searchesByType: {
        global: 0,
        linkEditor: 0,
        optimized: 0
      },
      searchTimesByType: {
        global: [],
        linkEditor: [],
        optimized: []
      },
      cacheMetrics: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      resultCounts: [],
      slowSearches: [], // Searches taking >1000ms
      recentSearches: [] // Last 10 searches for debugging
    };
  }

  /**
   * Record a search operation
   */
  recordSearch(type, searchTerm, duration, resultCount, cacheHit = false, source = 'unknown') {
    const searchRecord = {
      type,
      searchTerm,
      duration,
      resultCount,
      cacheHit,
      source,
      timestamp: Date.now()
    };

    // Update total metrics
    this.metrics.totalSearches++;
    this.metrics.totalSearchTime += duration;
    this.metrics.averageSearchTime = this.metrics.totalSearchTime / this.metrics.totalSearches;

    // Update type-specific metrics
    if (this.metrics.searchesByType[type] !== undefined) {
      this.metrics.searchesByType[type]++;
      this.metrics.searchTimesByType[type].push(duration);
      
      // Keep only last 100 searches per type for memory efficiency
      if (this.metrics.searchTimesByType[type].length > 100) {
        this.metrics.searchTimesByType[type] = this.metrics.searchTimesByType[type].slice(-100);
      }
    }

    // Update cache metrics
    if (cacheHit) {
      this.metrics.cacheMetrics.hits++;
    } else {
      this.metrics.cacheMetrics.misses++;
    }
    
    const totalCacheRequests = this.metrics.cacheMetrics.hits + this.metrics.cacheMetrics.misses;
    this.metrics.cacheMetrics.hitRate = totalCacheRequests > 0 
      ? (this.metrics.cacheMetrics.hits / totalCacheRequests * 100).toFixed(1) + '%'
      : '0%';

    // Track result counts
    this.metrics.resultCounts.push(resultCount);
    if (this.metrics.resultCounts.length > 100) {
      this.metrics.resultCounts = this.metrics.resultCounts.slice(-100);
    }

    // Track slow searches (>1000ms)
    if (duration > 1000) {
      this.metrics.slowSearches.push(searchRecord);
      // Keep only last 20 slow searches
      if (this.metrics.slowSearches.length > 20) {
        this.metrics.slowSearches = this.metrics.slowSearches.slice(-20);
      }
    }

    // Track recent searches for debugging
    this.metrics.recentSearches.push(searchRecord);
    if (this.metrics.recentSearches.length > 10) {
      this.metrics.recentSearches = this.metrics.recentSearches.slice(-10);
    }

    // Log performance warnings
    if (duration > 2000) {
      console.warn(`🐌 Very slow search detected: "${searchTerm}" took ${duration}ms (${type})`);
    } else if (duration > 1000) {
      console.warn(`⚠️ Slow search detected: "${searchTerm}" took ${duration}ms (${type})`);
    } else if (duration < 100) {
      console.log(`⚡ Fast search: "${searchTerm}" took ${duration}ms (${type})`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const stats = {
      ...this.metrics,
      typeAverages: {}
    };

    // Calculate average times by type
    for (const [type, times] of Object.entries(this.metrics.searchTimesByType)) {
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        stats.typeAverages[type] = {
          average: (sum / times.length).toFixed(1) + 'ms',
          min: Math.min(...times) + 'ms',
          max: Math.max(...times) + 'ms',
          count: times.length
        };
      }
    }

    // Calculate overall result statistics
    if (this.metrics.resultCounts.length > 0) {
      const sum = this.metrics.resultCounts.reduce((a, b) => a + b, 0);
      stats.resultStats = {
        averageResults: (sum / this.metrics.resultCounts.length).toFixed(1),
        minResults: Math.min(...this.metrics.resultCounts),
        maxResults: Math.max(...this.metrics.resultCounts)
      };
    }

    return stats;
  }

  /**
   * Get performance summary for logging
   */
  getSummary() {
    const stats = this.getStats();
    return {
      totalSearches: stats.totalSearches,
      averageTime: stats.averageSearchTime.toFixed(1) + 'ms',
      cacheHitRate: stats.cacheMetrics.hitRate,
      slowSearchCount: stats.slowSearches.length,
      typeBreakdown: stats.searchesByType
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      totalSearches: 0,
      totalSearchTime: 0,
      averageSearchTime: 0,
      searchesByType: {
        global: 0,
        linkEditor: 0,
        optimized: 0
      },
      searchTimesByType: {
        global: [],
        linkEditor: [],
        optimized: []
      },
      cacheMetrics: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      resultCounts: [],
      slowSearches: [],
      recentSearches: []
    };
  }

  /**
   * Log performance report to console
   */
  logReport() {
    const stats = this.getStats();
    console.group('🔍 Search Performance Report');
    console.log('Total Searches:', stats.totalSearches);
    console.log('Average Time:', stats.averageSearchTime.toFixed(1) + 'ms');
    console.log('Cache Hit Rate:', stats.cacheMetrics.hitRate);
    console.log('Slow Searches (>1s):', stats.slowSearches.length);
    
    console.group('By Type:');
    for (const [type, avg] of Object.entries(stats.typeAverages)) {
      console.log(`${type}:`, avg);
    }
    console.groupEnd();
    
    if (stats.slowSearches.length > 0) {
      console.group('Recent Slow Searches:');
      stats.slowSearches.slice(-5).forEach(search => {
        console.log(`"${search.searchTerm}" - ${search.duration}ms (${search.type})`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

// Create singleton instance
const searchPerformanceMonitor = new SearchPerformanceMonitor();

// Log performance report every 50 searches
let searchCount = 0;
const originalRecord = searchPerformanceMonitor.recordSearch.bind(searchPerformanceMonitor);
searchPerformanceMonitor.recordSearch = function(...args) {
  originalRecord(...args);
  searchCount++;
  if (searchCount % 50 === 0) {
    this.logReport();
  }
};

export default searchPerformanceMonitor;

/**
 * Helper function to time and record search operations
 */
export function timeSearch(searchFunction, type, searchTerm) {
  return async function(...args) {
    const startTime = Date.now();
    try {
      const result = await searchFunction(...args);
      const duration = Date.now() - startTime;
      const resultCount = Array.isArray(result?.pages) ? result.pages.length : 
                         Array.isArray(result) ? result.length : 0;
      const cacheHit = result?.source?.includes('cache') || false;
      const source = result?.source || 'unknown';
      
      searchPerformanceMonitor.recordSearch(type, searchTerm, duration, resultCount, cacheHit, source);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      searchPerformanceMonitor.recordSearch(type, searchTerm, duration, 0, false, 'error');
      throw error;
    }
  };
}

/**
 * Get current performance statistics
 */
export function getSearchPerformanceStats() {
  return searchPerformanceMonitor.getStats();
}

/**
 * Get performance summary
 */
export function getSearchPerformanceSummary() {
  return searchPerformanceMonitor.getSummary();
}
