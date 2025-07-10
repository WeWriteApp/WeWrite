import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenService } from '../../../services/tokenService';

// POST /api/tokens/update-allocation - Update user's monthly token allocation
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { monthlyTokens } = await request.json();

    console.log(`[TOKEN UPDATE] Updating allocation for user ${userId} to ${monthlyTokens} tokens`);

    // Validate input
    if (typeof monthlyTokens !== 'number' || monthlyTokens < 0) {
      return NextResponse.json({ 
        error: 'Invalid monthlyTokens value' 
      }, { status: 400 });
    }

    // Update token allocation
    await TokenService.updateMonthlyTokenAllocation(userId, monthlyTokens);

    console.log(`[TOKEN UPDATE] Successfully updated allocation for user ${userId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Token allocation updated successfully',
      monthlyTokens
    });

  } catch (error) {
    console.error('[TOKEN UPDATE] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update token allocation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
