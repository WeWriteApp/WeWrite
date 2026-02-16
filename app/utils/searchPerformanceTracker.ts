interface PerformanceMetrics {
  totalSearches: number;
  totalSearchTime: number;
  averageSearchTime: number;
  fastSearches: number;
  normalSearches: number;
  slowSearches: number;
  verySlowSearches: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  apiErrors: number;
  timeouts: number;
}

interface SearchRecord {
  searchTerm: string;
  duration: number;
  resultCount: number;
  cacheHit: boolean;
  source: string;
  error: string | null;
  timestamp: string;
}

interface PerformanceAlert {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  suggestions: string[];
}

interface PatternStats {
  count: number;
  totalTime: number;
  avgTime: number;
}

interface Recommendation {
  type: string;
  priority: 'high' | 'critical';
  message: string;
}

interface PerformanceThresholds {
  fast: number;
  normal: number;
  slow: number;
  timeout: number;
}

class SearchPerformanceTracker {
  private metrics: PerformanceMetrics;
  private recentSearches: SearchRecord[];
  private slowSearchesList: SearchRecord[];
  private searchPatterns: Map<string, PatternStats>;
  private performanceAlerts: PerformanceAlert[];
  private thresholds: PerformanceThresholds;

  constructor() {
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
    this.slowSearchesList = [];
    this.searchPatterns = new Map();
    this.performanceAlerts = [];

    this.thresholds = {
      fast: 200,
      normal: 500,
      slow: 1000,
      timeout: 10000
    };
  }

  recordSearch(
    searchTerm: string,
    startTime: number,
    endTime: number,
    resultCount: number,
    cacheHit = false,
    source = 'api',
    error: Error | null = null
  ): void {
    const duration = endTime - startTime;
    const timestamp = new Date().toISOString();

    this.metrics.totalSearches++;
    this.metrics.totalSearchTime += duration;
    this.metrics.averageSearchTime = Math.round(this.metrics.totalSearchTime / this.metrics.totalSearches);

    if (duration < this.thresholds.fast) {
      this.metrics.fastSearches++;
    } else if (duration < this.thresholds.normal) {
      this.metrics.normalSearches++;
    } else if (duration < this.thresholds.slow) {
      this.metrics.slowSearches++;
    } else {
      this.metrics.verySlowSearches++;
    }

    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    this.metrics.cacheHitRate = Math.round((this.metrics.cacheHits / this.metrics.totalSearches) * 100);

    if (error) {
      this.metrics.apiErrors++;
      if (duration > this.thresholds.timeout) {
        this.metrics.timeouts++;
      }
    }

    const searchRecord: SearchRecord = {
      searchTerm: searchTerm.substring(0, 100),
      duration,
      resultCount,
      cacheHit,
      source,
      error: error ? error.message : null,
      timestamp
    };

    this.recentSearches.unshift(searchRecord);
    if (this.recentSearches.length > 50) {
      this.recentSearches = this.recentSearches.slice(0, 50);
    }

    if (duration > this.thresholds.slow) {
      this.slowSearchesList.unshift(searchRecord);
      if (this.slowSearchesList.length > 20) {
        this.slowSearchesList = this.slowSearchesList.slice(0, 20);
      }
    }

    const pattern = this.getSearchPattern(searchTerm);
    const patternStats = this.searchPatterns.get(pattern) || { count: 0, totalTime: 0, avgTime: 0 };
    patternStats.count++;
    patternStats.totalTime += duration;
    patternStats.avgTime = Math.round(patternStats.totalTime / patternStats.count);
    this.searchPatterns.set(pattern, patternStats);

    this.checkPerformanceAlerts(searchRecord);
    this.logPerformance(searchRecord);
  }

  private getSearchPattern(searchTerm: string): string {
    const term = searchTerm.toLowerCase().trim();

    if (term.length === 0) return 'empty';
    if (term.length === 1) return 'single-char';
    if (term.length === 2) return 'two-char';
    if (term.length <= 5) return 'short';
    if (term.length <= 10) return 'medium';
    if (term.length <= 20) return 'long';
    return 'very-long';
  }

  private checkPerformanceAlerts(searchRecord: SearchRecord): void {
    const { duration, searchTerm } = searchRecord;

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

    if (this.performanceAlerts.length > 10) {
      this.performanceAlerts = this.performanceAlerts.slice(0, 10);
    }
  }

  private logPerformance(searchRecord: SearchRecord): void {
    const { duration, searchTerm, cacheHit, resultCount } = searchRecord;

    if (duration > 2000) {
      console.error(`🐌 CRITICAL: Very slow search "${searchTerm}" took ${duration}ms`);
    } else if (duration > this.thresholds.slow) {
      console.warn(`⚠️ Slow search "${searchTerm}" took ${duration}ms`);
    } else if (duration < this.thresholds.fast && cacheHit) {
    }
  }

  getStats(): PerformanceMetrics & {
    recentSearches: SearchRecord[];
    slowSearches: SearchRecord[];
    searchPatterns: Record<string, PatternStats>;
    performanceAlerts: PerformanceAlert[];
    recommendations: Recommendation[];
  } {
    return {
      ...this.metrics,
      recentSearches: this.recentSearches.slice(0, 10),
      slowSearches: this.slowSearchesList.slice(0, 5),
      searchPatterns: Object.fromEntries(this.searchPatterns),
      performanceAlerts: this.performanceAlerts.slice(0, 5),
      recommendations: this.getRecommendations()
    };
  }

  private getRecommendations(): Recommendation[] {
    const recommendations: Recommendation[] = [];

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

  reset(): void {
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
    this.slowSearchesList = [];
    this.searchPatterns.clear();
    this.performanceAlerts = [];
  }
}

export const searchPerformanceTracker = new SearchPerformanceTracker();

type SearchFunction<T> = (searchTerm: string, ...args: unknown[]) => Promise<T>;

interface SearchResult {
  pages?: unknown[];
  source?: string;
  [key: string]: unknown;
}

export function trackSearchPerformance<T extends SearchResult | unknown[]>(
  searchFunction: SearchFunction<T>
): SearchFunction<T> {
  return async function (searchTerm: string, ...args: unknown[]): Promise<T> {
    const startTime = Date.now();
    let error: Error | null = null;
    let resultCount = 0;
    let cacheHit = false;

    try {
      const result = await searchFunction(searchTerm, ...args);
      if (Array.isArray(result)) {
        resultCount = result.length;
      } else if (result && typeof result === 'object' && 'pages' in result) {
        resultCount = Array.isArray(result.pages) ? result.pages.length : 0;
      }
      if (result && typeof result === 'object' && 'source' in result) {
        cacheHit = typeof result.source === 'string' && result.source.includes('cache');
      }
      return result;
    } catch (err) {
      error = err as Error;
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
