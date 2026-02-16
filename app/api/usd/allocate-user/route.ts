import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { UsdService } from '../../../services/usdService';
import { formatUsdCents } from '../../../utils/formatCurrency';

/**
 * POST /api/usd/allocate-user
 * Allocate USD directly to a user (user-to-user donations)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientUserId, usdCentsChange } = body;


    // Validate inputs
    if (!recipientUserId) {
      return NextResponse.json({
        error: 'Recipient user ID is required'
      }, { status: 400 });
    }

    if (typeof usdCentsChange !== 'number') {
      return NextResponse.json({
        error: 'USD cents change must be a number'
      }, { status: 400 });
    }

    // Prevent self-allocation
    if (userId === recipientUserId) {
      return NextResponse.json({
        error: 'Cannot allocate USD to yourself'
      }, { status: 400 });
    }

    // Perform the allocation
    await UsdService.allocateUsdToUser(userId, recipientUserId, usdCentsChange);

    // Get updated balance
    const updatedBalance = await UsdService.getUserUsdBalance(userId);
    const currentAllocation = await UsdService.getCurrentUserAllocation(userId, recipientUserId);


    return NextResponse.json({
      success: true,
      balance: updatedBalance,
      currentUserAllocation: currentAllocation,
      message: `Successfully allocated ${formatUsdCents(Math.abs(usdCentsChange))} to user`
    });

  } catch (error) {
    console.error('USD User Allocation API: Error allocating USD to user:', error);
    
    // Return user-friendly error messages
    let errorMessage = 'Failed to allocate USD to user';
    if (error.message.includes('balance not found')) {
      errorMessage = 'USD balance not found. Please check your subscription status.';
    } else if (error.message.includes('subscription')) {
      errorMessage = 'Please check your subscription status and try again.';
    }

    return NextResponse.json({
      error: errorMessage,
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/usd/allocate-user
 * Get current allocation for a specific user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recipientUserId = searchParams.get('recipientUserId');

    if (!recipientUserId) {
      return NextResponse.json({
        error: 'Recipient user ID is required'
      }, { status: 400 });
    }


    const currentAllocation = await UsdService.getCurrentUserAllocation(userId, recipientUserId);


    return NextResponse.json({
      success: true,
      recipientUserId,
      currentAllocation,
      currentAllocationFormatted: formatUsdCents(currentAllocation)
    });

  } catch (error) {
    console.error('USD User Allocation API: Error getting user allocation:', error);
    return NextResponse.json({
      error: 'Failed to get current user allocation'
    }, { status: 500 });
  }
}
