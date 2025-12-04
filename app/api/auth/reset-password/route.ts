/**
 * Password Reset API - REST API Version
 * 
 * Uses Firebase REST API directly to avoid firebase-admin dependency issues
 * with jwks-rsa/jose in Vercel's serverless environment.
 * 
 * This is a more reliable approach that works consistently across all environments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getEnvironmentType } from '../../../utils/environmentConfig';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

interface ResetPasswordRequest {
  email: string;
}

interface ConfirmResetRequest {
  oobCode: string;
  newPassword: string;
}

/**
 * Send password reset email using Firebase REST API
 * This bypasses firebase-admin SDK entirely, avoiding jwks-rsa dependency issues
 */
async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API key not configured');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: email,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || 'Unknown error';
    console.error('[Password Reset REST] Firebase error:', errorMessage);
    return { success: false, error: errorMessage };
  }

  return { success: true };
}

/**
 * Verify a password reset code
 */
async function verifyPasswordResetCode(oobCode: string): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API key not configured');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oobCode: oobCode,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || 'Unknown error';
    return { valid: false, error: errorMessage };
  }

  return { valid: true, email: data.email };
}

/**
 * Confirm password reset with new password
 */
async function confirmPasswordReset(oobCode: string, newPassword: string): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API key not configured');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oobCode: oobCode,
        newPassword: newPassword,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || 'Unknown error';
    return { success: false, error: errorMessage };
  }

  return { success: true, email: data.email };
}

/**
 * POST /api/auth/reset-password
 * Send password reset email
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const envType = getEnvironmentType();

  try {
    console.log('🔐 [Password Reset REST API] Processing request', {
      environment: envType,
      timestamp: new Date().toISOString()
    });

    // Check API key is available
    if (!FIREBASE_API_KEY) {
      console.error('🔐 [Password Reset REST API] Firebase API key not configured');
      return createErrorResponse('INTERNAL_ERROR',
        'Password reset service is not configured. Please contact support.'
      );
    }

    // Parse and validate request body
    let body: ResetPasswordRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('🔐 [Password Reset REST API] Invalid JSON:', parseError);
      return createErrorResponse('BAD_REQUEST', 'Invalid request format');
    }

    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return createErrorResponse('BAD_REQUEST', 'Email address is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse('BAD_REQUEST', 'Please enter a valid email address');
    }

    const maskedEmail = email.substring(0, 3) + '***@' + email.split('@')[1];
    console.log('🔐 [Password Reset REST API] Processing for:', maskedEmail);

    // Send password reset email via REST API
    const result = await sendPasswordResetEmail(email);

    if (!result.success) {
      // Handle specific Firebase errors
      const errorMessage = result.error || 'Unknown error';
      
      if (errorMessage.includes('EMAIL_NOT_FOUND')) {
        // Security: Don't reveal if email exists
        console.log('🔐 [Password Reset REST API] Email not found:', maskedEmail);
        return createApiResponse({
          message: 'If an account with this email exists, a password reset email has been sent.',
          email: maskedEmail,
          success: true
        });
      }
      
      if (errorMessage.includes('INVALID_EMAIL')) {
        return createErrorResponse('BAD_REQUEST', 'Invalid email address format');
      }
      
      if (errorMessage.includes('TOO_MANY_ATTEMPTS') || errorMessage.includes('TOO_MANY_REQUESTS')) {
        return createErrorResponse('BAD_REQUEST',
          'Too many password reset requests. Please wait a few minutes before trying again.'
        );
      }

      if (errorMessage.includes('RESET_PASSWORD_EXCEED_LIMIT')) {
        return createErrorResponse('BAD_REQUEST',
          'Password reset limit exceeded. Please wait 24 hours before trying again.'
        );
      }

      console.error('🔐 [Password Reset REST API] Unexpected error:', errorMessage);
      return createErrorResponse('INTERNAL_ERROR',
        `Failed to send password reset email. Please try again or contact support.`
      );
    }

    const processingTime = Math.round(performance.now() - startTime);
    console.log('🔐 [Password Reset REST API] Success:', {
      email: maskedEmail,
      processingTime: `${processingTime}ms`,
      environment: envType
    });

    return createApiResponse({
      message: 'Password reset email sent. Please check your inbox and spam folder.',
      email: maskedEmail,
      success: true,
      processingTime
    });

  } catch (error: any) {
    const processingTime = Math.round(performance.now() - startTime);
    console.error('🔐 [Password Reset REST API] Error:', {
      message: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

    return createErrorResponse('INTERNAL_ERROR',
      `Password reset failed due to an unexpected error. Technical details: ${error.message}. Please try again or contact support with this information.`
    );
  }
}

/**
 * PUT /api/auth/reset-password
 * Confirm password reset with new password
 */
export async function PUT(request: NextRequest) {
  const startTime = performance.now();
  const envType = getEnvironmentType();

  try {
    console.log('🔐 [Password Reset REST API] Processing confirmation', {
      environment: envType,
      timestamp: new Date().toISOString()
    });

    if (!FIREBASE_API_KEY) {
      return createErrorResponse('INTERNAL_ERROR', 'Service not configured');
    }

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

    // Confirm password reset
    const result = await confirmPasswordReset(oobCode, newPassword);

    if (!result.success) {
      const errorMessage = result.error || 'Unknown error';

      if (errorMessage.includes('INVALID_OOB_CODE')) {
        return createErrorResponse('BAD_REQUEST', 'Invalid or expired reset link. Please request a new password reset.');
      }
      
      if (errorMessage.includes('EXPIRED_OOB_CODE')) {
        return createErrorResponse('BAD_REQUEST', 'This reset link has expired. Please request a new password reset.');
      }
      
      if (errorMessage.includes('WEAK_PASSWORD')) {
        return createErrorResponse('BAD_REQUEST', 'Password is too weak. Please choose a stronger password.');
      }
      
      if (errorMessage.includes('USER_DISABLED')) {
        return createErrorResponse('FORBIDDEN', 'This account has been disabled. Please contact support.');
      }

      console.error('🔐 [Password Reset REST API] Confirmation error:', errorMessage);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to reset password. Please try again.');
    }

    const processingTime = Math.round(performance.now() - startTime);
    console.log('🔐 [Password Reset REST API] Password reset confirmed:', {
      email: result.email,
      processingTime: `${processingTime}ms`
    });

    return createApiResponse({
      message: 'Password reset successfully. You can now log in with your new password.',
      email: result.email,
      success: true
    });

  } catch (error: any) {
    console.error('🔐 [Password Reset REST API] Confirmation error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return createErrorResponse('INTERNAL_ERROR',
      `Password reset failed: ${error.message}. Please try again or contact support.`
    );
  }
}

/**
 * GET /api/auth/reset-password
 * Verify reset code validity
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔐 [Password Reset REST API] Verifying reset code');

    if (!FIREBASE_API_KEY) {
      return createErrorResponse('INTERNAL_ERROR', 'Service not configured');
    }

    const { searchParams } = new URL(request.url);
    const oobCode = searchParams.get('oobCode');

    if (!oobCode) {
      return createErrorResponse('BAD_REQUEST', 'Reset code is required');
    }

    const result = await verifyPasswordResetCode(oobCode);

    if (!result.valid) {
      const errorMessage = result.error || 'Unknown error';

      if (errorMessage.includes('EXPIRED_OOB_CODE')) {
        return createApiResponse({
          valid: false,
          error: 'expired',
          message: 'This reset link has expired. Please request a new password reset.'
        });
      }
      
      if (errorMessage.includes('INVALID_OOB_CODE')) {
        return createApiResponse({
          valid: false,
          error: 'invalid',
          message: 'This reset link is invalid. Please request a new password reset.'
        });
      }

      return createApiResponse({
        valid: false,
        error: 'unknown',
        message: 'Unable to verify reset link. Please request a new password reset.'
      });
    }

    return createApiResponse({
      valid: true,
      email: result.email,
      message: 'Reset code is valid'
    });

  } catch (error: any) {
    console.error('🔐 [Password Reset REST API] Verification error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return createErrorResponse('INTERNAL_ERROR',
      `Failed to verify reset code: ${error.message}`
    );
  }
}
