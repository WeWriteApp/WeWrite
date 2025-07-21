/**
 * Debug API endpoint to verify subscription environment configuration
 * This helps ensure the Current Subscription card is using the correct environment-aware collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { 
  getSubCollectionPath, 
  PAYMENT_COLLECTIONS, 
  getEnvironmentType,
  getSubscriptionEnvironmentType,
  getSubscriptionEnvironmentPrefix
} from '../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if a specific userId is requested via query parameter
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId') || authenticatedUserId;

    console.log(`[SUBSCRIPTION ENV DEBUG] Checking environment config for user: ${targetUserId}`);

    // Get environment information
    const envType = getEnvironmentType();
    const subscriptionEnvType = getSubscriptionEnvironmentType();
    const subscriptionPrefix = getSubscriptionEnvironmentPrefix();

    // Get collection paths
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      targetUserId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    // Check if subscription document exists in the expected path
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    let subscriptionExists = false;
    let subscriptionData = null;
    let rawData = null;

    try {
      const subscriptionRef = db.doc(parentPath).collection(subCollectionName).doc('current');
      const subscriptionSnap = await subscriptionRef.get();
      subscriptionExists = subscriptionSnap.exists;
      
      if (subscriptionExists) {
        rawData = subscriptionSnap.data();
        subscriptionData = {
          id: subscriptionSnap.id,
          status: rawData?.status,
          amount: rawData?.amount,
          tier: rawData?.tier,
          stripeSubscriptionId: rawData?.stripeSubscriptionId,
          createdAt: rawData?.createdAt,
          updatedAt: rawData?.updatedAt
        };
      }
    } catch (error) {
      console.error('[SUBSCRIPTION ENV DEBUG] Error checking subscription:', error);
    }

    // Also check if there's data in the wrong environment (common issue)
    const wrongPaths = [];
    
    // Check production path if we're in dev
    if (envType === 'development') {
      try {
        const prodRef = db.doc(`users/${targetUserId}`).collection('subscriptions').doc('current');
        const prodSnap = await prodRef.get();
        if (prodSnap.exists) {
          wrongPaths.push({
            path: `users/${targetUserId}/subscriptions/current`,
            exists: true,
            data: prodSnap.data()
          });
        }
      } catch (error) {
        // Ignore errors checking wrong paths
      }
    }

    // Check dev path if we're in production
    if (envType === 'production' || envType === 'preview') {
      try {
        const devRef = db.doc(`DEV_users/${targetUserId}`).collection('DEV_subscriptions').doc('current');
        const devSnap = await devRef.get();
        if (devSnap.exists) {
          wrongPaths.push({
            path: `DEV_users/${targetUserId}/DEV_subscriptions/current`,
            exists: true,
            data: devSnap.data()
          });
        }
      } catch (error) {
        // Ignore errors checking wrong paths
      }
    }

    const debugInfo = {
      environment: {
        type: envType,
        subscriptionType: subscriptionEnvType,
        subscriptionPrefix,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        subscriptionEnv: process.env.SUBSCRIPTION_ENV
      },
      paths: {
        expected: {
          parentPath,
          subCollectionName,
          fullPath: `${parentPath}/${subCollectionName}/current`
        },
        wrongEnvironmentPaths: wrongPaths
      },
      subscription: {
        exists: subscriptionExists,
        data: subscriptionData,
        rawData: rawData
      },
      issues: []
    };

    // Identify potential issues
    if (!subscriptionExists && wrongPaths.length > 0) {
      debugInfo.issues.push('Subscription data found in wrong environment collections');
    }

    if (subscriptionExists && !rawData?.status) {
      debugInfo.issues.push('Subscription document exists but missing status field (data corruption)');
    }

    if (subscriptionExists && rawData?.status === 'cancelled' && !rawData?.canceledAt) {
      debugInfo.issues.push('Subscription marked as cancelled but no canceledAt timestamp');
    }

    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('[SUBSCRIPTION ENV DEBUG] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
