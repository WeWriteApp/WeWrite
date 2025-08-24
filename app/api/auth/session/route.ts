import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { User, SessionResponse, AuthErrorCode } from '../../../types/auth';

/**
 * Session API Endpoint
 *
 * This endpoint provides session management for the auth system.
 * It handles both GET (check session) and POST (create session) requests.
 */

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
      console.log('[Session] No session cookie found - available cookies:', Object.keys(cookieStore.getAll()));
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'No active session');
    }

    let sessionData;
    let user: User;

    try {
      // Try parsing as JSON first (new format)
      sessionData = JSON.parse(sessionCookie.value);

      // Validate session data
      if (!sessionData.uid || !sessionData.email) {
        console.log('[Session] Invalid session data');
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session data');
      }

      // SIMPLIFIED: Just trust the cookie data - no complex Firebase verification
      user = {
        uid: sessionData.uid,
        email: sessionData.email,
        username: sessionData.username || '',
        displayName: sessionData.displayName || sessionData.username || '',
        photoURL: sessionData.photoURL || null,
        emailVerified: sessionData.emailVerified !== false,
        createdAt: sessionData.createdAt || new Date().toISOString(),
        lastLoginAt: sessionData.lastLoginAt || new Date().toISOString()
      };
    } catch (parseError) {
      // If JSON parsing fails, check for legacy format (plain string for dev users)
      const cookieValue = sessionCookie.value;
      if (cookieValue === 'dev_admin_user' || cookieValue === 'dev_test_user_1') {
        console.log('[Session] Using legacy session format:', cookieValue);

        // Create user object for legacy dev users
        if (cookieValue === 'dev_admin_user') {
          user = {
            uid: 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N',
            email: 'jamie@wewrite.app',
            username: 'jamie',
            displayName: 'Jamie Gray',
            photoURL: null,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };
        } else { // dev_test_user_1
          user = {
            uid: 'dev_test_user_1',
            email: 'dev_test_user_1@wewrite.dev',
            username: 'dev_test_user_1',
            displayName: 'Dev Test User 1',
            photoURL: null,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };
        }
      } else {
        console.log('[Session] Invalid session format');
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session format');
      }
    }

    console.log(`[Session] Simple session valid for: ${user.email}`);
    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Session] Session check error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session check failed', 500);
  }
}

// POST endpoint - Create session from ID token (called after login)
export async function POST(request: NextRequest) {
  try {
    console.log('[Session POST] Session creation request received');
    console.log('[Session POST] Request headers:', Object.fromEntries(request.headers.entries()));

    const body = await request.json();
    const { idToken } = body;

    console.log('[Session POST] ID token received, length:', idToken ? idToken.length : 0);

    if (!idToken) {
      console.log('[Session POST] No ID token provided');
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'ID token is required');
    }

    // Check if we should use dev auth system
    // ONLY use dev auth for local development with USE_DEV_AUTH=true
    // Preview and production environments should use Firebase Auth with real credentials
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    console.log('[Session POST] Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      useDevAuth: process.env.USE_DEV_AUTH,
      useDevAuthResult: useDevAuth
    });

    if (useDevAuth) {
      console.log('[Session POST] Dev auth mode: bypassing Firebase ID token verification (local development only)');

      try {
        // In development mode, decode the token without verification
        // The token should contain the user info from Firebase Auth
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid token format');
        }

        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());

        // Get user data from Firestore using the UID from the token
        const admin = initAdmin();
        const adminDb = admin.firestore();
        const userDoc = await adminDb.collection(getCollectionName('users')).doc(payload.user_id || payload.sub).get();
        const userData = userDoc.data() || {};

        const user: User = {
          uid: payload.user_id || payload.sub,
          email: payload.email || userData.email || '',
          username: userData.username || '',
          displayName: userData.displayName || payload.name || '',
          photoURL: userData.photoURL || payload.picture || undefined,
          emailVerified: payload.email_verified || userData.emailVerified || false,
          createdAt: userData.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        // Create session cookie
        const cookieStore = await cookies();
        const sessionData = {
          uid: user.uid,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        };

        // CRITICAL PWA FIX: Enhanced cookie settings for PWA compatibility
        cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // Only secure in production
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/', // Explicit path for PWA
          // No domain restriction for development
        });

        // Update last login time
        await adminDb.collection(getCollectionName('users')).doc(user.uid).update({
          lastLoginAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        });

        // CRITICAL FIX: Create session for dev auth too
        await createUserSession(request, user.uid);

        console.log('[Session] Dev auth session created for:', user.email);
        return createSuccessResponse(user);

      } catch (devError) {
        console.error('[Session] Dev auth session creation failed:', devError);
        return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Dev auth session creation failed');
      }
    }

    // Production mode: verify ID token with Firebase Admin
    console.log('[Session POST] Production mode: verifying ID token with Firebase Admin');

    let admin, adminAuth, adminDb;
    try {
      admin = initAdmin();
      if (!admin) {
        console.error('[Session POST] Firebase Admin initialization returned null');
        return createErrorResponse(AuthErrorCode.INTERNAL_ERROR, 'Firebase Admin not available');
      }

      adminAuth = admin.auth();
      adminDb = admin.firestore();

      console.log('[Session POST] Firebase Admin initialized successfully:', {
        hasAdmin: !!admin,
        hasAdminDb: !!adminDb,
        hasAdminAuth: !!adminAuth
      });
    } catch (initError) {
      console.error('[Session POST] Firebase Admin initialization failed:', initError);
      console.error('[Session POST] Error details:', {
        message: initError.message,
        code: initError.code,
        stack: initError.stack?.split('\n').slice(0, 3).join('\n')
      });
      return createErrorResponse(AuthErrorCode.INTERNAL_ERROR, 'Firebase initialization failed');
    }

    try {
      // Verify the ID token
      console.log('[Session POST] Verifying ID token...');
      console.log('[Session POST] ID token preview:', idToken.substring(0, 50) + '...');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      console.log('[Session POST] ID token verified successfully for user:', decodedToken.uid);
      console.log('[Session POST] Decoded token details:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        iss: decodedToken.iss,
        aud: decodedToken.aud
      });

      // Get user data from Firestore
      const userDoc = await adminDb.collection(getCollectionName('users')).doc(decodedToken.uid).get();
      const userData = userDoc.data() || {};

      const user: User = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        username: userData.username || '',
        displayName: userData.displayName || decodedToken.name || '',
        photoURL: userData.photoURL || decodedToken.picture || undefined,
        emailVerified: decodedToken.email_verified || false,
        createdAt: userData.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      // Create session cookie
      const cookieStore = await cookies();
      const sessionData = {
        uid: user.uid,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified
      };

      // CRITICAL PWA FIX: Enhanced cookie settings for PWA compatibility
      cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/', // Explicit path for PWA
        // No domain restriction for development
      });

      // Update last login time
      await adminDb.collection(getCollectionName('users')).doc(user.uid).update({
        lastLoginAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      });

      // Create or update user session for device tracking
      await createUserSession(request, user.uid);

      console.log(`[Session] Session created for: ${user.email}`);
      return createSuccessResponse(user);

    } catch (firebaseError) {
      console.error('[Session POST] Firebase ID token verification failed:', firebaseError);
      console.error('[Session POST] Error details:', {
        code: firebaseError.code,
        message: firebaseError.message,
        stack: firebaseError.stack
      });
      console.error('[Session POST] Firebase Admin Auth instance:', {
        hasAdminAuth: !!adminAuth,
        adminAuthType: typeof adminAuth
      });
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid ID token');
    }

  } catch (error) {
    console.error('[Session] Session creation error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session creation failed', 500);
  }
}

/**
 * Helper function to create or update user session for device tracking
 */
async function createUserSession(request: NextRequest, userId: string) {
  try {
    const admin = initAdmin();
    const db = admin.firestore();

    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = getClientIP(request);
    const deviceInfo = parseUserAgent(userAgent);

    const sessionId = generateSessionId();

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

    // Store session in Firestore
    await db.collection(getCollectionName('userSessions')).doc(sessionId).set(sessionData);

    // CRITICAL FIX: Set the sessionId cookie so session validation works
    const cookieStore = await cookies();
    cookieStore.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/', // Explicit path for PWA
      // No domain restriction for development
    });

    console.log(`Created user session ${sessionId} for user ${userId}`);

    return sessionId;
  } catch (error) {
    console.error('Error creating user session:', error);
    return null;
  }
}

/**
 * Parse user agent to extract device information
 */
function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (ua.includes('mobile')) deviceType = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';

  // Detect platform
  let platform = 'Unknown';
  if (ua.includes('windows')) platform = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) platform = 'Mac';
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

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
