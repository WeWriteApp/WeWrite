import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerTokenService } from '../../../services/tokenService.server';

/**
 * POST /api/tokens/page-allocation
 *
 * @deprecated This API is deprecated and will be removed in a future version.
 * Use /api/usd/page-allocation for USD-based page allocations.
 *
 * Simple token allocation for TokenAllocationBar - allocate tokens to a page
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, tokenChange } = body;

    // Validate input
    if (!pageId) {
      return NextResponse.json({ 
        error: 'Page ID is required' 
      }, { status: 400 });
    }

    if (typeof tokenChange !== 'number') {
      return NextResponse.json({ 
        error: 'Token change must be a number' 
      }, { status: 400 });
    }

    // Allocate tokens using server-side service
    await ServerTokenService.allocateTokensToPage(userId, pageId, tokenChange);

    // Get updated token balance and allocation
    const balance = await ServerTokenService.getUserTokenBalance(userId);
    const currentAllocation = await ServerTokenService.getCurrentPageAllocation(userId, pageId);

    return NextResponse.json({
      success: true,
      balance,
      currentAllocation,
      message: 'Tokens allocated successfully'
    });

  } catch (error: any) {
    console.error('Error in token page allocation API:', error);
    
    // Allow overspending - no longer return errors for insufficient tokens

    if (error.message.includes('Token balance not found')) {
      return NextResponse.json({
        error: 'Token balance not initialized',
        message: 'Please initialize your subscription first'
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to allocate tokens' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tokens/page-allocation?pageId=xxx
 *
 * @deprecated This API is deprecated and will be removed in a future version.
 * Use /api/usd/page-allocation for USD-based page allocations.
 *
 * Get current token allocation for a page
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

    // Get current allocation using server-side service
    const currentAllocation = await ServerTokenService.getCurrentPageAllocation(userId, pageId);

    return NextResponse.json({
      pageId,
      currentAllocation
    });

  } catch (error) {
    console.error('Error getting token allocation:', error);
    return NextResponse.json(
      { error: 'Failed to get token allocation' },
      { status: 500 }
    );
  }
}