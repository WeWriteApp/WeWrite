/**
 * Password Reset API
 * Handles password reset requests and confirmations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

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
      // Verify the password reset code and get the email
      const email = await auth.verifyPasswordResetCode(oobCode);
      
      // Confirm the password reset
      await auth.confirmPasswordReset(oobCode, newPassword);
      
      // Get user record
      const userRecord = await auth.getUserByEmail(email);
      
      // Update last password change time in Firestore
      await db.collection('users').doc(userRecord.uid).update({
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
      
      if (resetError.code === 'auth/invalid-action-code') {
        return createErrorResponse('BAD_REQUEST', 'Invalid or expired reset code');
      } else if (resetError.code === 'auth/expired-action-code') {
        return createErrorResponse('BAD_REQUEST', 'Reset code has expired');
      } else if (resetError.code === 'auth/weak-password') {
        return createErrorResponse('BAD_REQUEST', 'Password is too weak');
      } else if (resetError.code === 'auth/user-not-found') {
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
      // Verify the password reset code and get the email
      const email = await auth.verifyPasswordResetCode(oobCode);
      
      return createApiResponse({
        valid: true,
        email,
        message: 'Reset code is valid'
      });

    } catch (verifyError: any) {
      console.error('Reset code verification failed:', verifyError);
      
      if (verifyError.code === 'auth/invalid-action-code') {
        return createApiResponse({
          valid: false,
          error: 'Invalid reset code',
          message: 'The reset code is invalid or malformed'
        });
      } else if (verifyError.code === 'auth/expired-action-code') {
        return createApiResponse({
          valid: false,
          error: 'Expired reset code',
          message: 'The reset code has expired'
        });
      } else if (verifyError.code === 'auth/user-not-found') {
        return createApiResponse({
          valid: false,
          error: 'User not found',
          message: 'No account found for this reset code'
        });
      }
      
      return createApiResponse({
        valid: false,
        error: 'Verification failed',
        message: 'Failed to verify reset code'
      });
    }

  } catch (error: any) {
    console.error('Reset code verification error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to verify reset code');
  }
}
