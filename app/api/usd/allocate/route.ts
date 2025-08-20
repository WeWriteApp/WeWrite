import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';
import { dollarsToCents, centsToDollars, formatUsdCents } from '../../../utils/formatCurrency';
import { AllocationError, ALLOCATION_ERROR_CODES } from '../../../types/allocation';

/**
 * POST /api/usd/allocate
 * Allocate USD to a page
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, usdCentsChange } = body;

    console.log(`🎯 USD Allocation API: Allocating for user ${userId}:`, {
      pageId,
      usdCentsChange,
      usdAmountFormatted: formatUsdCents(Math.abs(usdCentsChange))
    });

    // Validate inputs
    if (!pageId) {
      return NextResponse.json({
        error: 'Page ID is required'
      }, { status: 400 });
    }

    if (typeof usdCentsChange !== 'number') {
      return NextResponse.json({
        error: 'USD cents change must be a number'
      }, { status: 400 });
    }

    // Perform the allocation
    await ServerUsdService.allocateUsdToPage(userId, pageId, usdCentsChange);

    // Get updated balance
    const updatedBalance = await ServerUsdService.getUserUsdBalance(userId);
    const currentAllocation = await ServerUsdService.getCurrentPageAllocation(userId, pageId);

    console.log(`🎯 USD Allocation API: Allocation successful:`, {
      newAllocation: formatUsdCents(currentAllocation),
      newAvailable: updatedBalance ? formatUsdCents(updatedBalance.availableUsdCents) : '$0.00'
    });

    return NextResponse.json({
      success: true,
      balance: updatedBalance,
      currentPageAllocation: currentAllocation,
      message: `Successfully allocated ${formatUsdCents(Math.abs(usdCentsChange))} to page`
    });

  } catch (error) {
    console.error('USD Allocation API: Error allocating USD:', error);

    // Handle AllocationError with proper error codes
    if (error instanceof AllocationError) {
      return NextResponse.json({
        error: error.message,
        errorCode: error.code,
        details: error.message
      }, { status: 400 });
    }

    // Handle other specific error types
    let errorMessage = 'Failed to allocate USD';
    if (error.message.includes('Insufficient funds')) {
      // Fallback for generic insufficient funds errors
      errorMessage = error.message;
    } else if (error.message.includes('balance not found')) {
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
 * GET /api/usd/allocate
 * Get current allocation for a specific page
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({
        error: 'Page ID is required'
      }, { status: 400 });
    }

    console.log(`🎯 USD Allocation API: Getting allocation for user ${userId}, page ${pageId}`);

    const currentAllocation = await ServerUsdService.getCurrentPageAllocation(userId, pageId);

    console.log(`🎯 USD Allocation API: Current allocation:`, {
      pageId,
      allocationCents: currentAllocation,
      allocationFormatted: formatUsdCents(currentAllocation)
    });

    return NextResponse.json({
      success: true,
      pageId,
      currentAllocation,
      currentAllocationFormatted: formatUsdCents(currentAllocation)
    });

  } catch (error) {
    console.error('USD Allocation API: Error getting allocation:', error);
    return NextResponse.json({
      error: 'Failed to get current allocation'
    }, { status: 500 });
  }
}
