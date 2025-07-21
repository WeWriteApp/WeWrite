import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Simple Logout API Endpoint
 * 
 * This endpoint provides simplified logout functionality that clears
 * all session cookies and signs the user out completely.
 */

// POST endpoint - Sign out user
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    console.log('[Simple Logout] Processing logout request');

    // Clear all auth-related cookies
    const cookiesToClear = [
      'simpleUserSession',
      'userSession',
      'devUserSession',
      'authToken',
      'authenticated',
      'session'
    ];

    cookiesToClear.forEach(cookieName => {
      cookieStore.delete(cookieName);
    });

    console.log('[Simple Logout] All session cookies cleared');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('[Simple Logout] Logout error:', error);
    
    // Even if there's an error, try to clear cookies
    const cookieStore = cookies();
    cookieStore.delete('simpleUserSession');
    cookieStore.delete('userSession');
    cookieStore.delete('devUserSession');
    
    return NextResponse.json({
      success: true,
      message: 'Logged out (with errors)'
    });
  }
}
