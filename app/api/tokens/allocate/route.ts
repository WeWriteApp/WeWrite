/**
 * Token Allocation API
 * 
 * Allows users to allocate their monthly tokens to creators
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenService } from '../../../services/tokenService';
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

    if (!['page', 'group'].includes(resourceType)) {
      return NextResponse.json({ 
        error: 'Resource type must be "page" or "group"' 
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
    const resourceRef = doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId);
    const resourceDoc = await getDoc(resourceRef);
    
    if (!resourceDoc.exists()) {
      return NextResponse.json({ 
        error: 'Resource not found' 
      }, { status: 404 });
    }

    const resourceData = resourceDoc.data();
    
    // Verify the recipient owns the resource
    if (resourceData.userId !== recipientUserId) {
      return NextResponse.json({ 
        error: 'Recipient does not own this resource' 
      }, { status: 400 });
    }

    // Allocate tokens
    const result = await TokenService.allocateTokens(
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

    // Get updated token balance
    const updatedBalance = await TokenService.getUserTokenBalance(userId);

    console.log(`Tokens allocated: ${tokens} from ${userId} to ${recipientUserId} for ${resourceType}:${resourceId}`);

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

    if (!['page', 'group'].includes(resourceType)) {
      return NextResponse.json({ 
        error: 'Resource type must be "page" or "group"' 
      }, { status: 400 });
    }

    // Remove allocation
    const result = await TokenService.removeTokenAllocation(
      userId,
      resourceType as 'page' | 'group',
      resourceId
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 400 });
    }

    // Get updated token balance
    const updatedBalance = await TokenService.getUserTokenBalance(userId);

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
