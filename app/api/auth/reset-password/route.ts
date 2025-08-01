/**
 * Password Reset API
 * Handles password reset requests and confirmations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface ResetPasswordRequest {
  email: string;
}

interface ConfirmResetRequest {
  oobCode: string;
  newPassword: string;
}

// POST endpoint - Send password reset email
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();

    const body = await request.json();
    const { email } = body as ResetPasswordRequest;

    // Validate email
    if (!email) {
      return createErrorResponse('BAD_REQUEST', 'Email address is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse('BAD_REQUEST', 'Invalid email format');
    }

    try {
      // Check if user exists
      await auth.getUserByEmail(email);

      // Generate password reset link
      const resetLink = await auth.generatePasswordResetLink(email);
      
      // In a real application, you would send this via your email service
      // For now, we'll just log it and return success
      console.log('Password reset link generated:', resetLink);
      
      // TODO: Integrate with email service to send reset email
      // await sendPasswordResetEmail(email, resetLink);
      
      return createApiResponse({
        message: 'Password reset email sent successfully',
        email
      });

    } catch (error: any) {
      // For security reasons, we don't reveal if the email exists or not
      // Always return success to prevent email enumeration attacks
      if (error.code === 'auth/user-not-found') {
        return createApiResponse({
          message: 'If an account with this email exists, a password reset email has been sent',
          email
        });
      }
      
      throw error;
    }

  } catch (error: any) {
    console.error('Password reset request error:', error);
    
    if (error.code === 'auth/invalid-email') {
      return createErrorResponse('BAD_REQUEST', 'Invalid email address');
    }
    
    return createErrorResponse('INTERNAL_ERROR', 'Failed to send password reset email');
  }
}

// PUT endpoint - Confirm password reset with new password
export async function PUT(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    const body = await request.json();
    const { oobCode, newPassword } = body as ConfirmResetRequest;

    // Validate inputs
    if (!oobCode) {
      return createErrorResponse('BAD_REQUEST', 'Reset code is required');
    }

    if (!newPassword) {
      return createErrorResponse('BAD_REQUEST', 'New password is required');
    }

    if (newPassword.length < 6) {
      return createErrorResponse('BAD_REQUEST', 'Password must be at least 6 characters long');
    }

    try {
      // Confirm the password reset using Firebase REST API
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error('Firebase API key not configured');
      }

      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oobCode,
          newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to reset password');
      }

      const data = await response.json();
      const email = data.email;

      // Get user record using Admin SDK
      const userRecord = await auth.getUserByEmail(email);

      // Update last password change time in Firestore
      await db.collection(getCollectionName('users')).doc(userRecord.uid).update({
        lastPasswordChange: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });

      return createApiResponse({
        message: 'Password reset successfully',
        email,
        uid: userRecord.uid
      });

    } catch (resetError: any) {
      console.error('Password reset confirmation failed:', resetError);

      if (resetError.message?.includes('INVALID_OOB_CODE')) {
        return createErrorResponse('BAD_REQUEST', 'Invalid or expired reset code');
      } else if (resetError.message?.includes('EXPIRED_OOB_CODE')) {
        return createErrorResponse('BAD_REQUEST', 'Reset code has expired');
      } else if (resetError.message?.includes('WEAK_PASSWORD')) {
        return createErrorResponse('BAD_REQUEST', 'Password is too weak');
      } else if (resetError.message?.includes('USER_NOT_FOUND')) {
        return createErrorResponse('BAD_REQUEST', 'No account found for this reset code');
      }

      return createErrorResponse('INTERNAL_ERROR', 'Password reset failed');
    }

  } catch (error: any) {
    console.error('Password reset confirmation error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to reset password');
  }
}

// GET endpoint - Verify reset code validity
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();

    const { searchParams } = new URL(request.url);
    const oobCode = searchParams.get('oobCode');

    if (!oobCode) {
      return createErrorResponse('BAD_REQUEST', 'Reset code is required');
    }

    try {
      // Verify the password reset code using Firebase REST API
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error('Firebase API key not configured');
      }

      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oobCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to verify reset code');
      }

      const data = await response.json();

      return createApiResponse({
        valid: true,
        email: data.email,
        message: 'Reset code is valid'
      });

    } catch (verifyError: any) {
      console.error('Reset code verification failed:', verifyError);

      if (verifyError.message?.includes('EXPIRED_OOB_CODE')) {
        return createApiResponse({
          valid: false,
          error: 'Expired reset code',
          message: 'The reset code has expired'
        });
      } else if (verifyError.message?.includes('INVALID_OOB_CODE')) {
        return createApiResponse({
          valid: false,
          error: 'Invalid reset code',
          message: 'The reset code is invalid or malformed'
        });
      } else {
        return createApiResponse({
          valid: false,
          error: 'Verification failed',
          message: 'Failed to verify reset code'
        });
      }
    }

  } catch (error: any) {
    console.error('Reset code verification error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to verify reset code');
  }
}
