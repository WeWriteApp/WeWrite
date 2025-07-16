import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Development endpoint to completely reset the authentication system
 * This clears all session cookies and forces a fresh start with proper Firebase UIDs
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development' || process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    console.log('🔄 Resetting development authentication system...');

    // Clear all authentication-related cookies
    const cookieStore = cookies();
    const authCookies = [
      'userSession',
      'devUserSession', 
      'currentUser',
      'authenticated',
      'session',
      '__session'
    ];

    const response = NextResponse.json({
      success: true,
      message: 'Development authentication system reset successfully',
      actions: [
        '✅ Cleared all authentication cookies',
        '✅ Reset session state',
        '🔄 System now ready for fresh login with proper Firebase UIDs'
      ],
      instructions: [
        '1. Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)',
        '2. Clear browser storage manually if needed:',
        '   - Open DevTools (F12)',
        '   - Go to Application/Storage tab', 
        '   - Clear localStorage and sessionStorage',
        '3. Log in again with test credentials:',
        '   - Username: testuser1',
        '   - Password: testpass123',
        '4. Verify session uses proper Firebase UID (not dev_test_user_1)',
        '5. Test user profile at /user/testuser1'
      ],
      nextSteps: [
        'The system will now create sessions with proper Firebase-style UIDs',
        'All migrated data is ready and connected to the new UID system',
        'Development environment now mirrors production authentication'
      ]
    });

    // Clear each authentication cookie
    authCookies.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    });

    console.log('✅ Authentication system reset completed');
    console.log('🎯 Cleared cookies:', authCookies.join(', '));

    return response;

  } catch (error) {
    console.error('❌ Error resetting authentication system:', error);
    return NextResponse.json({
      error: 'Failed to reset authentication system',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check current authentication state
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development' || process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    const cookieStore = cookies();
    const authCookies = [
      'userSession',
      'devUserSession',
      'currentUser', 
      'authenticated',
      'session',
      '__session'
    ];

    const cookieStatus = {};
    authCookies.forEach(cookieName => {
      const cookie = cookieStore.get(cookieName);
      cookieStatus[cookieName] = cookie ? {
        exists: true,
        length: cookie.value.length,
        preview: cookie.value.substring(0, 50) + (cookie.value.length > 50 ? '...' : '')
      } : { exists: false };
    });

    return NextResponse.json({
      environment: 'development',
      devAuthActive: true,
      cookieStatus,
      instructions: [
        'Use POST /api/dev/reset-auth-system to clear all cookies',
        'Then refresh browser and log in fresh'
      ]
    });

  } catch (error) {
    console.error('Error checking auth state:', error);
    return NextResponse.json({
      error: 'Failed to check authentication state',
      message: error.message
    }, { status: 500 });
  }
}
