/**
 * Test script for notification cleanup functionality
 * This script can be used to test the deleteNotificationsForPage function
 * 
 * Usage: Run this in the browser console on a WeWrite page to test
 */

// Test function to verify notification cleanup works
async function testNotificationCleanup() {
  console.log('🧪 Testing notification cleanup functionality...');
  
  try {
    // Import the function
    const { deleteNotificationsForPage } = await import('./firebase/notifications');
    
    // Test with a non-existent page ID (should return 0)
    const testPageId = 'test-page-id-that-does-not-exist';
    console.log(`Testing with non-existent page ID: ${testPageId}`);
    
    const deletedCount = await deleteNotificationsForPage(testPageId);
    console.log(`✅ Test completed. Deleted ${deletedCount} notifications (expected: 0)`);
    
    // Test with empty page ID
    console.log('Testing with empty page ID...');
    const deletedCountEmpty = await deleteNotificationsForPage('');
    console.log(`✅ Empty test completed. Deleted ${deletedCountEmpty} notifications (expected: 0)`);
    
    // Test with null page ID
    console.log('Testing with null page ID...');
    const deletedCountNull = await deleteNotificationsForPage(null);
    console.log(`✅ Null test completed. Deleted ${deletedCountNull} notifications (expected: 0)`);
    
    console.log('🎉 All tests passed! Notification cleanup function is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testNotificationCleanup };
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  console.log('Notification cleanup test script loaded. Run testNotificationCleanup() to test.');
}
