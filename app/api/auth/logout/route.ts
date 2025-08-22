import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Logout API Endpoint
 *
 * This endpoint provides logout functionality that clears
 * all session cookies and signs the user out completely.
 */

// POST endpoint - Sign out user
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    console.log('[Logout] Processing logout request');

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
