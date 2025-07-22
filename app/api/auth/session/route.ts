import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
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
      console.log('[Session] No session cookie found');
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'No active session');
    }

    try {
      const sessionData = JSON.parse(sessionCookie.value);
      
      // Validate session data
      if (!sessionData.uid || !sessionData.email) {
        console.log('[Session] Invalid session data');
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session data');
      }

      // Check if we should use dev auth system
      // ONLY use dev auth for local development with USE_DEV_AUTH=true
      // Preview and production environments should use Firebase Auth with real credentials
      const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

      if (useDevAuth) {
        const user: User = {
          uid: sessionData.uid,
          email: sessionData.email,
          username: sessionData.username || '',
          displayName: sessionData.displayName || '',
          photoURL: sessionData.photoURL,
          emailVerified: sessionData.emailVerified || false,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        console.log('[Session] Dev auth session valid for:', user.email);
        return createSuccessResponse(user);
      }

      // For production, verify with Firebase and get latest user data
      const { adminDb, adminAuth } = getFirebaseAdmin();

      try {
        // Verify user still exists in Firebase
        const userRecord = await adminAuth.getUser(sessionData.uid);

        // Get latest user data from Firestore
        const userDoc = await adminDb.collection(getCollectionName('users')).doc(sessionData.uid).get();
        const userData = userDoc.data() || {};

        const user: User = {
          uid: userRecord.uid,
          email: userRecord.email || '',
          username: userData.username || '',
          displayName: userData.displayName || userRecord.displayName || '',
          photoURL: userData.photoURL || userRecord.photoURL || undefined,
          emailVerified: userRecord.emailVerified,
          createdAt: userData.createdAt || new Date().toISOString(),
          lastLoginAt: userData.lastLoginAt || new Date().toISOString()
        };

        console.log(`[Session] Production session valid for: ${user.email}`);
        return createSuccessResponse(user);

      } catch (firebaseError) {
        console.log('[Session] Firebase verification failed:', firebaseError);
        // Clear invalid session cookie
        cookieStore.delete('simpleUserSession');
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Session expired');
      }

    } catch (parseError) {
      console.log('[Session] Failed to parse session cookie:', parseError);
      // Clear invalid session cookie
      cookieStore.delete('simpleUserSession');
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session format');
    }

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
        const { adminDb } = getFirebaseAdmin();
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

        cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        // Update last login time
        await adminDb.collection(getCollectionName('users')).doc(user.uid).update({
          lastLoginAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        });

        console.log('[Session] Dev auth session created for:', user.email);
        return createSuccessResponse(user);

      } catch (devError) {
        console.error('[Session] Dev auth session creation failed:', devError);
        return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Dev auth session creation failed');
      }
    }

    // Production mode: verify ID token with Firebase Admin
    console.log('[Session POST] Production mode: verifying ID token with Firebase Admin');
    const { adminDb, adminAuth } = getFirebaseAdmin();
    console.log('[Session POST] Firebase Admin initialized:', {
      hasAdminDb: !!adminDb,
      hasAdminAuth: !!adminAuth
    });

    try {
      // Verify the ID token
      console.log('[Session POST] Verifying ID token...');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      console.log('[Session POST] ID token verified successfully for user:', decodedToken.uid);

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

      cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      // Update last login time
      await adminDb.collection(getCollectionName('users')).doc(user.uid).update({
        lastLoginAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      });

      console.log(`[Session] Session created for: ${user.email}`);
      return createSuccessResponse(user);

    } catch (firebaseError) {
      console.error('[Session] ID token verification failed:', firebaseError);
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid ID token');
    }

  } catch (error) {
    console.error('[Session] Session creation error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session creation failed', 500);
  }
}
