import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { DashboardAnalyticsService } from '../../../services/dashboardAnalytics';

/**
 * Debug endpoint to test pages analytics with real data
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Test Pages Analytics] Starting pages analytics test...');
    
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: 'Admin access required',
        details: adminCheck.error
      }, { status: 403 });
    }
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: []
    };
    
    // Test 1: Last 7 days (should include July 22nd data)
    try {
      const dateRange7Days = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      
      console.log('[Test Pages Analytics] Testing 7-day range:', dateRange7Days);
      const pages7Days = await DashboardAnalyticsService.getNewPagesCreated(dateRange7Days, 10);
      
      testResults.tests.push({
        name: 'Last 7 Days Pages Analytics',
        success: true,
        data: {
          dateRange: dateRange7Days,
          dataLength: pages7Days.length,
          totalPages: pages7Days.reduce((sum, item) => sum + item.totalPages, 0),
          daysWithData: pages7Days.filter(item => item.totalPages > 0).length,
          sampleData: pages7Days.slice(0, 5)
        }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Last 7 Days Pages Analytics',
        success: false,
        error: error.message
      });
    }
    
    // Test 2: Just July 22nd (should definitely have data)
    try {
      const july22Start = new Date('2025-07-22T00:00:00.000Z');
      const july22End = new Date('2025-07-22T23:59:59.999Z');
      
      const dateRangeJuly22 = {
        startDate: july22Start,
        endDate: july22End
      };
      
      console.log('[Test Pages Analytics] Testing July 22nd range:', dateRangeJuly22);
      const pagesJuly22 = await DashboardAnalyticsService.getNewPagesCreated(dateRangeJuly22, 5);
      
      testResults.tests.push({
        name: 'July 22nd Pages Analytics',
        success: true,
        data: {
          dateRange: dateRangeJuly22,
          dataLength: pagesJuly22.length,
          totalPages: pagesJuly22.reduce((sum, item) => sum + item.totalPages, 0),
          daysWithData: pagesJuly22.filter(item => item.totalPages > 0).length,
          allData: pagesJuly22
        }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'July 22nd Pages Analytics',
        success: false,
        error: error.message
      });
    }
    
    // Test 3: Accounts analytics for comparison
    try {
      const dateRange7Days = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      
      const accounts7Days = await DashboardAnalyticsService.getNewAccountsCreated(dateRange7Days, 10);
      
      testResults.tests.push({
        name: 'Last 7 Days Accounts Analytics (for comparison)',
        success: true,
        data: {
          dataLength: accounts7Days.length,
          totalAccounts: accounts7Days.reduce((sum, item) => sum + item.count, 0),
          daysWithData: accounts7Days.filter(item => item.count > 0).length,
          sampleData: accounts7Days.slice(0, 5)
        }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Last 7 Days Accounts Analytics (for comparison)',
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
    console.error('[Test Pages Analytics] Error:', error);
    
    return NextResponse.json({
      error: 'Pages analytics test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
