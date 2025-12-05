/**
 * Session API Endpoint
 * 
 * Uses Firebase REST API instead of firebase-admin SDK to avoid
 * the jwks-rsa/jose dependency chain that fails in Vercel serverless.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { User, SessionResponse, AuthErrorCode } from '../../../types/auth';
import { isAdmin as isAdminByEmail } from '../../../utils/isAdmin';
import { 
  verifyIdToken, 
  getFirestoreDoc, 
  setFirestoreDoc,
  getUserFromToken 
} from '../../../lib/firebase-rest';
import { DEV_TEST_USERS } from '../../../utils/testUsers';

// Helper function to create error responses
function createErrorResponse(code: AuthErrorCode, message: string, status: number = 401): NextResponse {
  const response: SessionResponse = {
    isAuthenticated: false,
    error: message
  };
  return NextResponse.json(response, { status });
}

// Helper function to create success responses
function createSuccessResponse(user: User): NextResponse {
  const response: SessionResponse = {
    isAuthenticated: true,
    user
  };
  return NextResponse.json(response);
}

// GET endpoint - Check current session
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie) {
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'No active session');
    }

    let user: User;

    try {
      // Try parsing as JSON (standard format)
      const sessionData = JSON.parse(sessionCookie.value);

      // Validate session data
      if (!sessionData.uid || !sessionData.email) {
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session data');
      }

      // Build user object from session cookie
      user = {
        uid: sessionData.uid,
        email: sessionData.email,
        username: sessionData.username || '',
        photoURL: sessionData.photoURL || null,
        emailVerified: sessionData.emailVerified !== false,
        createdAt: sessionData.createdAt || new Date().toISOString(),
        lastLoginAt: sessionData.lastLoginAt || new Date().toISOString(),
        isAdmin: sessionData.isAdmin === true
      };

      // Try to enrich from Firestore using REST API (non-blocking)
      try {
        const userDoc = await getFirestoreDoc(getCollectionName('users'), user.uid);
        if (userDoc) {
          if (userDoc.username) {
            user.username = userDoc.username;
          }
          if (userDoc.isAdmin === true || userDoc.role === 'admin') {
            user.isAdmin = true;
          }
        }
      } catch (e) {
        // Non-critical - continue with cookie data
        console.warn('[Session] Failed to enrich user from Firestore:', e);
      }

    } catch (parseError) {
      // Handle legacy format (dev users)
      const cookieValue = sessionCookie.value;
      const devUser = Object.values(DEV_TEST_USERS).find(u => u.uid === cookieValue);
      
      if (devUser) {
        user = {
          uid: devUser.uid,
          email: devUser.email,
          username: devUser.username,
          photoURL: undefined,
          emailVerified: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isAdmin: false
        };
      } else {
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session format');
      }
    }

    // Fallback admin check by email allowlist
    if (!user.isAdmin && isAdminByEmail(user.email)) {
      user.isAdmin = true;
    }

    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Session] Session check error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session check failed', 500);
  }
}

// POST endpoint - Create session from ID token (called after login)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'ID token is required');
    }

    // Check if we should use dev auth system
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    if (useDevAuth) {
      console.log('[Session] Dev auth mode: bypassing token verification');

      try {
        // In development mode, decode the token without verification
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid token format');
        }

        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const uid = payload.user_id || payload.sub;

        // Get user data from Firestore
        const userData = await getFirestoreDoc(getCollectionName('users'), uid);

        const user: User = {
          uid,
          email: payload.email || userData?.email || '',
          username: userData?.username || '',
          photoURL: userData?.photoURL || payload.picture || undefined,
          emailVerified: payload.email_verified || userData?.emailVerified || false,
          createdAt: userData?.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        // Create session cookie
        await createSessionCookie(user);

        console.log('[Session] Dev auth session created for:', user.email);
        return createSuccessResponse(user);

      } catch (devError) {
        console.error('[Session] Dev auth session creation failed:', devError);
        return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Dev auth session creation failed');
      }
    }

    // Production mode: verify ID token using REST API
    console.log('[Session] Verifying ID token via REST API...');
    console.log('[Session] Firebase config check:', {
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PID,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });

    const verifyResult = await verifyIdToken(idToken);
    
    console.log('[Session] Token verification result:', {
      success: verifyResult.success,
      hasUid: !!verifyResult.uid,
      error: verifyResult.error
    });
    
    if (!verifyResult.success || !verifyResult.uid) {
      console.error('[Session] Token verification failed:', verifyResult.error);
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid ID token');
    }

    console.log('[Session] Token verified for user:', verifyResult.uid);

    // Get user data from Firestore using REST API
    const userData = await getFirestoreDoc(getCollectionName('users'), verifyResult.uid);

    const user: User = {
      uid: verifyResult.uid,
      email: verifyResult.email || '',
      username: userData?.username || '',
      photoURL: userData?.photoURL || undefined,
      emailVerified: verifyResult.emailVerified || false,
      createdAt: userData?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isAdmin: userData?.isAdmin === true || userData?.role === 'admin'
    };

    // Fallback admin check
    if (!user.isAdmin && isAdminByEmail(user.email)) {
      user.isAdmin = true;
    }

    // Create session cookie
    await createSessionCookie(user);

    // Update last login time (non-blocking, best-effort)
    try {
      await setFirestoreDoc(
        getCollectionName('users'),
        user.uid,
        {
          lastLoginAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        },
        idToken,
        true // merge
      );
    } catch (e) {
      console.warn('[Session] Failed to update last login time:', e);
    }

    // Create device session for tracking
    await createUserSession(request, user.uid, idToken);

    console.log('[Session] Session created for:', user.email);
    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Session] Session creation error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session creation failed', 500);
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
async function createUserSession(request: NextRequest, userId: string, idToken: string) {
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

    // Store session in Firestore using REST API
    await setFirestoreDoc(
      getCollectionName('userSessions'),
      sessionId,
      sessionData,
      idToken
    );

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
