/**
 * Password Reset API
 * Environment-aware password reset system following WeWrite API architecture
 *
 * Handles password reset requests and confirmations with:
 * - Environment-specific Firebase configuration
 * - Detailed error messaging for UI display
 * - Robust error handling and fallback mechanisms
 * - Industry-standard security practices
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin, getFirebaseAdminError } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType, logEnvironmentConfig } from '../../../utils/environmentConfig';
import { enhanceFirebaseError, logEnhancedFirebaseError } from '../../../utils/firebase-error-handler';

interface ResetPasswordRequest {
  email: string;
}

interface ConfirmResetRequest {
  oobCode: string;
  newPassword: string;
}

/**
 * POST /api/auth/reset-password
 *
 * Environment-aware password reset email sending
 * Follows WeWrite API architecture with detailed error handling
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const envType = getEnvironmentType();

  try {
    console.log('🔐 [Password Reset API] Processing request', {
      environment: envType,
      timestamp: new Date().toISOString()
    });

    // Environment configuration logging for debugging
    if (envType === 'development') {
      logEnvironmentConfig();
    }

    // Initialize Firebase Admin with proper error handling
    const admin = getFirebaseAdmin();
    if (!admin) {
      const initError = getFirebaseAdminError();
      const errorMsg = `Firebase Admin initialization failed: ${initError || 'Unknown error'}. This is a system configuration issue.`;
      console.error('🔐 [Password Reset API] Critical:', errorMsg);
      return createErrorResponse('INTERNAL_ERROR',
        'Password reset service is temporarily unavailable due to a system configuration issue. Please contact support.'
      );
    }

    const auth = admin.auth();

    // Parse and validate request body
    let body: ResetPasswordRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('🔐 [Password Reset API] Invalid JSON:', parseError);
      return createErrorResponse('BAD_REQUEST', 'Invalid request format - please check your data and try again');
    }

    const { email } = body;

    // Comprehensive email validation
    if (!email) {
      return createErrorResponse('BAD_REQUEST', 'Email address is required to send password reset instructions');
    }

    if (typeof email !== 'string') {
      return createErrorResponse('BAD_REQUEST', 'Email must be a valid text string');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse('BAD_REQUEST', 'Please enter a valid email address (example: user@domain.com)');
    }

    const maskedEmail = email.substring(0, 3) + '***@' + email.split('@')[1];
    console.log('🔐 [Password Reset API] Processing for:', maskedEmail);

    try {
      // Step 1: Verify user exists (with detailed error handling)
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        console.log('🔐 [Password Reset API] User verified:', {
          uid: userRecord.uid,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          environment: envType
        });
      } catch (userError: any) {
        // Enhanced error handling for user lookup
        logEnhancedFirebaseError(userError, 'Password Reset - User Lookup');

        if (userError.code === 'auth/user-not-found') {
          // Security: Don't reveal if email exists, but log for debugging
          console.log('🔐 [Password Reset API] User not found for:', maskedEmail);
          return createApiResponse({
            message: 'If an account with this email exists, a password reset email has been sent. Please check your email and spam folder.',
            email: maskedEmail,
            success: true
          });
        }

        // Handle other user lookup errors with detailed messaging
        const enhanced = enhanceFirebaseError(userError, 'Password Reset - User Verification');
        return createErrorResponse('INTERNAL_ERROR',
          `Unable to verify account: ${enhanced.userMessage}. Please try again or contact support if the issue persists.`
        );
      }

      // Step 2: Check if user account is in valid state
      if (userRecord.disabled) {
        console.warn('🔐 [Password Reset API] Attempt to reset password for disabled account:', maskedEmail);
        return createErrorResponse('FORBIDDEN',
          'This account has been disabled. Please contact support for assistance.'
        );
      }

      // Step 3: Generate password reset link with environment-aware configuration
      // Prefer configured app URL, otherwise fall back to current request origin
      const requestOrigin = request.nextUrl?.origin;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestOrigin || 'https://www.getwewrite.app';
      const actionCodeSettings = {
        url: `${baseUrl}/auth/reset-password`,
        handleCodeInApp: false
      };

      console.log('🔐 [Password Reset API] Generating reset link with settings:', {
        actionUrl: actionCodeSettings.url,
        environment: envType,
        userEmailVerified: userRecord.emailVerified
      });

      let resetLink;
      try {
        resetLink = await auth.generatePasswordResetLink(email, actionCodeSettings);
        console.log('🔐 [Password Reset API] Reset link generated successfully');
      } catch (linkError: any) {
        // Enhanced error handling for link generation
        logEnhancedFirebaseError(linkError, 'Password Reset - Link Generation');

        const enhanced = enhanceFirebaseError(linkError, 'Password Reset - Email Generation');

        // Provide specific error messages based on Firebase error codes
        if (linkError.code === 'auth/email-not-found') {
          return createErrorResponse('BAD_REQUEST',
            'No account found with this email address. Please check your email or create a new account.'
          );
        } else if (linkError.code === 'auth/too-many-requests') {
          return createErrorResponse('BAD_REQUEST',
            'Too many password reset requests. Please wait 15 minutes before trying again.'
          );
        } else if (linkError.code === 'auth/invalid-email') {
          return createErrorResponse('BAD_REQUEST',
            'Invalid email address format. Please enter a valid email address.'
          );
        } else if (linkError.code === 'auth/invalid-continue-uri' || linkError.code === 'auth/unauthorized-continue-uri') {
          return createErrorResponse(
            'INTERNAL_ERROR',
            'Reset link domain is not authorized. Please try again later or contact support so we can update the allowed domains.'
          );
        } else if (linkError.code === 'auth/configuration-not-found') {
          console.error('🔐 [Password Reset API] Firebase email templates not configured');
          return createErrorResponse('INTERNAL_ERROR',
            'Email service configuration error. Please contact support - this is a system issue that needs to be resolved.'
          );
        }

        return createErrorResponse('INTERNAL_ERROR',
          `Failed to send password reset email: ${enhanced.userMessage}. Please try again or contact support.`
        );
      }

      // Step 4: Log success and return response
      const processingTime = Math.round(performance.now() - startTime);
      console.log('🔐 [Password Reset API] Success:', {
        email: maskedEmail,
        processingTime: `${processingTime}ms`,
        environment: envType,
        linkGenerated: !!resetLink
      });

      return createApiResponse({
        message: 'Password reset email sent successfully. Please check your email and spam folder.',
        email: maskedEmail,
        success: true,
        processingTime,
        environment: envType
      });

    } catch (error: any) {
      // This catch block should never be reached due to inner try-catch blocks
      // But it's here as a final safety net
      logEnhancedFirebaseError(error, 'Password Reset - Final Safety Net');

      const enhanced = enhanceFirebaseError(error, 'Password Reset');
      console.error('🔐 [Password Reset API] Unexpected final error:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        email: maskedEmail,
        environment: envType,
        timestamp: new Date().toISOString()
      });

      // Provide more specific error information for debugging
      const errorDetails = {
        message: error.message || 'Unknown error',
        code: error.code || 'unknown',
        type: error.constructor?.name || 'Error'
      };

      return createErrorResponse('INTERNAL_ERROR',
        `Password reset failed: ${enhanced.userMessage}. Error details: ${errorDetails.type} - ${errorDetails.message}. Please try again or contact support with this information.`
      );
    }

  } catch (error: any) {
    // Final outer catch - should rarely be reached due to comprehensive inner error handling
    const processingTime = Math.round(performance.now() - startTime);

    logEnhancedFirebaseError(error, 'Password Reset - Outer Catch');
    console.error('🔐 [Password Reset API] Outer catch error:', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      processingTime: `${processingTime}ms`,
      environment: envType,
      timestamp: new Date().toISOString()
    });

    const enhanced = enhanceFirebaseError(error, 'Password Reset System');

    // Provide more detailed error information for users and debugging
    const errorDetails = {
      message: error.message || 'Unknown system error',
      code: error.code || 'unknown',
      type: error.constructor?.name || 'Error',
      processingTime: `${processingTime}ms`
    };

    return createErrorResponse('INTERNAL_ERROR',
      `Password reset system error: ${enhanced.userMessage}. Technical details: ${errorDetails.type} - ${errorDetails.message} (${errorDetails.processingTime}). Please try again or contact support with this information.`
    );
  }
}

/**
 * PUT /api/auth/reset-password
 *
 * Environment-aware password reset confirmation
 * Handles the actual password change after user clicks reset link
 */
export async function PUT(request: NextRequest) {
  const startTime = performance.now();
  const envType = getEnvironmentType();

  try {
    console.log('🔐 [Password Reset Confirm API] Processing confirmation', {
      environment: envType,
      timestamp: new Date().toISOString()
    });

    // Initialize Firebase Admin with proper error handling
    const admin = getFirebaseAdmin();
    if (!admin) {
      const initError = getFirebaseAdminError();
      const errorMsg = `Firebase Admin initialization failed: ${initError || 'Unknown error'}`;
      console.error('🔐 [Password Reset Confirm API] Critical:', errorMsg);
      return createErrorResponse('INTERNAL_ERROR',
        'Password reset service is temporarily unavailable due to a system configuration issue. Please contact support.'
      );
    }

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

    // Enhanced error logging for debugging
    console.error('🔐 [Password Reset Confirm] Detailed error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Provide more specific error information
    const errorDetails = {
      message: error.message || 'Unknown error',
      code: error.code || 'unknown',
      type: error.constructor?.name || 'Error'
    };

    return createErrorResponse('INTERNAL_ERROR',
      `Failed to reset password: ${errorDetails.type} - ${errorDetails.message}. Please try again or contact support.`
    );
  }
}

// GET endpoint - Verify reset code validity
export async function GET(request: NextRequest) {
  try {
    console.log('🔐 [Password Reset] Verifying reset code');

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('🔐 [Password Reset] Firebase Admin not available');
      return createErrorResponse('INTERNAL_ERROR', 'Service temporarily unavailable');
    }

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

      // Enhanced error logging for debugging
      console.error('🔐 [Password Reset Verify] Detailed error:', {
        message: verifyError.message,
        code: verifyError.code,
        stack: verifyError.stack,
        timestamp: new Date().toISOString()
      });

      if (verifyError.message?.includes('EXPIRED_OOB_CODE')) {
        return createApiResponse({
          valid: false,
          error: 'Expired reset code',
          message: 'The reset code has expired. Please request a new password reset.'
        });
      } else if (verifyError.message?.includes('INVALID_OOB_CODE')) {
        return createApiResponse({
          valid: false,
          error: 'Invalid reset code',
          message: 'The reset code is invalid or malformed. Please request a new password reset.'
        });
      } else {
        const errorDetails = {
          message: verifyError.message || 'Unknown error',
          code: verifyError.code || 'unknown',
          type: verifyError.constructor?.name || 'Error'
        };

        return createApiResponse({
          valid: false,
          error: 'Verification failed',
          message: `Failed to verify reset code: ${errorDetails.type} - ${errorDetails.message}`
        });
      }
    }

  } catch (error: any) {
    console.error('Reset code verification error:', error);

    // Enhanced error logging for debugging
    console.error('🔐 [Password Reset Verify] Outer catch error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    const errorDetails = {
      message: error.message || 'Unknown error',
      code: error.code || 'unknown',
      type: error.constructor?.name || 'Error'
    };

    return createErrorResponse('INTERNAL_ERROR',
      `Failed to verify reset code: ${errorDetails.type} - ${errorDetails.message}. Please try again or contact support.`
    );
  }
}
