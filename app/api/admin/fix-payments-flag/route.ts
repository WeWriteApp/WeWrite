/**
 * Admin endpoint to fix payments feature flag for specific users
 * This ensures jamiegray2234@gmail.com has the payments feature enabled
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Target user email
    const targetEmail = 'jamiegray2234@gmail.com';
    
    // Find user by email
    const usersRef = db.collection(getCollectionName('users'));
    const userQuery = await usersRef.where('email', '==', targetEmail).get();
    
    if (userQuery.empty) {
      return NextResponse.json({
        error: 'User not found',
        email: targetEmail
      }, { status: 404 });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    console.log(`🔧 Setting up payments feature flag for user:`, {
      userId,
      email: userData.email,
      username: userData.username
    });

    // Create feature flag override
    const overrideRef = db.collection(getCollectionName('featureOverrides')).doc(`${userId}_payments`);
    
    const overrideData = {
      userId,
      featureId: 'payments',
      enabled: true,
      lastModified: new Date().toISOString(),
      modifiedBy: adminCheck.adminUserId,
      reason: 'Admin override for payments feature access'
    };

    await overrideRef.set(overrideData);

    // Also ensure global payments flag is enabled
    const featureFlagsRef = db.collection(getCollectionName('config')).doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();
    
    let currentFlags = {};
    if (featureFlagsDoc.exists) {
      currentFlags = featureFlagsDoc.data() || {};
    }

    // Update global flags to ensure payments is enabled
    await featureFlagsRef.set({
      ...currentFlags,
      payments: true
    }, { merge: true });

    // Record history
    await db.collection(getCollectionName('featureHistory')).add({
      featureId: 'payments',
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: adminCheck.adminEmail,
      action: 'enabled_for_user',
      details: `Payments feature enabled for ${targetEmail} via admin fix endpoint`
    });

    return NextResponse.json({
      success: true,
      message: 'Payments feature flag enabled successfully',
      user: {
        userId,
        email: userData.email,
        username: userData.username
      },
      override: overrideData,
      globalPaymentsEnabled: true
    });

  } catch (error) {
    console.error('Error fixing payments feature flag:', error);
    return NextResponse.json({
      error: 'Failed to fix payments feature flag',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check current status
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const targetEmail = 'jamiegray2234@gmail.com';
    
    // Find user by email
    const usersRef = db.collection(getCollectionName('users'));
    const userQuery = await usersRef.where('email', '==', targetEmail).get();
    
    if (userQuery.empty) {
      return NextResponse.json({
        error: 'User not found',
        email: targetEmail
      }, { status: 404 });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Check global payments flag
    const featureFlagsRef = db.collection(getCollectionName('config')).doc('featureFlags');
    const featureFlagsDoc = await featureFlagsRef.get();
    
    let globalPaymentsEnabled = false;
    if (featureFlagsDoc.exists) {
      const flagsData = featureFlagsDoc.data() || {};
      globalPaymentsEnabled = flagsData.payments === true;
    }

    // Check user override
    const overrideRef = db.collection(getCollectionName('featureOverrides')).doc(`${userId}_payments`);
    const overrideDoc = await overrideRef.get();
    
    let userOverride = null;
    if (overrideDoc.exists) {
      userOverride = overrideDoc.data();
    }

    return NextResponse.json({
      user: {
        userId,
        email: userData.email,
        username: userData.username
      },
      globalPaymentsEnabled,
      userOverride,
      effectivePaymentsEnabled: userOverride?.enabled ?? globalPaymentsEnabled
    });

  } catch (error) {
    console.error('Error checking payments feature flag status:', error);
    return NextResponse.json({
      error: 'Failed to check payments feature flag status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
