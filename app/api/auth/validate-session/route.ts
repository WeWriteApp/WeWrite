/**
 * Session Validation API Endpoint
 * 
 * Validates the current user session and returns session status.
 * This endpoint is called by SessionMonitor to check if the session is still valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface SessionValidationResponse {
  valid: boolean;
  reason?: string;
  user?: {
    uid: string;
    email: string;
    username?: string;
  };
  timestamp: string;
}

/**
 * GET endpoint - Validate current session
 */
export async function GET(request: NextRequest): Promise<NextResponse<SessionValidationResponse>> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie) {
      return NextResponse.json({
        valid: false,
        reason: 'No session cookie found',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Parse the session cookie
      const sessionData = JSON.parse(sessionCookie.value);
      
      if (!sessionData.uid || !sessionData.email) {
        return NextResponse.json({
          valid: false,
          reason: 'Invalid session data format',
          timestamp: new Date().toISOString(),
        });
      }

      // Check if session has expired
      if (sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
        return NextResponse.json({
          valid: false,
          reason: 'Session expired',
          timestamp: new Date().toISOString(),
        });
      }

      // For development with dev auth, just validate the session format
      const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
      
      if (useDevAuth) {
        return NextResponse.json({
          valid: true,
          user: {
            uid: sessionData.uid,
            email: sessionData.email,
            username: sessionData.username
          },
          timestamp: new Date().toISOString(),
        });
      }

      // For production, validate with Firebase Admin
      try {
        const admin = getFirebaseAdmin();
        const adminAuth = admin.auth();
        
        // Verify the user still exists in Firebase Auth
        const userRecord = await adminAuth.getUser(sessionData.uid);
        
        if (!userRecord) {
          return NextResponse.json({
            valid: false,
            reason: 'User not found in Firebase Auth',
            timestamp: new Date().toISOString(),
          });
        }

        // Check if user is disabled
        if (userRecord.disabled) {
          return NextResponse.json({
            valid: false,
            reason: 'User account is disabled',
            timestamp: new Date().toISOString(),
          });
        }

        // Session is valid
        return NextResponse.json({
          valid: true,
          user: {
            uid: userRecord.uid,
            email: userRecord.email || sessionData.email,
            username: sessionData.username
          },
          timestamp: new Date().toISOString(),
        });

      } catch (firebaseError) {
        console.error('Firebase validation error:', firebaseError);
        
        // If Firebase is unavailable, don't invalidate the session
        // This prevents logout during temporary Firebase outages
        return NextResponse.json({
          valid: true,
          user: {
            uid: sessionData.uid,
            email: sessionData.email,
            username: sessionData.username
          },
          timestamp: new Date().toISOString(),
        });
      }

    } catch (parseError) {
      console.error('Session cookie parse error:', parseError);
      return NextResponse.json({
        valid: false,
        reason: 'Invalid session cookie format',
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    console.error('Session validation error:', error);
    
    // Return valid=true for unknown errors to prevent unnecessary logouts
    return NextResponse.json({
      valid: true,
      reason: 'Validation error - assuming valid to prevent logout',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST endpoint - Not supported for this endpoint
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'Use GET to validate session'
  }, { status: 405 });
}
