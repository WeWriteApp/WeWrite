/**
 * Development endpoint to create test token allocations
 * This bypasses normal validation for testing purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { PendingTokenAllocationService } from '../../../services/pendingTokenAllocationService';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getTimeUntilAllocationDeadline } from '../../../utils/subscriptionTiers';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      fromUserId = 'dev_test_user_2', 
      toUserId = 'dev_test_user_1', 
      tokens = 15,
      pageId = 'test_page_123'
    } = body;

    console.log(`Creating test allocation: ${tokens} tokens from ${fromUserId} to ${toUserId} for page ${pageId}`);

    console.log(`Creating test allocation: ${tokens} tokens from ${fromUserId} to ${toUserId} for page ${pageId}`);

    // Create the allocation
    const result = await PendingTokenAllocationService.allocateTokens(
      fromUserId,
      toUserId,
      'page',
      pageId,
      tokens
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Created test allocation: ${tokens} tokens from ${fromUserId} to ${toUserId}`,
        data: result
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error creating test allocation:', error);
    return NextResponse.json({
      error: 'Failed to create test allocation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
