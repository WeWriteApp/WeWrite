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

    // Clear all auth-related cookies
    const cookiesToClear = [
      'simpleUserSession',
      'sessionId', // CRITICAL FIX: Also clear sessionId cookie
      'userSession',
      'devUserSession',
      'authToken',
      'authenticated',
      'session'
    ];

    cookiesToClear.forEach(cookieName => {
      cookieStore.delete(cookieName);
    });

    console.log('[Logout] All session cookies cleared');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('[Logout] Logout error:', error);

    // Even if there's an error, try to clear cookies
    const cookieStore = await cookies();
    cookieStore.delete('simpleUserSession');
    cookieStore.delete('sessionId'); // CRITICAL FIX: Also clear sessionId cookie
    cookieStore.delete('userSession');
    cookieStore.delete('devUserSession');

    return NextResponse.json({
      success: true,
      message: 'Logged out (with errors)'
    });
  }
}
