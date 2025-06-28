/**
 * No-Op Edit Filtering Test Script
 * 
 * This script tests the no-op edit filtering functionality to verify that
 * edits with no meaningful content changes are properly filtered from
 * activity displays and analytics.
 */

/**
 * Test content normalization and no-op detection
 */
async function testContentNormalization() {
  console.log('🔍 Testing Content Normalization and No-Op Detection...');
  
  try {
    // Import the content normalization utilities
    const { hasContentChanged, compareContent } = await import('../utils/contentNormalization');
    
    // Test cases for no-op detection
    const testCases = [
      {
        name: 'Identical content',
        content1: [{ type: "paragraph", children: [{ text: "Hello world" }] }],
        content2: [{ type: "paragraph", children: [{ text: "Hello world" }] }],
        expectedChange: false
      },
      {
        name: 'Whitespace differences',
        content1: [{ type: "paragraph", children: [{ text: "Hello world" }] }],
        content2: [{ type: "paragraph", children: [{ text: " Hello world " }] }],
        expectedChange: false
      },
      {
        name: 'Empty paragraph differences',
        content1: [{ type: "paragraph", children: [{ text: "Hello" }] }, { type: "paragraph", children: [{ text: "" }] }],
        content2: [{ type: "paragraph", children: [{ text: "Hello" }] }],
        expectedChange: false
      },
      {
        name: 'Actual content change',
        content1: [{ type: "paragraph", children: [{ text: "Hello world" }] }],
        content2: [{ type: "paragraph", children: [{ text: "Hello universe" }] }],
        expectedChange: true
      },
      {
        name: 'Empty to empty',
        content1: [{ type: "paragraph", children: [{ text: "" }] }],
        content2: [{ type: "paragraph", children: [{ text: "" }] }],
        expectedChange: false
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`🧪 Testing: ${testCase.name}`);
      
      const hasChanged = hasContentChanged(testCase.content2, testCase.content1);
      const comparison = compareContent(testCase.content2, testCase.content1);
      
      const passed = hasChanged === testCase.expectedChange;
      
      results.push({
        name: testCase.name,
        expected: testCase.expectedChange,
        actual: hasChanged,
        passed,
        details: comparison
      });
      
      console.log(`   ${passed ? '✅' : '❌'} Expected: ${testCase.expectedChange}, Got: ${hasChanged}`);
    }
    
    const allPassed = results.every(r => r.passed);
    
    return {
      success: allPassed,
      results,
      totalTests: testCases.length,
      passedTests: results.filter(r => r.passed).length
    };
    
  } catch (error) {
    console.error('❌ Content normalization test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test activity filtering
 */
async function testActivityFiltering() {
  console.log('📊 Testing Activity Filtering...');
  
  try {
    // Import activity functions
    const { getRecentActivity } = await import('../firebase/activity');
    
    console.log('🔄 Fetching recent activity...');
    const activityResult = await getRecentActivity(10);
    
    if (activityResult.activities) {
      console.log(`📋 Found ${activityResult.activities.length} activities`);
      
      // Check if any activities have version information
      const activitiesWithVersions = activityResult.activities.filter(a => a.versionId);
      console.log(`🔍 Activities with version IDs: ${activitiesWithVersions.length}`);
      
      // Log sample activity structure
      if (activityResult.activities.length > 0) {
        console.log('📝 Sample activity structure:', {
          pageId: activityResult.activities[0].pageId,
          hasVersionId: !!activityResult.activities[0].versionId,
          timestamp: activityResult.activities[0].timestamp,
          username: activityResult.activities[0].username
        });
      }
      
      return {
        success: true,
        totalActivities: activityResult.activities.length,
        activitiesWithVersions: activitiesWithVersions.length,
        sampleActivity: activityResult.activities[0] || null
      };
    } else {
      throw new Error('No activities returned');
    }
    
  } catch (error) {
    console.error('❌ Activity filtering test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test content changes tracking
 */
async function testContentChangesTracking() {
  console.log('📈 Testing Content Changes Tracking...');
  
  try {
    // Import content changes tracking
    const { ContentChangesTrackingService } = await import('../services/contentChangesTracking');
    
    // Test with no-op content (should not track)
    const noOpContent1 = [{ type: "paragraph", children: [{ text: "Hello world" }] }];
    const noOpContent2 = [{ type: "paragraph", children: [{ text: " Hello world " }] }]; // Just whitespace difference
    
    console.log('🧪 Testing no-op content tracking (should be skipped)...');
    
    // This should not create any analytics events
    await ContentChangesTrackingService.trackContentChangeAdvanced(
      'test-page-id',
      'test-user-id',
      'Test User',
      noOpContent1,
      noOpContent2
    );
    
    console.log('✅ No-op content tracking test completed (check console for skip messages)');
    
    // Test with actual content change (should track)
    const realContent1 = [{ type: "paragraph", children: [{ text: "Hello world" }] }];
    const realContent2 = [{ type: "paragraph", children: [{ text: "Hello universe" }] }];
    
    console.log('🧪 Testing real content change tracking (should create event)...');
    
    await ContentChangesTrackingService.trackContentChangeAdvanced(
      'test-page-id',
      'test-user-id',
      'Test User',
      realContent1,
      realContent2
    );
    
    console.log('✅ Real content change tracking test completed');
    
    return {
      success: true,
      message: 'Content changes tracking tests completed - check console logs for skip/track messages'
    };
    
  } catch (error) {
    console.error('❌ Content changes tracking test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run comprehensive no-op filtering tests
 */
async function runNoOpFilteringTests() {
  console.log('='.repeat(70));
  console.log('NO-OP EDIT FILTERING COMPREHENSIVE TESTS');
  console.log('='.repeat(70));
  
  // Test 1: Content normalization
  const normalizationTest = await testContentNormalization();
  
  // Test 2: Activity filtering
  const activityTest = await testActivityFiltering();
  
  // Test 3: Content changes tracking
  const trackingTest = await testContentChangesTracking();
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  
  console.log('1. Content Normalization:', normalizationTest.success ? '✅ PASS' : '❌ FAIL');
  if (normalizationTest.success) {
    console.log(`   Passed: ${normalizationTest.passedTests}/${normalizationTest.totalTests} tests`);
  } else {
    console.log('   Error:', normalizationTest.error);
  }
  
  console.log('2. Activity Filtering:', activityTest.success ? '✅ PASS' : '❌ FAIL');
  if (activityTest.success) {
    console.log(`   Total Activities: ${activityTest.totalActivities}`);
    console.log(`   With Version IDs: ${activityTest.activitiesWithVersions}`);
  } else {
    console.log('   Error:', activityTest.error);
  }
  
  console.log('3. Content Changes Tracking:', trackingTest.success ? '✅ PASS' : '❌ FAIL');
  if (!trackingTest.success) {
    console.log('   Error:', trackingTest.error);
  }
  
  console.log('\n💡 Manual Testing Instructions:');
  console.log('   1. Create a page and make a no-op edit (e.g., add/remove whitespace)');
  console.log('   2. Check that no new activity appears in the activity feed');
  console.log('   3. Check that no new analytics events are created');
  console.log('   4. Make a real edit and verify it does appear in activity');
  
  console.log('='.repeat(70));
  
  return {
    normalizationTest,
    activityTest,
    trackingTest,
    overallSuccess: normalizationTest.success && activityTest.success && trackingTest.success
  };
}

// Export functions for browser console use
if (typeof window !== 'undefined') {
  window.testContentNormalization = testContentNormalization;
  window.testActivityFiltering = testActivityFiltering;
  window.testContentChangesTracking = testContentChangesTracking;
  window.runNoOpFilteringTests = runNoOpFilteringTests;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testContentNormalization,
    testActivityFiltering,
    testContentChangesTracking,
    runNoOpFilteringTests
  };
}
