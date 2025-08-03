import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

/**
 * Debug Auth Status API Endpoint
 * 
 * Returns detailed authentication status information
 * to help debug authentication issues.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Get session cookie
    const sessionCookie = cookieStore.get('simpleUserSession');
    
    // Environment info
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      useDevAuth: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true'
    };
    
    // Cookie info
    const cookieInfo = {
      totalCookies: allCookies.length,
      cookieNames: allCookies.map(c => c.name),
      hasSimpleUserSession: !!sessionCookie,
      sessionCookieValue: sessionCookie ? 'present' : 'missing'
    };
    
    // Session data
    let sessionData = null;
    let sessionError = null;
    
    if (sessionCookie) {
      try {
        sessionData = JSON.parse(sessionCookie.value);
      } catch (error) {
        sessionError = 'Failed to parse session cookie';
      }
    }
    
    // Firebase Admin status
    let firebaseAdminStatus = 'unknown';
    try {
      const admin = getFirebaseAdmin();
      firebaseAdminStatus = admin ? 'initialized' : 'not initialized';
    } catch (error) {
      firebaseAdminStatus = `error: ${error.message}`;
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: envInfo,
      cookies: cookieInfo,
      session: {
        hasSessionData: !!sessionData,
        sessionError,
        userData: sessionData ? {
          uid: sessionData.uid,
          email: sessionData.email,
          username: sessionData.username,
          emailVerified: sessionData.emailVerified
        } : null
      },
      firebase: {
        adminStatus: firebaseAdminStatus
      },
      request: {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      }
    };
    
    return NextResponse.json(debugInfo, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error in auth status debug API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get auth status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}
