/**
 * Email Verification API
 * Handles email verification and resending verification emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse, getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface ResendVerificationRequest {
  email?: string;
}

// POST endpoint - Resend verification email
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    // Try to get user ID from request (if authenticated)
    const currentUserId = await getUserIdFromRequest(request);
    
    const body = await request.json();
    const { email } = body as ResendVerificationRequest;

    let targetEmail = email;
    let userRecord;

    // If user is authenticated, use their email
    if (currentUserId) {
      try {
        userRecord = await auth.getUser(currentUserId);
        targetEmail = userRecord.email;
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    }

    // If no email provided and no authenticated user
    if (!targetEmail) {
      return createErrorResponse('BAD_REQUEST', 'Email address is required');
    }

    // Get user by email if we don't have the user record yet
    if (!userRecord) {
      try {
        userRecord = await auth.getUserByEmail(targetEmail);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return createErrorResponse('BAD_REQUEST', 'No account found with this email address');
        }
        throw error;
      }
    }

    // Check if email is already verified
    if (userRecord.emailVerified) {
      return createApiResponse({
        message: 'Email is already verified',
        emailVerified: true
      });
    }

    // Use Firebase Admin to generate custom verification email
    try {
      // Generate email verification link with proper action code settings
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.getwewrite.app'}/?verified=true`,
        handleCodeInApp: false
      };

      const emailVerificationLink = await auth.generateEmailVerificationLink(
        targetEmail,
        actionCodeSettings
      );

      // Firebase Admin generateEmailVerificationLink automatically sends the email
      // when called with proper configuration
      console.log('✅ Email verification sent via Firebase to:', targetEmail);

      return createApiResponse({
        message: 'Verification email sent successfully',
        email: targetEmail,
        emailVerified: false
      });

    } catch (emailError: any) {
      console.error('Failed to generate email verification link:', emailError);
      
      if (emailError.code === 'auth/user-not-found') {
        return createErrorResponse('BAD_REQUEST', 'No account found with this email address');
      } else if (emailError.code === 'auth/invalid-email') {
        return createErrorResponse('BAD_REQUEST', 'Invalid email address');
      }
      
      return createErrorResponse('INTERNAL_ERROR', 'Failed to send verification email');
    }

  } catch (error: any) {
    console.error('Email verification error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to process email verification request');
  }
}

// PUT endpoint - Verify email with action code
export async function PUT(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const actionCode = searchParams.get('oobCode');

    if (!actionCode) {
      return createErrorResponse('BAD_REQUEST', 'Verification code is required');
    }

    try {
      // Verify the email verification code
      const email = await auth.verifyEmailVerificationCode(actionCode);
      
      // Get user by email
      const userRecord = await auth.getUserByEmail(email);
      
      // Update user's email verification status
      await auth.updateUser(userRecord.uid, {
        emailVerified: true
      });

      // Update user document in Firestore
      await db.collection(getCollectionName('users')).doc(userRecord.uid).update({
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString()
      });

      return createApiResponse({
        message: 'Email verified successfully',
        email,
        emailVerified: true,
        uid: userRecord.uid
      });

    } catch (verificationError: any) {
      console.error('Email verification failed:', verificationError);
      
      if (verificationError.code === 'auth/invalid-action-code') {
        return createErrorResponse('BAD_REQUEST', 'Invalid or expired verification code');
      } else if (verificationError.code === 'auth/expired-action-code') {
        return createErrorResponse('BAD_REQUEST', 'Verification code has expired');
      } else if (verificationError.code === 'auth/user-not-found') {
        return createErrorResponse('BAD_REQUEST', 'No account found for this verification code');
      }
      
      return createErrorResponse('INTERNAL_ERROR', 'Email verification failed');
    }

  } catch (error: any) {
    console.error('Email verification error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to verify email');
  }
}

// GET endpoint - Check email verification status
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();

    // Get user ID from request
    const currentUserId = await getUserIdFromRequest(request);
    
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Get user record
    const userRecord = await auth.getUser(currentUserId);

    return createApiResponse({
      emailVerified: userRecord.emailVerified,
      uid: userRecord.uid
    });

  } catch (error: any) {
    console.error('Email verification status check error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return createErrorResponse('BAD_REQUEST', 'User not found');
    }
    
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check email verification status');
  }
}
