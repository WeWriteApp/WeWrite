/**
 * Utility for monitoring and analyzing database query performance
 * This helps identify slow queries and optimization opportunities
 */

// In-memory storage for query stats (only in development)
const queryStats = [];

// Maximum number of query stats to keep in memory
const MAX_STATS = 100;

/**
 * Track the performance of a database query
 * 
 * @param {string} queryName - Name of the query for identification
 * @param {Function} queryFn - Async function that performs the query
 * @param {Object} metadata - Additional metadata about the query
 * @returns {Promise<any>} - The result of the query function
 */
export const trackQueryPerformance = async (queryName, queryFn, metadata = {}) => {
  // Only track in development environment
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return queryFn();
  }
  
  const startTime = performance.now();
  let result;
  let error = null;
  
  try {
    result = await queryFn();
    return result;
  } catch (err) {
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
 * 
 * @returns {Array} - Array of query performance stats
 */
export const getQueryStats = () => {
  return [...queryStats];
};

/**
 * Clear all collected query stats
 */
export const clearQueryStats = () => {
  queryStats.length = 0;
};

/**
 * Get summary of query performance
 * 
 * @returns {Object} - Summary statistics
 */
export const getQueryStatsSummary = () => {
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
