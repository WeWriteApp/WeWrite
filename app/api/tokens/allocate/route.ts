/**
 * Token Allocation API
 *
 * DEPRECATED: This API is being migrated to USD-based system
 * Use /api/usd/allocate for new implementations
 *
 * Allows users to allocate their monthly tokens to creators
 * Now delegates to USD system with token-to-USD conversion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';
import { migrateTokensToUsdCents } from '../../../utils/formatCurrency';
import { MIGRATION_HELPERS } from '../../../utils/usdConstants';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
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

    // Prevent self-allocation
    if (userId === recipientUserId) {
      return NextResponse.json({ 
        error: 'Cannot allocate tokens to yourself' 
      }, { status: 400 });
    }

    // Verify the resource exists and get recipient info
    let resourceData: any = null;

    if (resourceType === 'user_bio') {
      // For user bio, the resourceId is the user ID
      if (resourceId.replace('user_bio_', '') !== recipientUserId) {
        return NextResponse.json({
          error: 'Invalid user bio resource ID'
        }, { status: 400 });
      }
      resourceData = { userId: recipientUserId }; // Mock resource data for user bio
    } else if (resourceType === 'group_about') {
      // For group about, verify the group exists and get owner
      const groupId = resourceId.replace('group_about_', '');
      const groupRef = doc(db, 'groups', groupId);
      const groupDoc = await getDoc(groupRef);

      if (!groupDoc.exists()) {
        return NextResponse.json({
          error: 'Group not found'
        }, { status: 404 });
      }

      resourceData = groupDoc.data();
      if (resourceData.ownerId !== recipientUserId) {
        return NextResponse.json({
          error: 'Recipient does not own this group'
        }, { status: 400 });
      }
    } else {
      // Regular page or group
      const collectionName = resourceType === 'page' ? 'pages' : 'groups';
      const resourceRef = doc(db, collectionName, resourceId);
      const resourceDoc = await getDoc(resourceRef);

      if (!resourceDoc.exists()) {
        return NextResponse.json({
          error: 'Resource not found'
        }, { status: 404 });
      }

      resourceData = resourceDoc.data();

      // Verify the recipient owns the resource
      const ownerField = resourceType === 'group' ? 'ownerId' : 'userId';
      if (resourceData[ownerField] !== recipientUserId) {
        return NextResponse.json({
          error: 'Recipient does not own this resource'
        }, { status: 400 });
      }
    }

    // Convert tokens to USD cents for allocation
    const usdCents = migrateTokensToUsdCents(tokens);

    // Allocate USD (delegating to USD system)
    const result = await ServerUsdService.allocateUsd(
      userId,
      recipientUserId,
      resourceType,
      resourceId,
      usdCents
    );

    if (!result.success) {
      return NextResponse.json({
        error: result.error
      }, { status: 400 });
    }

    // Get updated USD balance and convert back to token format for backward compatibility
    const updatedUsdBalance = await ServerUsdService.getUserUsdBalance(userId);
    const updatedBalance = updatedUsdBalance ? {
      totalTokens: MIGRATION_HELPERS.usdCentsToTokens(updatedUsdBalance.totalUsdCents),
      allocatedTokens: MIGRATION_HELPERS.usdCentsToTokens(updatedUsdBalance.allocatedUsdCents),
      availableTokens: MIGRATION_HELPERS.usdCentsToTokens(updatedUsdBalance.availableUsdCents || 0)
    } : null;

    console.log(`Tokens allocated (via USD): ${tokens} tokens (${usdCents} cents) from ${userId} to ${recipientUserId} for ${resourceType}:${resourceId}`);

    return NextResponse.json({
      success: true,
      message: 'Tokens allocated successfully',
      allocation: {
        tokens,
        recipientUserId,
        resourceType,
        resourceId
      },
      updatedBalance
    });

  } catch (error) {
    console.error('Error allocating tokens:', error);
    return NextResponse.json(
      { error: 'Failed to allocate tokens' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');

    // Validate input
    if (!resourceType || !resourceId) {
      return NextResponse.json({ 
        error: 'Resource type and resource ID are required' 
      }, { status: 400 });
    }

    if (!['page', 'group', 'user_bio', 'group_about'].includes(resourceType)) {
      return NextResponse.json({
        error: 'Resource type must be "page", "group", "user_bio", or "group_about"'
      }, { status: 400 });
    }

    // Remove allocation
    const result = await ServerTokenService.removeTokenAllocation(
      userId,
      resourceType as 'page' | 'group' | 'user_bio' | 'group_about',
      resourceId
    );

    if (!result.success) {
      return NextResponse.json({
        error: result.error
      }, { status: 400 });
    }

    // Get updated token balance
    const updatedBalance = await ServerTokenService.getUserTokenBalance(userId);

    console.log(`Token allocation removed: ${userId} for ${resourceType}:${resourceId}`);

    return NextResponse.json({
      success: true,
      message: 'Token allocation removed successfully',
      updatedBalance
    });

  } catch (error) {
    console.error('Error removing token allocation:', error);
    return NextResponse.json(
      { error: 'Failed to remove token allocation' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}