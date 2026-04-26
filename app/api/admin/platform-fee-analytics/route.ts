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


    // Get analytics data and stats in parallel for efficiency
    const [analyticsData, statsData] = await Promise.all([
      getPlatformFeeAnalytics({ startDate, endDate }, granularity),
      getPlatformFeeStats({ startDate, endDate })
    ]);


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
