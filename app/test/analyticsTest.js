/**
 * Analytics Dashboard Test Script
 * 
 * This script tests the analytics functionality in the WeWrite admin dashboard
 * to verify that page creation and edit tracking is working correctly.
 */

/**
 * Test analytics data retrieval
 */
async function testAnalyticsDataRetrieval() {
  console.log('🔍 Testing Analytics Data Retrieval...');
  
  try {
    // Import the analytics service
    const { DashboardAnalyticsService } = await import('../services/dashboardAnalytics');
    
    // Test date range - last 7 days to include today
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const dateRange = { startDate, endDate };
    
    console.log('📅 Testing with date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    // Test new pages created
    console.log('📊 Testing New Pages Created...');
    const newPagesData = await DashboardAnalyticsService.getNewPagesCreated(dateRange);
    console.log('✅ New Pages Data:', newPagesData);
    
    // Test edits analytics
    console.log('📊 Testing Edits Analytics...');
    const editsData = await DashboardAnalyticsService.getEditsAnalytics(dateRange);
    console.log('✅ Edits Data:', editsData);
    
    // Test all metrics
    console.log('📊 Testing All Metrics...');
    const allMetrics = await DashboardAnalyticsService.getAllMetrics(dateRange);
    console.log('✅ All Metrics:', allMetrics);
    
    return {
      success: true,
      newPagesData,
      editsData,
      allMetrics,
      dateRange
    };
    
  } catch (error) {
    console.error('❌ Analytics test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test page creation tracking
 */
async function testPageCreationTracking() {
  console.log('📝 Testing Page Creation Tracking...');
  
  try {
    // Import Firebase functions
    const { createPage } = await import('../firebase/database/pages');
    const { auth } = await import('../firebase/auth');
    
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to test page creation');
    }
    
    // Create a test page
    const testPageData = {
      title: `Analytics Test Page - ${new Date().toISOString()}`,
      content: JSON.stringify([
        {
          type: "paragraph",
          children: [{ text: "This is a test page for analytics tracking." }]
        }
      ]),
      isPublic: false,
      location: null,
      groupId: null,
      userId: user.uid,
      username: user.displayName || 'Test User',
      isReply: false
    };
    
    console.log('🔄 Creating test page...');
    const pageId = await createPage(testPageData);
    
    if (pageId) {
      console.log('✅ Test page created successfully:', pageId);
      
      // Wait a moment for the data to be indexed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test analytics retrieval again
      const analyticsResult = await testAnalyticsDataRetrieval();
      
      return {
        success: true,
        pageId,
        analyticsResult
      };
    } else {
      throw new Error('Failed to create test page');
    }
    
  } catch (error) {
    console.error('❌ Page creation test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test page editing tracking
 */
async function testPageEditingTracking(pageId) {
  console.log('✏️ Testing Page Editing Tracking...');
  
  try {
    // Import Firebase functions
    const { updatePageContent } = await import('../firebase/database/versions');
    const { auth } = await import('../firebase/auth');
    
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to test page editing');
    }
    
    // Update the test page
    const updatedContent = JSON.stringify([
      {
        type: "paragraph",
        children: [{ text: "This page has been edited for analytics testing." }]
      }
    ]);
    
    const updateData = {
      content: updatedContent,
      userId: user.uid,
      username: user.displayName || 'Test User'
    };
    
    console.log('🔄 Updating test page...');
    const success = await updatePageContent(pageId, updateData);
    
    if (success) {
      console.log('✅ Test page updated successfully');
      
      // Wait a moment for the data to be indexed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test analytics retrieval again
      const analyticsResult = await testAnalyticsDataRetrieval();
      
      return {
        success: true,
        pageId,
        analyticsResult
      };
    } else {
      throw new Error('Failed to update test page');
    }
    
  } catch (error) {
    console.error('❌ Page editing test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test timestamp handling
 */
async function testTimestampHandling() {
  console.log('⏰ Testing Timestamp Handling...');
  
  try {
    // Import Firestore
    const { db } = await import('../firebase/database');
    const { collection, query, where, orderBy, limit, getDocs, Timestamp } = await import('firebase/firestore');
    
    // Test querying pages with different timestamp formats
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log('🔍 Querying pages created in last 24 hours...');
    
    const pagesRef = collection(db, 'pages');
    const q = query(
      pagesRef,
      where('createdAt', '>=', Timestamp.fromDate(yesterday)),
      where('createdAt', '<=', Timestamp.fromDate(now)),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    console.log(`📊 Found ${snapshot.size} pages created in last 24 hours`);
    
    const pages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      pages.push({
        id: doc.id,
        title: data.title,
        createdAt: data.createdAt,
        lastModified: data.lastModified,
        createdAtType: typeof data.createdAt,
        lastModifiedType: typeof data.lastModified
      });
    });
    
    console.log('📋 Recent pages:', pages);
    
    return {
      success: true,
      recentPages: pages,
      totalFound: snapshot.size
    };
    
  } catch (error) {
    console.error('❌ Timestamp test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run comprehensive analytics tests
 */
async function runAnalyticsTests() {
  console.log('='.repeat(70));
  console.log('ANALYTICS DASHBOARD COMPREHENSIVE TESTS');
  console.log('='.repeat(70));
  
  // Test 1: Basic analytics data retrieval
  const analyticsTest = await testAnalyticsDataRetrieval();
  
  // Test 2: Timestamp handling
  const timestampTest = await testTimestampHandling();
  
  // Test 3: Page creation tracking (optional - requires user to be logged in)
  let pageCreationTest = { success: false, error: 'Skipped - requires manual execution' };
  let pageEditingTest = { success: false, error: 'Skipped - requires manual execution' };
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  
  console.log('1. Analytics Data Retrieval:', analyticsTest.success ? '✅ PASS' : '❌ FAIL');
  if (!analyticsTest.success) {
    console.log('   Error:', analyticsTest.error);
  }
  
  console.log('2. Timestamp Handling:', timestampTest.success ? '✅ PASS' : '❌ FAIL');
  if (!timestampTest.success) {
    console.log('   Error:', timestampTest.error);
  }
  
  console.log('3. Page Creation Tracking:', pageCreationTest.success ? '✅ PASS' : '⏭️ MANUAL');
  console.log('4. Page Editing Tracking:', pageEditingTest.success ? '✅ PASS' : '⏭️ MANUAL');
  
  console.log('\n📊 Analytics Data Summary:');
  if (analyticsTest.success) {
    console.log(`   - New Pages: ${analyticsTest.newPagesData?.length || 0} data points`);
    console.log(`   - Edits: ${analyticsTest.editsData?.length || 0} data points`);
  }
  
  if (timestampTest.success) {
    console.log(`   - Recent Pages Found: ${timestampTest.totalFound}`);
  }
  
  console.log('\n💡 Manual Testing Instructions:');
  console.log('   1. Open browser console on admin dashboard');
  console.log('   2. Run: testPageCreationTracking()');
  console.log('   3. Run: testPageEditingTracking(pageId)');
  console.log('   4. Check if graphs update with new data');
  
  console.log('='.repeat(70));
  
  return {
    analyticsTest,
    timestampTest,
    pageCreationTest,
    pageEditingTest,
    overallSuccess: analyticsTest.success && timestampTest.success
  };
}

// Export functions for browser console use
if (typeof window !== 'undefined') {
  window.testAnalyticsDataRetrieval = testAnalyticsDataRetrieval;
  window.testPageCreationTracking = testPageCreationTracking;
  window.testPageEditingTracking = testPageEditingTracking;
  window.testTimestampHandling = testTimestampHandling;
  window.runAnalyticsTests = runAnalyticsTests;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testAnalyticsDataRetrieval,
    testPageCreationTracking,
    testPageEditingTracking,
    testTimestampHandling,
    runAnalyticsTests
  };
}
