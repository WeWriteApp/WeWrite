/**
 * Admin API: User Management
 * Provides endpoints for managing users in the admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { isAdminServer } from '../../../utils/server-feature-flags';

interface UserData {
  uid: string;
  email: string;
  username?: string;
  emailVerified: boolean;
  createdAt: any;
  lastLogin?: any;
  featureFlags: {
    payments: boolean | null;
    map_view: boolean | null;
    calendar_view: boolean | null;
  };
}

// GET endpoint - Get all users with their details and feature flag overrides
export async function GET(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const searchTerm = searchParams.get('search');

    console.log('Loading users from Firestore via API...');

    // Query Firestore for user documents
    let usersQuery = db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snapshot = await usersQuery.get();

    if (snapshot.empty) {
      console.warn('No users found in Firestore');
      return NextResponse.json({
        success: true,
        users: [],
        message: 'No users found in the database'
      });
    }

    console.log(`Found ${snapshot.docs.length} users in Firestore`);
    const userData: UserData[] = [];

    // Get feature flag overrides for all users
    const overridesSnapshot = await db.collection('featureOverrides').get();
    const overridesMap = new Map();
    
    overridesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!overridesMap.has(data.userId)) {
        overridesMap.set(data.userId, {});
      }
      overridesMap.get(data.userId)[data.featureId] = data.enabled;
    });

    for (const userDoc of snapshot.docs) {
      try {
        const data = userDoc.data();

        // Get email verification status from Firebase Auth
        let emailVerified = false;
        try {
          const authUser = await admin.auth().getUser(userDoc.id);
          emailVerified = authUser.emailVerified;
        } catch (authError) {
          console.warn(`Could not get auth data for user ${userDoc.id}:`, authError.message);
        }

        // Get feature flag overrides for this user
        const userOverrides = overridesMap.get(userDoc.id) || {};

        const user: UserData = {
          uid: userDoc.id,
          email: data.email || 'No email',
          username: data.username,
          emailVerified,
          createdAt: data.createdAt,
          lastLogin: data.lastLogin,
          featureFlags: {
            payments: userOverrides.payments ?? null,
            map_view: userOverrides.map_view ?? null,
            calendar_view: userOverrides.calendar_view ?? null
          }
        };

        // Apply search filter if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const emailMatch = user.email.toLowerCase().includes(searchLower);
          const usernameMatch = user.username?.toLowerCase().includes(searchLower);

          if (emailMatch || usernameMatch) {
            userData.push(user);
          }
        } else {
          userData.push(user);
        }

      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error);
        // Continue processing other users
      }
    }

    console.log(`Processed ${userData.length} users successfully`);

    return NextResponse.json({
      success: true,
      users: userData,
      total: userData.length
    });

  } catch (error) {
    console.error('Error loading users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load users',
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint - Update user feature flag overrides
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, featureId, enabled } = body;

    if (!targetUserId || !featureId || enabled === undefined) {
      return NextResponse.json({ 
        error: 'targetUserId, featureId, and enabled are required' 
      }, { status: 400 });
    }

    // Update or create feature flag override
    const overrideRef = db.collection('featureOverrides').doc(`${targetUserId}_${featureId}`);
    
    if (enabled === null) {
      // Remove override (revert to global setting)
      await overrideRef.delete();
    } else {
      // Set override
      await overrideRef.set({
        userId: targetUserId,
        featureId,
        enabled,
        lastModified: new Date().toISOString(),
        modifiedBy: userId
      });
    }

    return NextResponse.json({
      success: true,
      message: `Feature flag ${featureId} ${enabled === null ? 'reset' : enabled ? 'enabled' : 'disabled'} for user ${targetUserId}`
    });

  } catch (error) {
    console.error('Error updating user feature flag:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update feature flag',
      details: error.message
    }, { status: 500 });
  }
}
