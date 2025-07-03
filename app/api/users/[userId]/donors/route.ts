import { NextRequest, NextResponse } from 'next/server';
import { UserDonorAnalyticsService } from '../../../../services/userDonorAnalytics';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get donor analytics for the user
    const donorStats = await UserDonorAnalyticsService.getUserDonorAnalytics(userId);

    return NextResponse.json({
      success: true,
      data: donorStats
    });

  } catch (error) {
    console.error('Error fetching user donor analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch donor analytics' },
      { status: 500 }
    );
  }
}
