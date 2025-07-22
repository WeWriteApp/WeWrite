import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { AdminAnalyticsService } from '../../../services/adminAnalytics';

/**
 * Debug pages analytics specifically to see why 44 pages aren't showing
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Pages Debug] Testing pages analytics...');
    
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
    
    // Test last 7 days (should show 44 pages)
    try {
      const dateRange7Days = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      
      console.log('[Pages Debug] Testing 7-day range:', dateRange7Days);
      const pages7Days = await AdminAnalyticsService.getNewPagesCreated(dateRange7Days);
      
      testResults.tests.push({
        name: 'Last 7 Days Pages',
        dateRange: dateRange7Days,
        result: pages7Days,
        totalPages: pages7Days.reduce((sum, item) => sum + item.totalPages, 0),
        daysWithData: pages7Days.filter(item => item.totalPages > 0).length
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Last 7 Days Pages',
        error: error.message
      });
    }
    
    // Test last 30 days (should show even more)
    try {
      const dateRange30Days = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };
      
      console.log('[Pages Debug] Testing 30-day range:', dateRange30Days);
      const pages30Days = await AdminAnalyticsService.getNewPagesCreated(dateRange30Days);
      
      testResults.tests.push({
        name: 'Last 30 Days Pages',
        dateRange: dateRange30Days,
        result: pages30Days,
        totalPages: pages30Days.reduce((sum, item) => sum + item.totalPages, 0),
        daysWithData: pages30Days.filter(item => item.totalPages > 0).length
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Last 30 Days Pages',
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
    console.error('[Pages Debug] Error:', error);
    
    return NextResponse.json({
      error: 'Pages debug failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
