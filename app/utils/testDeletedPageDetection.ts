/**
 * Test utility to verify deleted page detection performance
 * This helps ensure the optimizations are working correctly
 */

import { getPageById } from '../firebase/database/pages';
import { clearDeletedPageCaches } from './clearDeletedPageCaches';
import { invalidatePageDeletedStatus } from './apiDeduplication';

export const testDeletedPageDetection = async (pageId: string) => {
  console.log(`🧪 Testing deleted page detection for: ${pageId}`);
  
  const startTime = Date.now();
  
  try {
    // Clear all caches first to ensure fresh data
    clearDeletedPageCaches(pageId);
    invalidatePageDeletedStatus(pageId);
    
    // Test the main API call
    const result = await getPageById(pageId);
    const endTime = Date.now();
    
    console.log(`🧪 Test Results for ${pageId}:`);
    console.log(`   ⏱️  Response time: ${endTime - startTime}ms`);
    console.log(`   📄 Page exists: ${!!result.pageData}`);
    console.log(`   🗑️  Is deleted: ${result.pageData?.deleted === true}`);
    console.log(`   ❌ Has error: ${!!result.error}`);
    
    if (result.pageData?.deleted === true) {
      console.log(`   ✅ SUCCESS: Deleted status detected in single API call`);
    } else if (result.error) {
      console.log(`   ⚠️  WARNING: Got error instead of deleted status: ${result.error}`);
    } else {
      console.log(`   ✅ SUCCESS: Page is not deleted`);
    }
    
    return {
      responseTime: endTime - startTime,
      isDeleted: result.pageData?.deleted === true,
      hasError: !!result.error,
      success: true
    };
    
  } catch (error) {
    const endTime = Date.now();
    console.error(`🧪 Test failed for ${pageId}:`, error);
    
    return {
      responseTime: endTime - startTime,
      isDeleted: false,
      hasError: true,
      error: error.message,
      success: false
    };
  }
};

// Add to window for easy testing in browser console
if (typeof window !== 'undefined') {
  (window as any).testDeletedPageDetection = testDeletedPageDetection;
  (window as any).clearDeletedPageCaches = clearDeletedPageCaches;
  (window as any).invalidatePageDeletedStatus = invalidatePageDeletedStatus;
  
  console.log('🧪 Deleted page detection test utilities loaded');
  console.log('   Use: testDeletedPageDetection("pageId") to test');
  console.log('   Use: clearDeletedPageCaches() to clear all caches');
  console.log('   Use: invalidatePageDeletedStatus("pageId") to clear specific page cache');
}
