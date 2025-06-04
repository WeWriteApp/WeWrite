/**
 * Utility for monitoring and analyzing database query performance
 * This helps identify slow queries and optimization opportunities
 */

// Types
interface QueryStat {
  name: string;
  duration: number;
  timestamp: string;
  error: string | null;
  metadata: Record<string, any>;
}

interface QueryStatsSummary {
  totalQueries: number;
  averageDuration: number;
  slowestQuery: QueryStat | null;
  fastestQuery: QueryStat | null;
  errorRate: number;
}

// In-memory storage for query stats (only in development)
const queryStats: QueryStat[] = [];

// Maximum number of query stats to keep in memory
const MAX_STATS = 100;

/**
 * Track the performance of a database query
 */
export const trackQueryPerformance = async <T>(
  queryName: string,
  queryFn: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> => {
  // Only track in development environment
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return queryFn();
  }
  
  const startTime = performance.now();
  let result: T;
  let error: Error | null = null;

  try {
    result = await queryFn();
    return result;
  } catch (err: any) {
    error = err;
    throw err;
  } finally {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Log performance data
    console.log(`Query ${queryName} took ${duration.toFixed(2)}ms`);

    // Store stats in memory
    queryStats.unshift({
      name: queryName,
      duration,
      timestamp: new Date().toISOString(),
      error: error ? error.message : null,
      metadata
    });

    // Trim stats array to prevent memory issues
    if (queryStats.length > MAX_STATS) {
      queryStats.pop();
    }
  }
};

/**
 * Get all collected query stats
 */
export const getQueryStats = (): QueryStat[] => {
  return [...queryStats];
};

/**
 * Clear all collected query stats
 */
export const clearQueryStats = (): void => {
  queryStats.length = 0;
};

/**
 * Get summary of query performance
 */
export const getQueryStatsSummary = (): QueryStatsSummary => {
  if (queryStats.length === 0) {
    return {
      totalQueries: 0,
      averageDuration: 0,
      slowestQuery: null,
      fastestQuery: null,
      errorRate: 0
    };
  }
  
  let totalDuration = 0;
  let slowestQuery = queryStats[0];
  let fastestQuery = queryStats[0];
  let errorCount = 0;
  
  queryStats.forEach(stat => {
    totalDuration += stat.duration;
    
    if (stat.duration > slowestQuery.duration) {
      slowestQuery = stat;
    }
    
    if (stat.duration < fastestQuery.duration) {
      fastestQuery = stat;
    }
    
    if (stat.error) {
      errorCount++;
    }
  });
  
  return {
    totalQueries: queryStats.length,
    averageDuration: totalDuration / queryStats.length,
    slowestQuery,
    fastestQuery,
    errorRate: errorCount / queryStats.length
  };
};
