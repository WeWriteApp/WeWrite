import { NextRequest, NextResponse } from 'next/server';
import { UserDonorAnalyticsService } from '../../../../services/userDonorAnalytics';
import { getUserIdFromRequest } from '../../../auth-helper';
import { isUserAdmin } from '../../../../utils/adminSecurity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the requesting user is authenticated
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // SECURITY: Only allow users to view their own donor analytics, or admins to view any
    const isOwner = currentUserId === userId;
    const isAdmin = await isUserAdmin(currentUserId);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only view your own donor analytics' },
        { status: 403 }
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
