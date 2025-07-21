import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { User, SessionResponse, AuthErrorCode } from '../../../types/simpleAuth';

/**
 * Simple Session API Endpoint
 * 
 * This endpoint provides simplified session management for the new auth system.
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
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie) {
      console.log('[Simple Session] No session cookie found');
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'No active session');
    }

    try {
      const sessionData = JSON.parse(sessionCookie.value);
      
      // Validate session data
      if (!sessionData.uid || !sessionData.email) {
        console.log('[Simple Session] Invalid session data');
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session data');
      }

      // For development mode, return session data directly
      const isDevelopment = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
      
      if (isDevelopment) {
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

        console.log(`[Simple Session] Development session valid for: ${user.email}`);
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

        console.log(`[Simple Session] Production session valid for: ${user.email}`);
        return createSuccessResponse(user);

      } catch (firebaseError) {
        console.log('[Simple Session] Firebase verification failed:', firebaseError);
        // Clear invalid session cookie
        cookieStore.delete('simpleUserSession');
        return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Session expired');
      }

    } catch (parseError) {
      console.log('[Simple Session] Failed to parse session cookie:', parseError);
      // Clear invalid session cookie
      cookieStore.delete('simpleUserSession');
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Invalid session format');
    }

  } catch (error) {
    console.error('[Simple Session] Session check error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session check failed', 500);
  }
}

// POST endpoint - Create/refresh session (called after login)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie) {
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'No session to refresh');
    }

    // Parse session data
    const sessionData = JSON.parse(sessionCookie.value);
    
    const isDevelopment = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    if (isDevelopment) {
      // For development, just return the session data as a user
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

      console.log(`[Simple Session] Development session created for: ${user.email}`);
      return createSuccessResponse(user);
    }

    // For production, verify and refresh session
    const { adminDb, adminAuth } = getFirebaseAdmin();
    
    try {
      const userRecord = await adminAuth.getUser(sessionData.uid);
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
        lastLoginAt: new Date().toISOString()
      };

      // Update last active time
      await adminDb.collection(getCollectionName('users')).doc(user.uid).update({
        lastActiveAt: new Date().toISOString()
      });

      console.log(`[Simple Session] Production session refreshed for: ${user.email}`);
      return createSuccessResponse(user);

    } catch (firebaseError) {
      console.error('[Simple Session] Firebase session refresh failed:', firebaseError);
      cookieStore.delete('simpleUserSession');
      return createErrorResponse(AuthErrorCode.SESSION_EXPIRED, 'Session refresh failed');
    }

  } catch (error) {
    console.error('[Simple Session] Session creation error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Session creation failed', 500);
  }
}
