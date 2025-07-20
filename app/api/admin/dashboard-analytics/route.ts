import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { DashboardAnalyticsService } from '../../../services/dashboardAnalytics';

/**
 * Admin Dashboard Analytics API
 * GET /api/admin/dashboard-analytics
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse(
        adminCheck.error === 'Unauthorized - no user ID' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        adminCheck.error
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const granularity = parseInt(searchParams.get('granularity') || '50');
    const type = searchParams.get('type'); // accounts, pages, shares, edits, contentChanges, pwaInstalls, visitors

    if (!startDateStr || !endDateStr) {
      return createErrorResponse('BAD_REQUEST', 'startDate and endDate are required');
    }

    const dateRange = {
      startDate: new Date(startDateStr),
      endDate: new Date(endDateStr)
    };

    // Validate date range
    if (isNaN(dateRange.startDate.getTime()) || isNaN(dateRange.endDate.getTime())) {
      return createErrorResponse('BAD_REQUEST', 'Invalid date format');
    }

    let data;

    // Route to appropriate analytics method based on type
    switch (type) {
      case 'accounts':
        data = await DashboardAnalyticsService.getNewAccountsCreated(dateRange, granularity);
        break;
      case 'pages':
        data = await DashboardAnalyticsService.getNewPagesCreated(dateRange, granularity);
        break;
      case 'shares':
        data = await DashboardAnalyticsService.getSharesAnalytics(dateRange, granularity);
        break;
      case 'edits':
        data = await DashboardAnalyticsService.getEditsAnalytics(dateRange, granularity);
        break;
      case 'contentChanges':
        data = await DashboardAnalyticsService.getContentChangesAnalytics(dateRange, granularity);
        break;
      case 'pwaInstalls':
        data = await DashboardAnalyticsService.getPWAInstallsAnalytics(dateRange, granularity);
        break;
      case 'visitors':
        data = await DashboardAnalyticsService.getVisitorAnalytics(dateRange, granularity);
        break;
      case 'all':
        // Get all metrics
        const [accounts, pages, shares, edits, contentChanges, pwaInstalls, visitors] = await Promise.all([
          DashboardAnalyticsService.getNewAccountsCreated(dateRange, granularity),
          DashboardAnalyticsService.getNewPagesCreated(dateRange, granularity),
          DashboardAnalyticsService.getSharesAnalytics(dateRange, granularity),
          DashboardAnalyticsService.getEditsAnalytics(dateRange, granularity),
          DashboardAnalyticsService.getContentChangesAnalytics(dateRange, granularity),
          DashboardAnalyticsService.getPWAInstallsAnalytics(dateRange, granularity),
          DashboardAnalyticsService.getVisitorAnalytics(dateRange, granularity)
        ]);

        data = {
          accounts,
          pages,
          shares,
          edits,
          contentChanges,
          pwaInstalls,
          visitors
        };
        break;
      default:
        return createErrorResponse('BAD_REQUEST', 'Invalid analytics type. Must be one of: accounts, pages, shares, edits, contentChanges, pwaInstalls, visitors, all');
    }

    return createApiResponse({
      type,
      dateRange: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      },
      granularity,
      data
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch dashboard analytics');
  }
}
