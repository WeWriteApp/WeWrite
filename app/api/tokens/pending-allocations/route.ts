/**
 * Pending Token Allocations API
 * 
 * Handles token allocations that can be adjusted throughout the month
 * until the allocation deadline (end of month).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { PendingTokenAllocationService } from '../../../services/pendingTokenAllocationService';
import { ServerTokenService } from '../../../services/tokenService.server';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from "../../../utils/environmentConfig";

// GET - Get user's pending allocations summary
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'allocator' (default) or 'recipient'

    if (mode === 'recipient') {
      // Get pending allocations where this user is the recipient
      const recipientData = await PendingTokenAllocationService.getRecipientPendingAllocations(userId);

      // Enrich allocations with username data
      const enrichedAllocations = await Promise.all(
        recipientData.allocations.map(async (allocation) => {
          try {
            // Get user document to fetch username
            const userDoc = await getDoc(doc(db, getCollectionName('users'), allocation.userId));
            const userData = userDoc.exists() ? userDoc.data() : null;

            return {
              ...allocation,
              fromUserId: allocation.userId,
              fromUsername: userData?.username || userData?.displayName || allocation.userId,
              // Map fields to match RecentAllocationsCard expectations
              resourceTitle: allocation.resourceId, // We'll need to fetch actual titles later if needed
              usdValue: allocation.tokens * 0.1 // Convert tokens to USD
            };
          } catch (error) {
            console.error('Error enriching allocation with user data:', error);
            return {
              ...allocation,
              fromUserId: allocation.userId,
              fromUsername: allocation.userId,
              resourceTitle: allocation.resourceId,
              usdValue: allocation.tokens * 0.1
            };
          }
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          ...recipientData,
          allocations: enrichedAllocations
        }
      });
    } else {
      // Default: Get allocations where this user is the allocator
      const summary = await PendingTokenAllocationService.getUserAllocationSummary(userId);

      return NextResponse.json({
        success: true,
        data: summary
      });
    }

  } catch (error) {
    console.error('Error getting pending allocations:', error);
    return NextResponse.json(
      { error: 'Failed to get pending allocations' },
      { status: 500 }
    );
  }
}

// POST - Create or update a token allocation
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientUserId, resourceType, resourceId, tokens, source } = body;

    // Validate input
    if (!recipientUserId || !resourceType || !resourceId || !tokens) {
      return NextResponse.json({ 
        error: 'Recipient user ID, resource type, resource ID, and tokens are required' 
      }, { status: 400 });
    }

    if (!['page', 'group', 'user_bio', 'user', 'group_about'].includes(resourceType)) {
      return NextResponse.json({
        error: 'Resource type must be "page", "group", "user_bio", "user", or "group_about"'
      }, { status: 400 });
    }

    if (typeof tokens !== 'number' || tokens <= 0) {
      return NextResponse.json({
        error: 'Tokens must be a positive number'
      }, { status: 400 });
    }

    // Verify the resource exists and recipient owns it
    let resourceDoc;
    try {
      if (resourceType === 'page') {
        resourceDoc = await getDoc(doc(db, getCollectionName("pages"), resourceId));
      } else if (resourceType === 'group') {
        resourceDoc = await getDoc(doc(db, 'groups', resourceId));
      } else if (resourceType === 'user_bio') {
        resourceDoc = await getDoc(doc(db, getCollectionName("users"), resourceId));
        // For user_bio, the resourceId should match recipientUserId
        if (resourceId !== recipientUserId) {
          return NextResponse.json({
            error: 'Invalid user bio resource'
          }, { status: 400 });
        }
      } else if (resourceType === 'group_about') {
        resourceDoc = await getDoc(doc(db, 'groups', resourceId));
      }

      if (!resourceDoc?.exists()) {
        return NextResponse.json({
          error: 'Resource not found'
        }, { status: 404 });
      }

      // Verify ownership (except for user_bio which we already validated)
      if (resourceType !== 'user_bio') {
        const resourceData = resourceDoc.data();
        const ownerField = resourceType === 'group' || resourceType === 'group_about' ? 'ownerId' : 'userId';
        
        if (resourceData[ownerField] !== recipientUserId) {
          return NextResponse.json({
            error: 'Recipient does not own this resource'
          }, { status: 400 });
        }
      }

    } catch (error) {
      return NextResponse.json({
        error: 'Failed to verify resource'
      }, { status: 400 });
    }

    // Allocate tokens
    const result = await PendingTokenAllocationService.allocateTokens(
      userId,
      recipientUserId,
      resourceType,
      resourceId,
      tokens
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 400 });
    }

    // Get updated summary, current allocation, and balance
    const [updatedSummary, currentAllocation, balance] = await Promise.all([
      PendingTokenAllocationService.getUserAllocationSummary(userId),
      PendingTokenAllocationService.getCurrentPageAllocation(userId, resourceId),
      ServerTokenService.getUserTokenBalance(userId)
    ]);

    // Log allocation with source tracking
    console.log(`Pending tokens allocated: ${tokens} from ${userId} to ${recipientUserId} for ${resourceType}:${resourceId} (source: ${source || 'unknown'})`);

    // Track allocation source for analytics
    if (source) {
      console.log(`[ANALYTICS] TokenAllocation: source=${source}, tokens=${tokens}, resourceType=${resourceType}, userId=${userId}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Tokens allocated successfully (pending until month-end)',
      allocation: {
        tokens,
        recipientUserId,
        resourceType,
        resourceId
      },
      summary: updatedSummary,
      currentAllocation: currentAllocation,
      balance: {
        totalTokens: balance?.totalTokens || 0,
        allocatedTokens: balance?.allocatedTokens || 0,
        availableTokens: (balance?.totalTokens || 0) - (balance?.allocatedTokens || 0)
      }
    });

  } catch (error) {
    console.error('Error allocating pending tokens:', error);
    return NextResponse.json(
      { error: 'Failed to allocate tokens' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a token allocation
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType') as 'page' | 'group' | 'user_bio' | 'group_about';
    const resourceId = searchParams.get('resourceId');

    if (!resourceType || !resourceId) {
      return NextResponse.json({ 
        error: 'Resource type and resource ID are required' 
      }, { status: 400 });
    }

    if (!['page', 'group', 'user_bio', 'group_about'].includes(resourceType)) {
      return NextResponse.json({
        error: 'Invalid resource type'
      }, { status: 400 });
    }

    // Remove allocation
    const result = await PendingTokenAllocationService.removeAllocation(
      userId,
      resourceType,
      resourceId
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 400 });
    }

    // Get updated summary
    const updatedSummary = await PendingTokenAllocationService.getUserAllocationSummary(userId);

    console.log(`Pending token allocation removed: ${userId} for ${resourceType}:${resourceId}`);

    return NextResponse.json({
      success: true,
      message: 'Token allocation removed successfully',
      summary: updatedSummary
    });

  } catch (error) {
    console.error('Error removing pending token allocation:', error);
    return NextResponse.json(
      { error: 'Failed to remove token allocation' },
      { status: 500 }
    );
  }
}