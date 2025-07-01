/**
 * Cache Invalidation Test
 * 
 * This test verifies that cache invalidation is working properly
 * when new pages are created.
 */

import { invalidatePageCreationCaches } from '../utils/cacheInvalidation';
import { globalCacheInvalidation } from '../utils/globalCacheInvalidation';

// Test function to verify cache invalidation
export const testCacheInvalidation = () => {
  console.log('🧪 Starting cache invalidation test...');
  
  // Track if callbacks were called
  let userPagesCallbackCalled = false;
  let recentActivityCallbackCalled = false;
  
  // Register test callbacks
  const unregisterUserPages = globalCacheInvalidation.register('user-pages', () => {
    console.log('✅ User pages cache invalidation callback triggered');
    userPagesCallbackCalled = true;
  });
  
  const unregisterRecentActivity = globalCacheInvalidation.register('recent-activity', () => {
    console.log('✅ Recent activity cache invalidation callback triggered');
    recentActivityCallbackCalled = true;
  });
  
  // Test the invalidation
  console.log('🧪 Triggering cache invalidation for test user...');
  invalidatePageCreationCaches('test-user-id');
  
  // Check results after a short delay
  setTimeout(() => {
    console.log('🧪 Cache invalidation test results:');
    console.log('  - User pages callback called:', userPagesCallbackCalled);
    console.log('  - Recent activity callback called:', recentActivityCallbackCalled);
    
    if (userPagesCallbackCalled && recentActivityCallbackCalled) {
      console.log('✅ Cache invalidation test PASSED');
    } else {
      console.log('❌ Cache invalidation test FAILED');
    }
    
    // Clean up
    unregisterUserPages();
    unregisterRecentActivity();
  }, 100);
};

// Test function to check callback registration counts
export const testCallbackRegistration = () => {
  console.log('🧪 Testing callback registration...');
  
  const userPagesCount = globalCacheInvalidation.getCallbackCount('user-pages');
  const recentActivityCount = globalCacheInvalidation.getCallbackCount('recent-activity');
  
  console.log('📊 Registered callback counts:');
  console.log('  - User pages:', userPagesCount);
  console.log('  - Recent activity:', recentActivityCount);
  
  if (userPagesCount > 0 && recentActivityCount > 0) {
    console.log('✅ Callback registration test PASSED');
  } else {
    console.log('❌ Callback registration test FAILED - some hooks may not be registered');
  }
};

// Function to run all cache invalidation tests
export const runCacheInvalidationTests = () => {
  console.log('🧪 Running cache invalidation tests...');
  
  testCallbackRegistration();
  
  setTimeout(() => {
    testCacheInvalidation();
  }, 200);
};

// Auto-run tests if this file is imported in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Add a global function to run tests from browser console
  window.testCacheInvalidation = runCacheInvalidationTests;
  console.log('🧪 Cache invalidation tests available. Run window.testCacheInvalidation() in console to test.');
}