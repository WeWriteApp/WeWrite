/**
 * Admin API: Platform Revenue Analytics
 * Provides comprehensive platform revenue data including platform fees and unallocated funds
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { platformRevenueService } from '../../../services/platformRevenueService';

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const granularityStr = searchParams.get('granularity');
    const cumulative = searchParams.get('cumulative') === 'true';

    if (!cumulative && (!startDateStr || !endDateStr)) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate for period analysis' },
        { status: 400 }
      );
    }

    const startDate = cumulative ? new Date('2020-01-01') : new Date(startDateStr!);
    const endDate = cumulative ? new Date() : new Date(endDateStr!);
    const granularity = granularityStr ? parseInt(granularityStr) : undefined;

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    console.log('📊 [Platform Revenue API] Processing request:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      granularity,
      cumulative
    });

    // Get platform revenue data from the service
    const revenueData = await getPlatformRevenueData({ startDate, endDate }, granularity, cumulative);

    console.log('✅ [Platform Revenue API] Data fetched successfully:', {
      dataPoints: revenueData.chartData.length,
      totalRevenue: revenueData.stats.totalRevenue,
      platformFees: revenueData.stats.totalPlatformFees,
      unallocatedFunds: revenueData.stats.totalUnallocatedFunds
    });

    return NextResponse.json({
      success: true,
      chartData: revenueData.chartData,
      stats: revenueData.stats,
      metadata: {
        dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        granularity,
        dataPoints: revenueData.chartData.length,
        platformFeePercentage: 10,
        cumulative
      }
    });

  } catch (error) {
    console.error('❌ [Platform Revenue API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch platform revenue analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Mock data endpoint for development/testing
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const granularityStr = searchParams.get('granularity');

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const granularity = granularityStr ? parseInt(granularityStr) : 50;

    // Generate realistic mock data based on date range
    const diffInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const dataPoints = Math.min(Math.max(Math.floor(diffInDays), 7), 90);

    const mockData = [];
    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(startDate.getTime() + (i * (endDate.getTime() - startDate.getTime()) / dataPoints));

      // Generate realistic revenue data with some growth trend
      const basePlatformFees = 100 + (Math.random() * 200); // $100-300 platform fees
      const baseUnallocatedFunds = 50 + (Math.random() * 150); // $50-200 unallocated funds
      const trendFactor = 1 + (i / dataPoints) * 0.2; // 20% growth over period
      const randomFactor = 0.8 + (Math.random() * 0.4); // ±20% variance

      const platformFees = basePlatformFees * trendFactor * randomFactor;
      const unallocatedFunds = baseUnallocatedFunds * trendFactor * randomFactor;
      const totalRevenue = platformFees + unallocatedFunds;

      mockData.push({
        date: date.toISOString().split('T')[0],
        platformFees: Math.round(platformFees * 100) / 100,
        unallocatedFunds: Math.round(unallocatedFunds * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    // Calculate mock stats
    const totalPlatformFees = mockData.reduce((sum, item) => sum + item.platformFees, 0);
    const totalUnallocatedFunds = mockData.reduce((sum, item) => sum + item.unallocatedFunds, 0);
    const totalRevenue = mockData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const currentMonthRevenue = mockData.slice(-30).reduce((sum, item) => sum + item.totalRevenue, 0);
    const previousMonthRevenue = mockData.slice(-60, -30).reduce((sum, item) => sum + item.totalRevenue, 0);

    const growth = previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : Math.random() * 20 - 5;

    const mockStats = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPlatformFees: Math.round(totalPlatformFees * 100) / 100,
      totalUnallocatedFunds: Math.round(totalUnallocatedFunds * 100) / 100,
      monthlyRevenue: Math.round(currentMonthRevenue * 100) / 100,
      growth: Math.round(growth * 10) / 10,
      averageRevenuePerMonth: totalRevenue / (dataPoints / 30)
    };

    console.log('🧪 [Platform Revenue API] Generated mock data:', {
      dataPoints: mockData.length,
      totalRevenue: mockStats.totalRevenue,
      totalPlatformFees: mockStats.totalPlatformFees,
      totalUnallocatedFunds: mockStats.totalUnallocatedFunds
    });

    return NextResponse.json({
      success: true,
      chartData: mockData,
      stats: mockStats,
      metadata: {
        dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        granularity,
        dataPoints: mockData.length,
        platformFeePercentage: 10,
        isMockData: true,
        cumulative: false
      }
    });

  } catch (error) {
    console.error('❌ [Platform Revenue API] Mock data error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate mock platform revenue data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get platform revenue data for charting
 */
async function getPlatformRevenueData(
  dateRange: { startDate: Date; endDate: Date },
  granularity?: number,
  cumulative: boolean = false
) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  // For now, we'll aggregate monthly data from platform revenue reports
  // In the future, this could be optimized with pre-aggregated data

  const chartData = [];
  const months = [];

  // Generate month keys for the date range
  let currentDate = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1);
  const endDate = new Date(dateRange.endDate.getFullYear(), dateRange.endDate.getMonth(), 1);

  while (currentDate <= endDate) {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    months.push(monthKey);
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Get platform revenue reports for each month
  for (const month of months) {
    try {
      const report = await platformRevenueService.getPlatformRevenueReport(month);
      if (report) {
        const monthDate = new Date(month + '-01');
        chartData.push({
          date: month,
          platformFees: report.revenueStreams.platformFees.amount,
          unallocatedFunds: report.revenueStreams.unallocatedFunds.amount,
          totalRevenue: report.totalRevenue,
          label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      } else {
        // No data for this month
        const monthDate = new Date(month + '-01');
        chartData.push({
          date: month,
          platformFees: 0,
          unallocatedFunds: 0,
          totalRevenue: 0,
          label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
    } catch (error) {
      console.warn(`Failed to get platform revenue for ${month}:`, error);
      // Add zero data point
      const monthDate = new Date(month + '-01');
      chartData.push({
        date: month,
        platformFees: 0,
        unallocatedFunds: 0,
        totalRevenue: 0,
        label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
    }
  }

  // Calculate stats
  const totalPlatformFees = chartData.reduce((sum, item) => sum + item.platformFees, 0);
  const totalUnallocatedFunds = chartData.reduce((sum, item) => sum + item.unallocatedFunds, 0);
  const totalRevenue = chartData.reduce((sum, item) => sum + item.totalRevenue, 0);

  // Current month revenue (last data point)
  const currentMonthRevenue = chartData.length > 0 ? chartData[chartData.length - 1].totalRevenue : 0;

  // Previous month revenue (second to last data point)
  const previousMonthRevenue = chartData.length > 1 ? chartData[chartData.length - 2].totalRevenue : 0;

  const growth = previousMonthRevenue > 0
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : 0;

  const averageRevenuePerMonth = chartData.length > 0 ? totalRevenue / chartData.length : 0;

  const stats = {
    totalRevenue,
    totalPlatformFees,
    totalUnallocatedFunds,
    monthlyRevenue: currentMonthRevenue,
    growth,
    averageRevenuePerMonth
  };

  return { chartData, stats };
}