import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';

/**
 * POST /api/usd/page-allocation
 * Simple USD allocation for UsdPledgeBar - allocate USD to a page
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, usdCentsChange } = body;

    // Validate input
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

    // Allocate USD using ServerUsdService
    await ServerUsdService.allocateUsdToPage(userId, pageId, usdCentsChange);

    // Get updated USD balance and allocation
    const balance = await ServerUsdService.getUserUsdBalance(userId);
    const currentAllocation = await ServerUsdService.getCurrentPageAllocation(userId, pageId);

    return NextResponse.json({
      success: true,
      balance,
      currentAllocation,
      message: 'USD allocated successfully'
    });

  } catch (error) {
    console.error('Error in USD page allocation:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/usd/page-allocation?pageId=xxx
 * Get current USD allocation for a page
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
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

    // Get current allocation
    const currentAllocation = await ServerUsdService.getCurrentPageAllocation(userId, pageId);

    return NextResponse.json({
      pageId,
      currentAllocation
    });

  } catch (error) {
    console.error('Error getting USD page allocation:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
