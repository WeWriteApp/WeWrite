import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * DEBUG ENDPOINT: Check admin status and user info
 * This endpoint helps debug admin authentication issues
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    console.log('🔍 [DEBUG] User ID from request:', userId);

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

    // Admin lists for comparison
    const ADMIN_USER_IDS = [
      'mP9yRa3nO6gS8wD4xE2hF5jK7m9N', // Jamie's admin user ID (dev_admin_user)
      'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // Current dev session user ID
      'jamie-admin-uid', // Legacy admin user ID
    ];

    const ADMIN_EMAILS = [
      'jamiegray2234@gmail.com',
      'jamie@wewrite.app',
      'test1@wewrite.dev', // Current dev session email
    ];

    // Check admin status
    const isAdminByUserId = ADMIN_USER_IDS.includes(userId);
    const isAdminByEmail = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;
    const isAdmin = isAdminByUserId && isAdminByEmail;

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
        adminUserIds: ADMIN_USER_IDS,
        adminEmails: ADMIN_EMAILS
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        collectionName: getCollectionName('users')
      }
    });

  } catch (error) {
    console.error('🔍 [DEBUG] Error in admin status check:', error);
    return NextResponse.json({
      error: 'Internal error',
      message: error.message
    }, { status: 500 });
  }
}
