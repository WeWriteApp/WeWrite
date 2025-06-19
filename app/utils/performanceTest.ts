/**
 * Performance testing utilities for WeWrite optimizations
 * Use this to verify that our optimizations are working correctly
 */

import { requestCache, getCachedPageById, getBatchPages } from './requestCache';
import { queryOptimizer, getOptimizationRecommendations } from './queryOptimizer';

interface PerformanceTestResult {
  testName: string;
  duration: number;
  requestCount: number;
  cacheHits: number;
  success: boolean;
  error?: string;
}

/**
 * Test individual page loading vs batch loading
 */
export const testBatchVsIndividual = async (
  pageIds: string[],
  userId?: string
): Promise<{ individual: PerformanceTestResult; batch: PerformanceTestResult }> => {
  // Clear cache to ensure fair comparison
  requestCache.clear();

  // Test individual loading
  const individualStart = performance.now();
  let individualSuccess = true;
  let individualError: string | undefined;
  
  try {
    const individualPromises = pageIds.map(id => getCachedPageById(id, userId));
    await Promise.all(individualPromises);
  } catch (error) {
    individualSuccess = false;
    individualError = error instanceof Error ? error.message : 'Unknown error';
  }
  
  const individualDuration = performance.now() - individualStart;
  const individualStats = requestCache.getStats();

  // Clear cache again
  requestCache.clear();

  // Test batch loading
  const batchStart = performance.now();
  let batchSuccess = true;
  let batchError: string | undefined;
  
  try {
    await getBatchPages(pageIds, userId);
  } catch (error) {
    batchSuccess = false;
    batchError = error instanceof Error ? error.message : 'Unknown error';
  }
  
  const batchDuration = performance.now() - batchStart;
  const batchStats = requestCache.getStats();

  return {
    individual: {
      testName: 'Individual Page Loading',
      duration: individualDuration,
      requestCount: individualStats.cacheSize,
      cacheHits: 0, // First run, no cache hits
      success: individualSuccess,
      error: individualError
    },
    batch: {
      testName: 'Batch Page Loading',
      duration: batchDuration,
      requestCount: batchStats.cacheSize,
      cacheHits: 0, // First run, no cache hits
      success: batchSuccess,
      error: batchError
    }
  };
};

/**
 * Test cache effectiveness
 */
export const testCacheEffectiveness = async (
  pageIds: string[],
  userId?: string
): Promise<{ firstLoad: PerformanceTestResult; secondLoad: PerformanceTestResult }> => {
  // Clear cache to start fresh
  requestCache.clear();

  // First load (should populate cache)
  const firstStart = performance.now();
  let firstSuccess = true;
  let firstError: string | undefined;
  
  try {
    await getBatchPages(pageIds, userId);
  } catch (error) {
    firstSuccess = false;
    firstError = error instanceof Error ? error.message : 'Unknown error';
  }
  
  const firstDuration = performance.now() - firstStart;
  const firstStats = requestCache.getStats();

  // Second load (should use cache)
  const secondStart = performance.now();
  let secondSuccess = true;
  let secondError: string | undefined;
  
  try {
    await getBatchPages(pageIds, userId);
  } catch (error) {
    secondSuccess = false;
    secondError = error instanceof Error ? error.message : 'Unknown error';
  }
  
  const secondDuration = performance.now() - secondStart;
  const secondStats = requestCache.getStats();

  return {
    firstLoad: {
      testName: 'First Load (Cache Miss)',
      duration: firstDuration,
      requestCount: firstStats.cacheSize,
      cacheHits: 0,
      success: firstSuccess,
      error: firstError
    },
    secondLoad: {
      testName: 'Second Load (Cache Hit)',
      duration: secondDuration,
      requestCount: secondStats.cacheSize,
      cacheHits: pageIds.length, // Should be all cache hits
      success: secondSuccess,
      error: secondError
    }
  };
};

/**
 * Generate performance report
 */
export const generatePerformanceReport = (): {
  cacheStats: any;
  queryStats: any;
  recommendations: string[];
} => {
  return {
    cacheStats: requestCache.getStats(),
    queryStats: queryOptimizer.getStats(),
    recommendations: getOptimizationRecommendations()
  };
};

/**
 * Run comprehensive performance test suite
 */
export const runPerformanceTestSuite = async (
  testPageIds: string[] = ['test1', 'test2', 'test3', 'test4', 'test5'],
  userId?: string
): Promise<{
  batchComparison: { individual: PerformanceTestResult; batch: PerformanceTestResult };
  cacheTest: { firstLoad: PerformanceTestResult; secondLoad: PerformanceTestResult };
  report: { cacheStats: any; queryStats: any; recommendations: string[] };
}> => {
  console.log('🧪 Running WeWrite Performance Test Suite...');

  try {
    // Test batch vs individual loading
    console.log('Testing batch vs individual loading...');
    const batchComparison = await testBatchVsIndividual(testPageIds, userId);
    
    // Test cache effectiveness
    console.log('Testing cache effectiveness...');
    const cacheTest = await testCacheEffectiveness(testPageIds, userId);
    
    // Generate report
    const report = generatePerformanceReport();
    
    console.log('✅ Performance test suite completed');
    console.log('📊 Results:', {
      batchImprovement: `${((batchComparison.individual.duration - batchComparison.batch.duration) / batchComparison.individual.duration * 100).toFixed(1)}%`,
      cacheImprovement: `${((cacheTest.firstLoad.duration - cacheTest.secondLoad.duration) / cacheTest.firstLoad.duration * 100).toFixed(1)}%`,
      recommendations: report.recommendations
    });

    return {
      batchComparison,
      cacheTest,
      report
    };
  } catch (error) {
    console.error('❌ Performance test suite failed:', error);
    throw error;
  }
};

/**
 * Monitor real-time performance metrics
 */
export const startPerformanceMonitoring = (): () => void => {
  const interval = setInterval(() => {
    const report = generatePerformanceReport();
    
    if (report.queryStats.count > 100) {
      console.warn('🚨 High query volume detected:', report.queryStats.count);
      
      if (report.recommendations.length > 0) {
        console.warn('💡 Recommendations:', report.recommendations);
      }
    }
  }, 30000); // Check every 30 seconds

  return () => clearInterval(interval);
};

// Auto-start monitoring in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Start monitoring after a delay to avoid interfering with initial load
  setTimeout(() => {
    console.log('🔍 Starting WeWrite performance monitoring...');
    startPerformanceMonitoring();
  }, 5000);
}

export default {
  testBatchVsIndividual,
  testCacheEffectiveness,
  generatePerformanceReport,
  runPerformanceTestSuite,
  startPerformanceMonitoring
};
