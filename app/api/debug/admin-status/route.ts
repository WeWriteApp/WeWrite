import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { getAdminEmails, getAdminUserIds } from '../../../utils/adminConfig';
import { requireDevelopmentEnvironment } from '../debugHelper';

/**
 * DEBUG ENDPOINT: Check admin status and user info
 *
 * SECURITY: This endpoint is restricted to development environment only.
 * It does NOT expose the actual admin email/UID lists.
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

    // Get admin lists from centralized config
    const adminUserIds = getAdminUserIds();
    const adminEmails = getAdminEmails();

    // Check admin status
    const isAdminByUserId = adminUserIds.includes(userId);
    const isAdminByEmail = userEmail ? adminEmails.includes(userEmail) : false;
    const isAdmin = isAdminByUserId || isAdminByEmail;

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
        isAdminByUserId,
        isAdminByEmail,
        isAdmin,
        // SECURITY: Don't expose actual admin lists, only counts
        adminUserIdCount: adminUserIds.length,
        adminEmailCount: adminEmails.length
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
