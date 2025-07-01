/**
 * Pending Token Allocations API
 * 
 * Handles token allocations that can be adjusted throughout the month
 * until the allocation deadline (end of month).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { PendingTokenAllocationService } from '../../../services/pendingTokenAllocationService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase/config';

// GET - Get user's pending allocations summary
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await PendingTokenAllocationService.getUserAllocationSummary(userId);

    return NextResponse.json({
      success: true,
      data: summary
    });

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
    const { recipientUserId, resourceType, resourceId, tokens } = body;

    // Validate input
    if (!recipientUserId || !resourceType || !resourceId || !tokens) {
      return NextResponse.json({ 
        error: 'Recipient user ID, resource type, resource ID, and tokens are required' 
      }, { status: 400 });
    }

    if (!['page', 'group', 'user_bio', 'group_about'].includes(resourceType)) {
      return NextResponse.json({
        error: 'Resource type must be "page", "group", "user_bio", or "group_about"'
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
        resourceDoc = await getDoc(doc(db, 'pages', resourceId));
      } else if (resourceType === 'group') {
        resourceDoc = await getDoc(doc(db, 'groups', resourceId));
      } else if (resourceType === 'user_bio') {
        resourceDoc = await getDoc(doc(db, 'users', resourceId));
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

    // Get updated summary
    const updatedSummary = await PendingTokenAllocationService.getUserAllocationSummary(userId);

    console.log(`Pending tokens allocated: ${tokens} from ${userId} to ${recipientUserId} for ${resourceType}:${resourceId}`);

    return NextResponse.json({
      success: true,
      message: 'Tokens allocated successfully (pending until month-end)',
      allocation: {
        tokens,
        recipientUserId,
        resourceType,
        resourceId
      },
      summary: updatedSummary
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