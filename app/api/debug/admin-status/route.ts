import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { isUserAdmin } from '../../../utils/adminSecurity';
import { DEV_TEST_USER_UIDS } from '../../../utils/testUsers';
import { requireDevelopmentEnvironment } from '../debugHelper';

/**
 * DEBUG ENDPOINT: Check admin status and user info
 *
 * SECURITY: This endpoint is restricted to development environment only.
 * Admin status is now determined by Firebase Custom Claims and dev whitelist.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Only allow in local development
  const devCheck = requireDevelopmentEnvironment();
  if (devCheck) return devCheck;

  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    console.log('[DEBUG] User ID from request:', userId);

    if (!userId) {
      return NextResponse.json({
        error: 'No user ID found',
        authenticated: false
      });
    }

    // Get Firebase Admin
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        userId
      });
    }

    // Get user document from Firestore
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

    const userData = userDoc.exists ? userDoc.data() : null;
    const userEmail = userData?.email || null;

    // Check admin status using the consolidated adminSecurity module
    const isAdmin = await isUserAdmin(userId);
    const isDevWhitelisted = DEV_TEST_USER_UIDS.includes(userId);
    const env = getEnvironmentType();

    return NextResponse.json({
      userId,
      userEmail,
      userDocExists: userDoc.exists,
      userData: userData ? {
        email: userData.email,
        username: userData.username,
        createdAt: userData.createdAt
      } : null,
      adminCheck: {
        isAdmin,
        isDevWhitelisted,
        // Admin status is now determined by Firebase Custom Claims + dev whitelist
        method: 'Firebase Custom Claims + Dev Whitelist'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        environmentType: env,
        collectionName: getCollectionName('users')
      }
    });

  } catch (error: any) {
    console.error('[DEBUG] Error in admin status check:', error);
    return NextResponse.json({
      error: 'Internal error',
      message: error.message
    }, { status: 500 });
  }
}
