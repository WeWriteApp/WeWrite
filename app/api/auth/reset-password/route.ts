/**
 * Password Reset API - Custom Email Version
 * 
 * Uses Firebase Admin SDK to generate reset links, then sends custom branded
 * emails via our Resend email service instead of Firebase's default emails.
 * 
 * Falls back to Firebase REST API if Admin SDK fails (for verification/confirmation).
 */

import { NextRequest } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getCollectionName } from '../../../utils/environmentConfig';
import { initAdmin } from '../../../firebase/admin';
import { sendPasswordResetEmail as sendCustomResetEmail } from '../../../services/emailService';
import { passwordResetRateLimiter } from '../../../utils/rateLimiter';
import { isValidEmailStrict } from '@/utils/validationPatterns';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.getwewrite.app';

interface ResetPasswordRequest {
  email: string;
}

interface ConfirmResetRequest {
  oobCode: string;
  newPassword: string;
}

/**
 * Generate password reset link using Firebase Admin SDK and send custom email
 */
async function generateAndSendCustomResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = initAdmin();
    if (!admin) {
      console.error('[Password Reset] Firebase Admin not available, falling back to REST API');
      return await sendFirebaseDefaultResetEmail(email);
    }

    const auth = admin.auth();
    const db = admin.firestore();

    // Check if user exists and get their username
    let userRecord;
    let username: string | undefined;
    let userId: string | undefined;

    try {
      userRecord = await auth.getUserByEmail(email);
      userId = userRecord.uid;

      // Try to get username from Firestore
      const userDoc = await db.collection(getCollectionName('users')).doc(userRecord.uid).get();
      if (userDoc.exists) {
        username = userDoc.data()?.username;
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Security: Don't reveal if email exists - return success
        console.log('[Password Reset] User not found, returning success for security');
        return { success: true };
      }
      console.error('[Password Reset] Error checking user:', err.code, err.message);
      throw err;
    }

    // Generate the password reset link from Firebase
    const actionCodeSettings = {
      url: `${APP_URL}/auth/reset-password`,
      handleCodeInApp: false
    };

    const firebaseResetLink = await auth.generatePasswordResetLink(email, actionCodeSettings);
    
    // Transform Firebase URL to use our domain for better deliverability
    // Firebase generates: https://wewrite-ccd82.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=xxx
    // We transform to: https://getwewrite.app/auth/reset-password?oobCode=xxx
    const url = new URL(firebaseResetLink);
    const oobCode = url.searchParams.get('oobCode');
    const resetLink = `${APP_URL}/auth/reset-password?oobCode=${oobCode}`;

    // Send custom branded email via Resend
    const emailSent = await sendCustomResetEmail({
      to: email,
      resetLink,
      username,
      userId,
    });

    if (!emailSent) {
      console.error('[Password Reset] Failed to send email via Resend');
      return { success: false, error: 'Failed to send reset email' };
    }

    return { success: true };

  } catch (error: any) {
    console.error('[Password Reset] Error generating/sending reset email:', {
      code: error.code,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      // Security: Don't reveal if email exists
      return { success: true };
    }
    
    if (error.code === 'auth/invalid-email') {
      return { success: false, error: 'Invalid email address' };
    }

    // If Admin SDK fails, fall back to REST API
    console.log('[Password Reset] Admin SDK failed, falling back to REST API');
    return await sendFirebaseDefaultResetEmail(email);
  }
}

/**
 * Legacy: Send password reset email using Firebase REST API (sends Firebase's default email)
 * Kept as fallback but should not be used normally
 */
async function sendFirebaseDefaultResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
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

  try {
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

    if (!isValidEmailStrict(email)) {
      return createErrorResponse('BAD_REQUEST', 'Please enter a valid email address');
    }

    // Rate limiting by email address to prevent abuse
    const rateLimitKey = `password-reset:${email.toLowerCase()}`;
    const rateLimitResult = await passwordResetRateLimiter.checkLimit(rateLimitKey);
    if (!rateLimitResult.allowed) {
      console.log(`🔐 [Password Reset] Rate limited: ${email}`);
      return createErrorResponse('BAD_REQUEST',
        'Too many password reset requests. Please wait before trying again.'
      );
    }

    const maskedEmail = email.substring(0, 3) + '***@' + email.split('@')[1];

    // Send custom branded password reset email
    const result = await generateAndSendCustomResetEmail(email);

    if (!result.success) {
      // Handle specific errors
      const errorMessage = result.error || 'Unknown error';
      
      if (errorMessage.includes('INVALID_EMAIL') || errorMessage.includes('Invalid email')) {
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

      console.error('🔐 [Password Reset] Unexpected error:', errorMessage);
      return createErrorResponse('INTERNAL_ERROR',
        `Failed to send password reset email. Please try again or contact support.`
      );
    }

    const processingTime = Math.round(performance.now() - startTime);

    return createApiResponse({
      message: 'Password reset email sent. Please check your inbox and spam folder.',
      email: maskedEmail,
      success: true,
      processingTime
    });

  } catch (error: any) {
    const processingTime = Math.round(performance.now() - startTime);
    console.error('🔐 [Password Reset] Error:', {
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

  try {
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
