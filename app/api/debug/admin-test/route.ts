import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { DashboardAnalyticsService } from '../../../services/dashboardAnalytics';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug endpoint to test admin authentication and data access
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Admin Test] Starting admin test...');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      steps: []
    };
    
    // Step 1: Check admin permissions
    try {
      const adminCheck = await checkAdminPermissions(request);
      testResults.steps.push({
        step: 1,
        name: 'Admin Permission Check',
        success: adminCheck.success,
        data: adminCheck.success ? { userEmail: adminCheck.userEmail } : { error: adminCheck.error }
      });
      
      if (!adminCheck.success) {
        return NextResponse.json(testResults, { status: 200 });
      }
    } catch (error) {
      testResults.steps.push({
        step: 1,
        name: 'Admin Permission Check',
        success: false,
        error: error.message
      });
      return NextResponse.json(testResults, { status: 200 });
    }
    
    // Step 2: Test collection names
    try {
      const collections = {
        users: getCollectionName('users'),
        pages: getCollectionName('pages'),
        analytics_events: getCollectionName('analytics_events'),
        subscriptions: getCollectionName('subscriptions')
      };
      
      testResults.steps.push({
        step: 2,
        name: 'Collection Names',
        success: true,
        data: collections
      });
    } catch (error) {
      testResults.steps.push({
        step: 2,
        name: 'Collection Names',
        success: false,
        error: error.message
      });
    }
    
    // Step 3: Test simple analytics query
    try {
      const dateRange = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date()
      };
      
      console.log('[Admin Test] Testing accounts analytics with date range:', dateRange);
      const accountsData = await DashboardAnalyticsService.getNewAccountsCreated(dateRange, 10);
      
      testResults.steps.push({
        step: 3,
        name: 'Accounts Analytics Test',
        success: true,
        data: {
          dateRange,
          dataLength: accountsData.length,
          sampleData: accountsData.slice(0, 3)
        }
      });
    } catch (error) {
      testResults.steps.push({
        step: 3,
        name: 'Accounts Analytics Test',
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
    
    // Step 4: Test pages analytics
    try {
      const dateRange = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      
      const pagesData = await DashboardAnalyticsService.getNewPagesCreated(dateRange, 10);
      
      testResults.steps.push({
        step: 4,
        name: 'Pages Analytics Test',
        success: true,
        data: {
          dataLength: pagesData.length,
          sampleData: pagesData.slice(0, 3)
        }
      });
    } catch (error) {
      testResults.steps.push({
        step: 4,
        name: 'Pages Analytics Test',
        success: false,
        error: error.message
      });
    }
    
    return NextResponse.json(testResults, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Admin Test] Error:', error);
    
    return NextResponse.json({
      error: 'Admin test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
