/**
 * User Feature Flag Overrides API
 * Provides endpoints for managing user-specific feature flag overrides
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface UserOverride {
  userId: string;
  featureId: string;
  enabled: boolean;
  lastModified: string;
  modifiedBy?: string;
}

// GET endpoint - Get user's feature flag overrides
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const featureId = searchParams.get('featureId');

    // Get current user ID
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    // Determine which user's overrides to fetch
    let userIdToFetch = currentUserId;
    
    // If requesting another user's overrides, check admin permissions
    if (targetUserId && targetUserId !== currentUserId) {
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return createErrorResponse('FORBIDDEN', 'Admin access required to view other users\' overrides');
      }
      userIdToFetch = targetUserId;
    }

    // Build query
    let query = db.collection(getCollectionName('featureOverrides')).where('userId', '==', userIdToFetch);
    
    if (featureId) {
      query = query.where('featureId', '==', featureId);
    }

    const snapshot = await query.get();
    
    const overrides: UserOverride[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      overrides.push({
        userId: data.userId,
        featureId: data.featureId,
        enabled: data.enabled,
        lastModified: data.lastModified,
        modifiedBy: data.modifiedBy
      });
    });

    return createApiResponse({ overrides });

  } catch (error) {
    console.error('Error fetching user feature overrides:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch feature overrides');
  }
}

// POST endpoint - Create or update user feature flag override
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const { userId: targetUserId, featureId, enabled } = body;

    if (!targetUserId || !featureId || enabled === undefined) {
      return createErrorResponse('BAD_REQUEST', 'userId, featureId, and enabled are required');
    }

    // Check if user can modify this override
    let canModify = false;
    let modifierEmail = '';

    if (targetUserId === currentUserId) {
      // Users can modify their own overrides (if allowed by business logic)
      canModify = true;
      const userRecord = await admin.auth().getUser(currentUserId);
      modifierEmail = userRecord.email || 'unknown';
    } else {
      // Only admins can modify other users' overrides
      const adminCheck = await checkAdminPermissions(request);
      if (adminCheck.success) {
        canModify = true;
        modifierEmail = adminCheck.userEmail || 'unknown';
      }
    }

    if (!canModify) {
      return createErrorResponse('FORBIDDEN', 'Insufficient permissions to modify this override');
    }

    // Create or update the override
    const overrideRef = db.collection(getCollectionName('featureOverrides')).doc(`${targetUserId}_${featureId}`);
    
    const overrideData = {
      userId: targetUserId,
      featureId,
      enabled,
      lastModified: new Date().toISOString(),
      modifiedBy: currentUserId
    };

    await overrideRef.set(overrideData);

    // Record history
    await db.collection(getCollectionName('featureHistory')).add({
      featureId,
      userId: targetUserId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: modifierEmail,
      action: enabled ? 'enabled_for_user' : 'disabled_for_user',
      details: `Feature ${enabled ? 'enabled' : 'disabled'} for user ${targetUserId}`
    });

    return createApiResponse({
      override: overrideData,
      message: `Feature override ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Error updating user feature override:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update feature override');
  }
}

// DELETE endpoint - Remove user feature flag override
export async function DELETE(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const featureId = searchParams.get('featureId');

    if (!targetUserId || !featureId) {
      return createErrorResponse('BAD_REQUEST', 'userId and featureId are required');
    }

    // Check if user can delete this override
    let canDelete = false;
    let modifierEmail = '';

    if (targetUserId === currentUserId) {
      // Users can delete their own overrides
      canDelete = true;
      const userRecord = await admin.auth().getUser(currentUserId);
      modifierEmail = userRecord.email || 'unknown';
    } else {
      // Only admins can delete other users' overrides
      const adminCheck = await checkAdminPermissions(request);
      if (adminCheck.success) {
        canDelete = true;
        modifierEmail = adminCheck.userEmail || 'unknown';
      }
    }

    if (!canDelete) {
      return createErrorResponse('FORBIDDEN', 'Insufficient permissions to delete this override');
    }

    // Delete the override
    const overrideRef = db.collection(getCollectionName('featureOverrides')).doc(`${targetUserId}_${featureId}`);
    await overrideRef.delete();

    // Record history
    await db.collection(getCollectionName('featureHistory')).add({
      featureId,
      userId: targetUserId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: modifierEmail,
      action: 'removed_user_override',
      details: `User override removed for ${targetUserId}`
    });

    return createApiResponse({
      message: 'Feature override removed successfully'
    });

  } catch (error) {
    console.error('Error deleting user feature override:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to delete feature override');
  }
}
