import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { AdminAnalyticsService } from '../../../services/adminAnalytics';

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
        data = await AdminAnalyticsService.getNewAccountsCreated(dateRange);
        break;
      case 'pages':
        data = await AdminAnalyticsService.getNewPagesCreated(dateRange);
        break;
      case 'shares':
        data = await AdminAnalyticsService.getAnalyticsEvents(dateRange, 'share_event');
        break;
      case 'edits':
        data = await AdminAnalyticsService.getAnalyticsEvents(dateRange, 'edit_event');
        break;
      case 'contentChanges':
        data = await AdminAnalyticsService.getAnalyticsEvents(dateRange, 'content_change');
        break;
      case 'pwaInstalls':
        data = await AdminAnalyticsService.getAnalyticsEvents(dateRange, 'pwa_install');
        break;
      case 'pwaNotifications':
        data = await AdminAnalyticsService.getAnalyticsEvents(dateRange, 'pwa_notification_sent');
        break;
      case 'notificationsSent':
        data = await AdminAnalyticsService.getNotificationsSentAnalytics(dateRange);
        break;
      case 'replies':
        data = await AdminAnalyticsService.getRepliesAnalytics(dateRange);
        break;
      case 'visitors':
        // Use pageViews data for visitors metric
        const pageViewsData = await AdminAnalyticsService.getPageViewsAnalytics(dateRange);
        // Transform to visitor format expected by dashboard
        data = pageViewsData.map(item => ({
          ...item,
          total: item.totalViews || 0,
          count: item.totalViews || 0,
          uniquePages: item.uniqueViews || 0
        }));
        break;
      case 'pageViews':
        data = await AdminAnalyticsService.getPageViewsAnalytics(dateRange);
        break;
      case 'subscriptions':
        data = await AdminAnalyticsService.getSubscriptionsCreated(dateRange);
        break;
      case 'revenue':
        data = await AdminAnalyticsService.getSubscriptionRevenue(dateRange);
        break;
      case 'all':
        // Get all metrics using the new simplified service
        data = await AdminAnalyticsService.getAllDashboardAnalytics(dateRange);
        break;
      default:
        return createErrorResponse('BAD_REQUEST', 'Invalid analytics type. Must be one of: accounts, pages, shares, edits, contentChanges, pwaInstalls, pwaNotifications, notificationsSent, replies, visitors, pageViews, subscriptions, revenue, all');
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
