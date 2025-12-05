/**
 * Email Verification API
 * Handles email verification status checks
 * 
 * NOTE: For sending verification emails, use Firebase Client SDK's sendEmailVerification()
 * directly on the client side. This is the recommended approach as the Admin SDK
 * generateEmailVerificationLink requires server-side email delivery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { verifyIdToken, updateFirestoreDocument } from '../../../lib/firebase-rest';
import { getCollectionName } from '../../../utils/environmentConfig';
import { cookies } from 'next/headers';

interface ResendVerificationRequest {
  idToken?: string;
  email?: string;
}

// POST endpoint - Generate verification link (returns instruction for client-side delivery)
// NOTE: Firebase REST API doesn't support generating verification links server-side
// The client should use sendEmailVerification() from Firebase Client SDK instead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, email } = body as ResendVerificationRequest;

    // If idToken provided, verify and get user info
    if (idToken) {
      const verifyResult = await verifyIdToken(idToken);
      
      if (!verifyResult.success || !verifyResult.uid) {
        return createErrorResponse('UNAUTHORIZED', 'Invalid token');
      }

      // Check if email is already verified (from token verification)
      if (verifyResult.emailVerified) {
        return createApiResponse({
          message: 'Email is already verified',
          emailVerified: true
        });
      }

      // Return instructions for client to send verification email
      return createApiResponse({
        message: 'Use Firebase client SDK sendEmailVerification() to send verification email',
        email: verifyResult.email,
        emailVerified: false,
        requiresClientAction: true
      });
    }

    // If only email provided, tell client to handle it
    if (email) {
      return createApiResponse({
        message: 'Use Firebase client SDK sendEmailVerification() to send verification email',
        email: email,
        requiresClientAction: true
      });
    }

    return createErrorResponse('BAD_REQUEST', 'ID token or email address is required');

  } catch (error: unknown) {
    console.error('Email verification error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to process email verification request');
  }
}

// PUT endpoint - Mark email as verified after client-side verification
// Called after user clicks verification link and Firebase updates their status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return createErrorResponse('BAD_REQUEST', 'ID token is required');
    }

    // Verify the token to get user info (includes emailVerified status)
    const verifyResult = await verifyIdToken(idToken);
    
    if (!verifyResult.success || !verifyResult.uid) {
      return createErrorResponse('UNAUTHORIZED', 'Invalid token');
    }

    // The token verification returns current emailVerified status from Firebase
    if (!verifyResult.emailVerified) {
      return createErrorResponse('BAD_REQUEST', 'Email has not been verified yet');
    }

    // Update user document in Firestore
    await updateFirestoreDocument(getCollectionName('users'), verifyResult.uid, {
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString()
    });

    // Update session cookie if it exists
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("simpleUserSession");
    
    if (sessionCookie?.value) {
      try {
        let sessionData;
        try {
          sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
        } catch {
          sessionData = JSON.parse(sessionCookie.value);
        }
        sessionData.emailVerified = true;
        
        const nextResponse = NextResponse.json({
          success: true,
          data: {
            message: 'Email verified successfully',
            email: verifyResult.email,
            emailVerified: true,
            uid: verifyResult.uid
          }
        });
        
        nextResponse.cookies.set({
          name: "simpleUserSession",
          value: encodeURIComponent(JSON.stringify(sessionData)),
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        
        return nextResponse;
      } catch (parseError) {
        // Session parse failed, continue without updating
        console.error('Failed to update session cookie:', parseError);
      }
    }

    return createApiResponse({
      message: 'Email verified successfully',
      email: verifyResult.email,
      emailVerified: true,
      uid: verifyResult.uid
    });

  } catch (error: unknown) {
    console.error('Email verification error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to verify email');
  }
}

// GET endpoint - Check email verification status
export async function GET(request: NextRequest) {
  try {
    // First try to get from session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("simpleUserSession");
    
    if (sessionCookie?.value) {
      try {
        let sessionData;
        try {
          sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
        } catch {
          sessionData = JSON.parse(sessionCookie.value);
        }
        
        if (sessionData.uid) {
          return createApiResponse({
            emailVerified: sessionData.emailVerified || false,
            uid: sessionData.uid
          });
        }
      } catch {
        // Continue to check for token in header
      }
    }

    // If no session, try Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const verifyResult = await verifyIdToken(token);
      if (verifyResult.success && verifyResult.uid) {
        return createApiResponse({
          emailVerified: verifyResult.emailVerified || false,
          uid: verifyResult.uid
        });
      }
    }

    return createErrorResponse('UNAUTHORIZED', 'Authentication required');

  } catch (error: unknown) {
    console.error('Email verification status check error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check email verification status');
  }
}
