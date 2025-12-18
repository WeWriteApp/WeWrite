interface SearchRecord {
  type: string;
  searchTerm: string;
  duration: number;
  resultCount: number;
  cacheHit: boolean;
  source: string;
  timestamp: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number | string;
}

interface SearchMetrics {
  totalSearches: number;
  totalSearchTime: number;
  averageSearchTime: number;
  searchesByType: {
    global: number;
    linkEditor: number;
    optimized: number;
  };
  searchTimesByType: {
    global: number[];
    linkEditor: number[];
    optimized: number[];
  };
  cacheMetrics: CacheMetrics;
  resultCounts: number[];
  slowSearches: SearchRecord[];
  recentSearches: SearchRecord[];
}

interface TypeAverage {
  average: string;
  min: string;
  max: string;
  count: number;
}

interface ResultStats {
  averageResults: string;
  minResults: number;
  maxResults: number;
}

interface PerformanceStats extends SearchMetrics {
  typeAverages: Record<string, TypeAverage>;
  resultStats?: ResultStats;
}

interface PerformanceSummary {
  totalSearches: number;
  averageTime: string;
  cacheHitRate: number | string;
  slowSearchCount: number;
  typeBreakdown: {
    global: number;
    linkEditor: number;
    optimized: number;
  };
}

class SearchPerformanceMonitor {
  private metrics: SearchMetrics;

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
      slowSearches: [],
      recentSearches: []
    };
  }

  recordSearch(
    type: keyof SearchMetrics['searchesByType'],
    searchTerm: string,
    duration: number,
    resultCount: number,
    cacheHit = false,
    source = 'unknown'
  ): void {
    const searchRecord: SearchRecord = {
      type,
      searchTerm,
      duration,
      resultCount,
      cacheHit,
      source,
      timestamp: Date.now()
    };

    this.metrics.totalSearches++;
    this.metrics.totalSearchTime += duration;
    this.metrics.averageSearchTime = this.metrics.totalSearchTime / this.metrics.totalSearches;

    if (this.metrics.searchesByType[type] !== undefined) {
      this.metrics.searchesByType[type]++;
      this.metrics.searchTimesByType[type].push(duration);

      if (this.metrics.searchTimesByType[type].length > 100) {
        this.metrics.searchTimesByType[type] = this.metrics.searchTimesByType[type].slice(-100);
      }
    }

    if (cacheHit) {
      this.metrics.cacheMetrics.hits++;
    } else {
      this.metrics.cacheMetrics.misses++;
    }

    const totalCacheRequests = this.metrics.cacheMetrics.hits + this.metrics.cacheMetrics.misses;
    this.metrics.cacheMetrics.hitRate = totalCacheRequests > 0
      ? (this.metrics.cacheMetrics.hits / totalCacheRequests * 100).toFixed(1) + '%'
      : '0%';

    this.metrics.resultCounts.push(resultCount);
    if (this.metrics.resultCounts.length > 100) {
      this.metrics.resultCounts = this.metrics.resultCounts.slice(-100);
    }

    if (duration > 1000) {
      this.metrics.slowSearches.push(searchRecord);
      if (this.metrics.slowSearches.length > 20) {
        this.metrics.slowSearches = this.metrics.slowSearches.slice(-20);
      }
    }

    this.metrics.recentSearches.push(searchRecord);
    if (this.metrics.recentSearches.length > 10) {
      this.metrics.recentSearches = this.metrics.recentSearches.slice(-10);
    }

    if (duration > 2000) {
      console.warn(`🐌 Very slow search detected: "${searchTerm}" took ${duration}ms (${type})`);
    } else if (duration > 1000) {
      console.warn(`⚠️ Slow search detected: "${searchTerm}" took ${duration}ms (${type})`);
    } else if (duration < 100) {
      console.log(`⚡ Fast search: "${searchTerm}" took ${duration}ms (${type})`);
    }
  }

  getStats(): PerformanceStats {
    const stats: PerformanceStats = {
      ...this.metrics,
      typeAverages: {}
    };

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

  getSummary(): PerformanceSummary {
    const stats = this.getStats();
    return {
      totalSearches: stats.totalSearches,
      averageTime: stats.averageSearchTime.toFixed(1) + 'ms',
      cacheHitRate: stats.cacheMetrics.hitRate,
      slowSearchCount: stats.slowSearches.length,
      typeBreakdown: stats.searchesByType
    };
  }

  reset(): void {
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

  logReport(): void {
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

const searchPerformanceMonitor = new SearchPerformanceMonitor();

let searchCount = 0;
const originalRecord = searchPerformanceMonitor.recordSearch.bind(searchPerformanceMonitor);
searchPerformanceMonitor.recordSearch = function (...args: Parameters<typeof originalRecord>): void {
  originalRecord(...args);
  searchCount++;
  if (searchCount % 50 === 0) {
    this.logReport();
  }
};

export default searchPerformanceMonitor;

type SearchFunction<T> = (...args: unknown[]) => Promise<T>;

interface SearchResult {
  pages?: unknown[];
  source?: string;
  [key: string]: unknown;
}

export function timeSearch<T extends SearchResult | unknown[]>(
  searchFunction: SearchFunction<T>,
  type: keyof SearchMetrics['searchesByType'],
  searchTerm: string
): SearchFunction<T> {
  return async function (...args: unknown[]): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await searchFunction(...args);
      const duration = Date.now() - startTime;
      let resultCount = 0;
      if (result && typeof result === 'object' && 'pages' in result && Array.isArray(result.pages)) {
        resultCount = result.pages.length;
      } else if (Array.isArray(result)) {
        resultCount = result.length;
      }
      const cacheHit = result && typeof result === 'object' && 'source' in result &&
        typeof result.source === 'string' && result.source.includes('cache');
      const source = (result && typeof result === 'object' && 'source' in result &&
        typeof result.source === 'string') ? result.source : 'unknown';

      searchPerformanceMonitor.recordSearch(type, searchTerm, duration, resultCount, cacheHit, source);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      searchPerformanceMonitor.recordSearch(type, searchTerm, duration, 0, false, 'error');
      throw error;
    }
  };
}

export function getSearchPerformanceStats(): PerformanceStats {
  return searchPerformanceMonitor.getStats();
}

export function getSearchPerformanceSummary(): PerformanceSummary {
  return searchPerformanceMonitor.getSummary();
}
