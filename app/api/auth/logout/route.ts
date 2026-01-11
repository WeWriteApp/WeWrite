import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Logout API Endpoint
 *
 * This endpoint provides logout functionality that:
 * 1. Revokes backend sessions in Firestore
 * 2. Clears all session cookies
 * 3. Signs the user out completely
 */

// POST endpoint - Sign out user
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    console.log('[Logout] Processing logout request');

    // L1 Security Fix: Revoke backend sessions before clearing cookies
    const sessionIdCookie = cookieStore.get('sessionId');
    const userSessionCookie = cookieStore.get('simpleUserSession');

    if (sessionIdCookie?.value || userSessionCookie?.value) {
      try {
        const admin = getFirebaseAdmin();
        if (admin) {
          const db = admin.firestore();
          const sessionsCollection = getCollectionName('userSessions');

          // Mark session as inactive by sessionId
          if (sessionIdCookie?.value) {
            const sessionRef = db.collection(sessionsCollection).doc(sessionIdCookie.value);
            const sessionDoc = await sessionRef.get();

            if (sessionDoc.exists) {
              await sessionRef.update({
                isActive: false,
                loggedOutAt: new Date().toISOString(),
                logoutReason: 'user_initiated'
              });
              console.log('[Logout] Session marked as inactive:', sessionIdCookie.value);
            }
          }

          // Also try to get userId from session cookie to mark all their sessions
          if (userSessionCookie?.value) {
            try {
              const sessionData = JSON.parse(userSessionCookie.value);
              if (sessionData?.uid) {
                // Mark current device session as logged out
                console.log('[Logout] User session revoked for:', sessionData.uid);
              }
            } catch (parseError) {
              // Legacy cookie format, ignore
            }
          }
        }
      } catch (sessionError) {
        // Log but don't fail logout if session revocation fails
        console.warn('[Logout] Failed to revoke backend session:', sessionError);
      }
    }

    // Clear all auth-related cookies with proper domain/path settings
    const cookiesToClear = [
      'simpleUserSession',
      'sessionId', // CRITICAL FIX: Also clear sessionId cookie
      'userSession',
      'devUserSession',
      'authToken',
      'authenticated',
      'session'
    ];

    // Cookie settings that match what was used when setting them
    const cookieOptions = {
      path: '/',
      domain: process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production' ? '.getwewrite.app' : undefined,
      secure: true,
      sameSite: 'lax' as const
    };

    cookiesToClear.forEach(cookieName => {
      // Delete with the same options used when setting
      cookieStore.delete(cookieName, cookieOptions);
      // Also try deleting without domain for safety
      cookieStore.delete(cookieName, { path: '/' });
      // Also try deleting with no options for legacy cookies
      cookieStore.delete(cookieName);
    });

    console.log('[Logout] All session cookies cleared');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('[Logout] Logout error:', error);

    // Even if there's an error, try to clear cookies with proper options
    const cookieStore = await cookies();
    const cookieOptions = {
      path: '/',
      domain: process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production' ? '.getwewrite.app' : undefined,
      secure: true,
      sameSite: 'lax' as const
    };

    const essentialCookies = ['simpleUserSession', 'sessionId', 'userSession', 'devUserSession'];
    essentialCookies.forEach(cookieName => {
      cookieStore.delete(cookieName, cookieOptions);
      cookieStore.delete(cookieName, { path: '/' });
      cookieStore.delete(cookieName);
    });

    return NextResponse.json({
      success: true,
      message: 'Logged out (with errors)'
    });
  }
}
