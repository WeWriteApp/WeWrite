/**
 * Query optimization utilities for WeWrite
 * Reduces redundant database queries and improves performance
 */

interface QueryStats {
  count: number;
  lastReset: number;
  patterns: Map<string, number>;
}

class QueryOptimizer {
  private stats: QueryStats = {
    count: 0,
    lastReset: Date.now(),
    patterns: new Map()
  };

  private readonly STATS_RESET_INTERVAL = 60000; // 1 minute
  private readonly WARNING_THRESHOLD = 500; // Queries per minute (increased threshold)

  /**
   * Track a query execution
   */
  trackQuery(queryType: string, details?: any): void {
    const now = Date.now();
    
    // Reset stats if interval has passed
    if (now - this.stats.lastReset > this.STATS_RESET_INTERVAL) {
      this.resetStats();
    }

    this.stats.count++;
    
    // Track query patterns
    const pattern = this.extractPattern(queryType, details);
    this.stats.patterns.set(pattern, (this.stats.patterns.get(pattern) || 0) + 1);

    // Warn about excessive queries (less frequently)
    if (this.stats.count > this.WARNING_THRESHOLD && this.stats.count % 100 === 0) {
      this.logPerformanceWarning();
    }
  }

  /**
   * Extract query pattern for analysis
   */
  private extractPattern(queryType: string, details?: any): string {
    if (!details) return queryType;
    
    // Extract meaningful patterns while avoiding PII
    if (details.collection) {
      return `${queryType}:${details.collection}`;
    }
    
    if (details.path) {
      // Generalize paths to avoid storing specific IDs
      const generalizedPath = details.path.replace(/\/[a-zA-Z0-9_-]{20}/g, '/:id');
      return `${queryType}:${generalizedPath}`;
    }

    return queryType;
  }

  /**
   * Log performance warning with actionable insights
   */
  private logPerformanceWarning(): void {
    const topPatterns = Array.from(this.stats.patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.warn(`🚨 High query volume: ${this.stats.count} queries in last minute`);
    console.warn('Top query patterns:', topPatterns);
    
    // Provide optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(topPatterns);
    if (suggestions.length > 0) {
      console.warn('💡 Optimization suggestions:', suggestions);
    }
  }

  /**
   * Generate optimization suggestions based on query patterns
   */
  private generateOptimizationSuggestions(patterns: [string, number][]): string[] {
    const suggestions: string[] = [];

    for (const [pattern, count] of patterns) {
      if (count > 20) {
        if (pattern.includes('getPageById')) {
          suggestions.push('Consider using batch page loading or caching for page queries');
        }
        if (pattern.includes('pages:')) {
          suggestions.push('Consider implementing pagination or virtual scrolling for page lists');
        }
        if (pattern.includes('user:')) {
          suggestions.push('Consider caching user data or using batch user queries');
        }
      }
    }

    return suggestions;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      count: 0,
      lastReset: Date.now(),
      patterns: new Map()
    };
  }

  /**
   * Get current statistics
   */
  getStats(): QueryStats {
    return {
      ...this.stats,
      patterns: new Map(this.stats.patterns)
    };
  }

  /**
   * Check if query should be optimized
   */
  shouldOptimizeQuery(queryType: string): boolean {
    const pattern = this.extractPattern(queryType);
    const count = this.stats.patterns.get(pattern) || 0;
    
    // Suggest optimization for frequently repeated queries
    return count > 10;
  }
}

// Global optimizer instance
const queryOptimizer = new QueryOptimizer();

/**
 * Wrapper for tracking database queries
 */
export const trackQuery = (queryType: string, details?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    queryOptimizer.trackQuery(queryType, details);
  }
};

/**
 * Wrapper for Firestore queries with tracking
 */
export const trackedFirestoreQuery = async <T>(
  queryType: string,
  queryFn: () => Promise<T>,
  details?: any
): Promise<T> => {
  trackQuery(queryType, details);
  return await queryFn();
};

/**
 * Debounced query executor to prevent rapid-fire queries
 */
export const createDebouncedQuery = <T extends (...args: any[]) => Promise<any>>(
  queryFn: T,
  delay: number = 300
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastPromise: Promise<any> | null = null;

  return ((...args: Parameters<T>) => {
    // If there's a pending query, return the existing promise
    if (lastPromise && timeoutId) {
      return lastPromise;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Create new promise that will be resolved after delay
    lastPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await queryFn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          timeoutId = null;
          lastPromise = null;
        }
      }, delay);
    });

    return lastPromise;
  }) as T;
};

/**
 * Query result cache with TTL
 */
class QueryResultCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly DEFAULT_TTL = 30000; // 30 seconds

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const queryResultCache = new QueryResultCache();

/**
 * Cached query executor
 */
export const cachedQuery = async <T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  // Check cache first
  const cached = queryResultCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Execute query and cache result
  const result = await queryFn();
  queryResultCache.set(cacheKey, result, ttl);
  
  return result;
};

/**
 * Get optimization recommendations
 */
export const getOptimizationRecommendations = (): string[] => {
  const stats = queryOptimizer.getStats();
  const topPatterns = Array.from(stats.patterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return queryOptimizer['generateOptimizationSuggestions'](topPatterns);
};

export { queryOptimizer };
export default queryOptimizer;