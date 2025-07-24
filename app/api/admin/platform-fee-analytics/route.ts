import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getPlatformFeeAnalytics, getPlatformFeeStats } from '../../../services/platformFeeAnalytics';

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

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
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

    console.log('📊 [Platform Fee Analytics API] Processing request:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      granularity
    });

    // Get analytics data and stats in parallel for efficiency
    const [analyticsData, statsData] = await Promise.all([
      getPlatformFeeAnalytics({ startDate, endDate }, granularity),
      getPlatformFeeStats({ startDate, endDate })
    ]);

    console.log('✅ [Platform Fee Analytics API] Data fetched successfully:', {
      dataPoints: analyticsData.length,
      totalRevenue: statsData.totalRevenue,
      totalPayouts: statsData.totalPayouts
    });

    return NextResponse.json({
      success: true,
      data: analyticsData,
      stats: statsData,
      metadata: {
        dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        granularity,
        dataPoints: analyticsData.length,
        platformFeePercentage: 7
      }
    });

  } catch (error) {
    console.error('❌ [Platform Fee Analytics API] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch platform fee analytics',
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
    const dataPoints = Math.min(Math.max(Math.floor(diffInDays), 7), 90); // Between 7 and 90 points

    const mockData = [];
    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(startDate.getTime() + (i * (endDate.getTime() - startDate.getTime()) / dataPoints));
      
      // Generate realistic revenue data with some growth trend
      const baseRevenue = 50 + (Math.random() * 100); // $50-150 base
      const trendFactor = 1 + (i / dataPoints) * 0.3; // 30% growth over period
      const randomFactor = 0.8 + (Math.random() * 0.4); // ±20% variance
      const revenue = baseRevenue * trendFactor * randomFactor;
      
      const payouts = Math.floor(5 + Math.random() * 15); // 5-20 payouts
      const averageFee = payouts > 0 ? revenue / payouts : 0;

      mockData.push({
        date: date.toISOString().split('T')[0],
        revenue: Math.round(revenue * 100) / 100,
        payouts,
        averageFee: Math.round(averageFee * 100) / 100,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    // Calculate mock stats
    const totalRevenue = mockData.reduce((sum, item) => sum + item.revenue, 0);
    const totalPayouts = mockData.reduce((sum, item) => sum + item.payouts, 0);
    const monthlyRevenue = mockData.slice(-30).reduce((sum, item) => sum + item.revenue, 0);
    const previousMonthRevenue = mockData.slice(-60, -30).reduce((sum, item) => sum + item.revenue, 0);
    
    const growth = previousMonthRevenue > 0 
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : Math.random() * 20 - 5; // Random growth between -5% and 15%

    const mockStats = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      growth: Math.round(growth * 10) / 10,
      averageFeePerPayout: totalPayouts > 0 ? Math.round((totalRevenue / totalPayouts) * 100) / 100 : 0,
      totalPayouts
    };

    console.log('🧪 [Platform Fee Analytics API] Generated mock data:', {
      dataPoints: mockData.length,
      totalRevenue: mockStats.totalRevenue,
      totalPayouts: mockStats.totalPayouts
    });

    return NextResponse.json({
      success: true,
      data: mockData,
      stats: mockStats,
      metadata: {
        dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        granularity,
        dataPoints: mockData.length,
        platformFeePercentage: 7,
        isMockData: true
      }
    });

  } catch (error) {
    console.error('❌ [Platform Fee Analytics API] Mock data error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate mock platform fee data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
