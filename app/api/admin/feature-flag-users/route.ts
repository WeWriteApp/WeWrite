/**
 * Admin API: Feature Flag User Management
 * Provides endpoints for managing user access to feature flags
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { isAdminServer } from '../../../utils/server-feature-flags';

interface UserFeature {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  lastModified: string;
  overridden: boolean;
}

// GET endpoint - Get all users and their access status for a feature flag
export async function GET(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin!.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const featureFlagId = searchParams.get('featureFlagId');
    const globalEnabled = searchParams.get('globalEnabled') === 'true';

    if (!featureFlagId) {
      return NextResponse.json({ error: 'featureFlagId is required' }, { status: 400 });
    }

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    // Get user-specific feature overrides
    const overridesSnapshot = await db.collection('featureOverrides')
      .where('featureId', '==', featureFlagId)
      .get();

    // Create a map of user IDs to their feature override
    const overridesMap = new Map();
    overridesSnapshot.forEach(doc => {
      const data = doc.data();
      overridesMap.set(data.userId, {
        enabled: data.enabled,
        lastModified: data.lastModified
      });
    });

    // Build user list with feature status
    const userList: UserFeature[] = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const override = overridesMap.get(doc.id);
      
      // Determine effective access
      let effectiveAccess = globalEnabled; // Default to global setting
      let isOverridden = false;
      
      if (override) {
        effectiveAccess = override.enabled;
        isOverridden = true;
      }

      userList.push({
        id: doc.id,
        username: userData.username || 'No username',
        email: userData.email || 'No email',
        enabled: effectiveAccess,
        lastModified: override?.lastModified || 'Never',
        overridden: isOverridden
      });
    });

    return NextResponse.json({
      success: true,
      users: userList
    });

  } catch (error) {
    console.error('Error fetching feature flag users:', error);
    return NextResponse.json({
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST endpoint - Update user access for a feature flag
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin!.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, featureFlagId, targetUserId, enabled } = await request.json();

    if (!action || !featureFlagId || !targetUserId) {
      return NextResponse.json({ 
        error: 'Missing required fields: action, featureFlagId, targetUserId' 
      }, { status: 400 });
    }

    switch (action) {
      case 'toggleAccess':
        // Update user-specific feature override
        const featureOverrideRef = db.collection('featureOverrides').doc(`${targetUserId}_${featureFlagId}`);

        await featureOverrideRef.set({
          userId: targetUserId,
          featureId: featureFlagId,
          enabled: enabled,
          lastModified: new Date().toISOString()
        });

        // Record history
        await db.collection('featureHistory').add({
          featureId: featureFlagId,
          userId: targetUserId,
          timestamp: admin!.firestore.FieldValue.serverTimestamp(),
          adminEmail: userEmail,
          action: enabled ? 'enabled_for_user' : 'disabled_for_user',
          details: `Feature ${enabled ? 'enabled' : 'disabled'} for user ${targetUserId}`
        });

        return NextResponse.json({
          success: true,
          message: `User access ${enabled ? 'enabled' : 'disabled'} successfully`
        });

      case 'removeOverride':
        // Remove user-specific override
        const overrideRef = db.collection('featureOverrides').doc(`${targetUserId}_${featureFlagId}`);
        await overrideRef.delete();

        // Record history
        await db.collection('featureHistory').add({
          featureId: featureFlagId,
          userId: targetUserId,
          timestamp: admin!.firestore.FieldValue.serverTimestamp(),
          adminEmail: userEmail,
          action: 'removed_user_override',
          details: `User override removed for ${targetUserId}`
        });

        return NextResponse.json({
          success: true,
          message: 'User override removed successfully'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error updating feature flag user access:', error);
    return NextResponse.json({
      error: 'Failed to update user access',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
