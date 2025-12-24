/**
 * Session API Endpoint
 *
 * Handles user session management with cookie-based authentication.
 *
 * Architecture:
 * - GET: Validates existing session cookie, enriches with fresh Firestore data
 * - POST: Creates new session after Firebase Auth login (called with ID token)
 *
 * Admin Detection (in priority order):
 * 1. Firebase Custom Claims (most secure, cryptographically signed)
 * 2. Firestore user document: isAdmin === true OR role === 'admin'
 *
 * Note: Uses Firebase REST API for token verification to avoid jose dependency issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollectionName } from '../../../utils/environmentConfig';
import { User, SessionResponse, AuthErrorCode } from '../../../types/auth';
import { verifyIdToken } from '../../../lib/firebase-rest';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { DEV_TEST_USERS } from '../../../utils/testUsers';
import { getAdminClaim } from '../../../services/adminClaimsService';

// =============================================================================
// Response Helpers
// =============================================================================

function createErrorResponse(code: AuthErrorCode, message: string, status: number = 401): NextResponse {
  return NextResponse.json({ isAuthenticated: false, error: message } as SessionResponse, { status });
}

function createSuccessResponse(user: User): NextResponse {
  console.log('[Session] Returning user with isAdmin:', user.isAdmin, 'for:', user.email);
  return NextResponse.json({ isAuthenticated: true, user } as SessionResponse);
}

// =============================================================================
// User Data Fetching
// =============================================================================

interface FirestoreUserData {
  username?: string;
  isAdmin?: boolean;
  role?: string;
  emailVerified?: boolean;
  photoURL?: string;
  createdAt?: string;
}

/**
 * Fetch user data from Firestore
 * Returns null if user doesn't exist or on error
 */
async function fetchUserFromFirestore(uid: string): Promise<FirestoreUserData | null> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('[Session] Firebase Admin not available');
      return null;
    }

    const db = admin.firestore();
    const collectionName = getCollectionName('users');
    const userDoc = await db.collection(collectionName).doc(uid).get();

    if (!userDoc.exists) {
      console.warn('[Session] User document not found in Firestore:', uid);
      return null;
    }

    const data = userDoc.data() as FirestoreUserData;
    console.log('[Session] Firestore user data for', uid, ':', {
      hasUsername: !!data?.username,
      isAdmin: data?.isAdmin,
      role: data?.role,
      emailVerified: data?.emailVerified,
      collection: collectionName
    });

    return data;
  } catch (error) {
    console.error('[Session] Failed to fetch user from Firestore:', error);
    return null;
  }
}

/**
 * Determine if user has admin access based on:
 * 1. Firebase Custom Claims (most secure, cryptographically signed)
 * 2. Firestore isAdmin/role fields
 */
async function checkAdminStatus(uid: string, firestoreData: FirestoreUserData | null, email: string): Promise<boolean> {
  // 1. Check Firebase Custom Claims first (most secure)
  try {
    const claimResult = await getAdminClaim(uid);
    if (claimResult.isAdmin) {
      console.log('[Session] Admin granted via Firebase Custom Claims');
      return true;
    }
  } catch (error) {
    console.warn('[Session] Error checking custom claims:', error);
    // Continue to fallback checks
  }

  // 2. Check Firestore flags
  if (firestoreData?.isAdmin === true) {
    console.log('[Session] Admin granted via Firestore isAdmin flag');
    return true;
  }
  if (firestoreData?.role === 'admin') {
    console.log('[Session] Admin granted via Firestore role field');
    return true;
  }

  console.log('[Session] User is not an admin:', email);
  return false;
}

// =============================================================================
// GET - Validate existing session
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie) {
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'No active session');
    }

    // Try to parse session cookie
    let sessionData: { uid: string; email: string; username?: string; photoURL?: string; emailVerified?: boolean; createdAt?: string; lastLoginAt?: string; isAdmin?: boolean };

    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch {
      // Handle legacy format (dev users only)
      const devUser = Object.values(DEV_TEST_USERS).find(u => u.uid === sessionCookie.value);
      if (devUser) {
        const user: User = {
          uid: devUser.uid,
          email: devUser.email,
          username: devUser.username,
          photoURL: undefined,
          emailVerified: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isAdmin: devUser.isAdmin === true
        };
        return createSuccessResponse(user);
      }
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session format');
    }

    // Validate required session data
    if (!sessionData.uid || !sessionData.email) {
      console.warn('[Session] Invalid session data - missing uid or email');
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session data');
    }

    console.log('[Session] GET - Processing session for:', sessionData.email, 'uid:', sessionData.uid);

    // Fetch fresh data from Firestore to ensure we have latest admin status
    const firestoreData = await fetchUserFromFirestore(sessionData.uid);

    // Check admin status (includes custom claims check)
    const isAdminUser = await checkAdminStatus(sessionData.uid, firestoreData, sessionData.email);

    // Build user object with Firestore enrichment
    const user: User = {
      uid: sessionData.uid,
      email: sessionData.email,
      username: firestoreData?.username || sessionData.username || '',
      photoURL: firestoreData?.photoURL || sessionData.photoURL || undefined,
      emailVerified: firestoreData?.emailVerified ?? sessionData.emailVerified ?? true,
      createdAt: firestoreData?.createdAt || sessionData.createdAt || new Date().toISOString(),
      lastLoginAt: sessionData.lastLoginAt || new Date().toISOString(),
      isAdmin: isAdminUser
    };

    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Session] Session check error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session check failed', 500);
  }
}

// =============================================================================
// POST - Create new session after login
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'ID token is required');
    }

    // Check if we should use dev auth system (local development only)
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    let uid: string;
    let email: string;
    let emailVerified: boolean;

    if (useDevAuth) {
      // Dev mode: decode token without verification
      console.log('[Session] POST - Dev auth mode: bypassing token verification');

      const tokenParts = idToken.split('.');
      if (tokenParts.length !== 3) {
        return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid token format');
      }

      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      uid = payload.user_id || payload.sub;
      email = payload.email || '';
      emailVerified = payload.email_verified || false;
    } else {
      // Production mode: verify ID token using REST API
      console.log('[Session] POST - Verifying ID token via REST API...');

      const verifyResult = await verifyIdToken(idToken);

      if (!verifyResult.success || !verifyResult.uid) {
        console.error('[Session] Token verification failed:', verifyResult.error);
        return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid ID token');
      }

      uid = verifyResult.uid;
      email = verifyResult.email || '';
      emailVerified = verifyResult.emailVerified || false;
      console.log('[Session] POST - Token verified for:', email);
    }

    // Fetch user data from Firestore
    const firestoreData = await fetchUserFromFirestore(uid);

    // Check admin status (includes custom claims check)
    const isAdminUser = await checkAdminStatus(uid, firestoreData, email);

    // Build user object
    const user: User = {
      uid,
      email: email || firestoreData?.username || '',
      username: firestoreData?.username || '',
      photoURL: firestoreData?.photoURL || undefined,
      emailVerified: firestoreData?.emailVerified ?? emailVerified,
      createdAt: firestoreData?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isAdmin: isAdminUser
    };

    // Create session cookie
    await createSessionCookie(user);

    // Update last login time in Firestore (best-effort)
    await updateLastLoginTime(uid);

    // Create device session for tracking
    await createUserSession(request, uid);

    console.log('[Session] POST - Session created for:', user.email, 'isAdmin:', user.isAdmin);
    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Session] Session creation error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session creation failed', 500);
  }
}

// =============================================================================
// Session Cookie Management
// =============================================================================

/**
 * Update last login timestamp in Firestore (best-effort, non-blocking)
 */
async function updateLastLoginTime(uid: string): Promise<void> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return;

    const db = admin.firestore();
    const now = new Date().toISOString();

    await db.collection(getCollectionName('users')).doc(uid).update({
      lastLogin: now,
      lastLoginAt: now,
      lastActiveAt: now
    });
  } catch (error) {
    console.warn('[Session] Failed to update last login time:', error);
  }
}

/**
 * Create session cookie
 */
async function createSessionCookie(user: User) {
  const cookieStore = await cookies();
  const sessionData = {
    uid: user.uid,
    email: user.email,
    username: user.username,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    isAdmin: user.isAdmin
  };

  cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Create user session for device tracking
 */
async function createUserSession(request: NextRequest, userId: string) {
  try {
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = getClientIP(request);
    const deviceInfo = parseUserAgent(userAgent);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sessionData = {
      userId,
      deviceInfo: {
        userAgent,
        ...deviceInfo,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ipAddress,
      isActive: true,
    };

    // Store session in Firestore using firebase-admin
    const admin = getFirebaseAdmin();
    if (admin) {
      const db = admin.firestore();
      
      // Check if this is a new device by looking for existing sessions
      // with different userAgent/IP combination
      let isNewDevice = true;
      try {
        const existingSessions = await db.collection(getCollectionName('userSessions'))
          .where('userId', '==', userId)
          .where('isActive', '==', true)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();
        
        // Check if we have a matching device already
        for (const sessionDoc of existingSessions.docs) {
          const session = sessionDoc.data();
          if (session.deviceInfo?.browser === deviceInfo.browser &&
              session.deviceInfo?.os === deviceInfo.os &&
              session.deviceInfo?.deviceType === deviceInfo.deviceType) {
            isNewDevice = false;
            break;
          }
        }
      } catch (sessionQueryError) {
        console.warn('[Session] Error checking existing sessions:', sessionQueryError);
        // Assume new device on error to be safe
      }
      
      await db.collection(getCollectionName('userSessions')).doc(sessionId).set(sessionData);
      
      // NOTE: Security alert emails for new device logins have been disabled
      // They were spammy and not working properly - can be re-enabled later if needed
    }

    // Set sessionId cookie
    const cookieStore = await cookies();
    cookieStore.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log(`[Session] Created device session ${sessionId} for user ${userId}`);
    return sessionId;
  } catch (error) {
    console.error('[Session] Error creating user session:', error);
    return null;
  }
}

/**
 * Parse user agent to extract device information
 */
function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();

  let browser = 'Unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';

  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (ua.includes('mobile')) deviceType = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';

  let platform = 'Unknown';
  if (ua.includes('windows')) platform = 'Windows';
  else if (ua.includes('macintosh')) platform = 'Mac';
  else if (ua.includes('linux')) platform = 'Linux';
  else if (ua.includes('android')) platform = 'Android';
  else if (ua.includes('iphone')) platform = 'iPhone';
  else if (ua.includes('ipad')) platform = 'iPad';

  return { browser, os, deviceType, platform };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}
