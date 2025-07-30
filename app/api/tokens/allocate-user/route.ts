import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

/**
 * POST /api/tokens/allocate-user
 * Allocate tokens directly to a user (user-to-user donations)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientUserId, tokens } = body;

    // Validate input
    if (!recipientUserId) {
      return NextResponse.json({ 
        error: 'Recipient user ID is required' 
      }, { status: 400 });
    }

    if (typeof tokens !== 'number' || tokens <= 0) {
      return NextResponse.json({ 
        error: 'Tokens must be a positive number' 
      }, { status: 400 });
    }

    // Prevent self-allocation
    if (userId === recipientUserId) {
      return NextResponse.json({
        error: 'Cannot allocate tokens to yourself'
      }, { status: 400 });
    }

    // Use the existing pending allocations API with user resource type
    const allocationResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tokens/pending-allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'Cookie': request.headers.get('Cookie') || ''
      },
      body: JSON.stringify({
        recipientUserId,
        resourceType: 'user',
        resourceId: recipientUserId, // For user donations, resourceId is the same as recipientUserId
        tokens,
        source: 'user_donation'
      })
    });

    if (!allocationResponse.ok) {
      const errorData = await allocationResponse.json();
      return NextResponse.json({
        error: errorData.error || 'Failed to allocate tokens'
      }, { status: allocationResponse.status });
    }

    const result = await allocationResponse.json();

    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${tokens} tokens to user`,
      allocation: result.allocation,
      balance: result.balance
    });

  } catch (error) {
    console.error('Error allocating tokens to user:', error);
    return NextResponse.json(
      { error: 'Failed to allocate tokens to user' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tokens/allocate-user?recipientUserId=xxx
 * Get current token allocation to a specific user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
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

    // Get current allocation using the existing pending allocations API
    const allocationResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/tokens/pending-allocations?recipientUserId=${recipientUserId}&resourceType=user&resourceId=${recipientUserId}`,
      {
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Cookie': request.headers.get('Cookie') || ''
        }
      }
    );

    if (!allocationResponse.ok) {
      return NextResponse.json({
        recipientUserId,
        currentAllocation: 0
      });
    }

    const result = await allocationResponse.json();
    const allocation = result.allocations?.[0];

    return NextResponse.json({
      recipientUserId,
      currentAllocation: allocation?.tokens || 0
    });

  } catch (error) {
    console.error('Error getting user allocation:', error);
    return NextResponse.json(
      { error: 'Failed to get user allocation' },
      { status: 500 }
    );
  }
}
