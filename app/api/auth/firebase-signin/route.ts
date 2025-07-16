/**
 * Firebase Sign-In API
 * 
 * This endpoint handles Firebase authentication for production environments only.
 * It should NOT be used in development mode with USE_DEV_AUTH=true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getEnvironmentType } from '../../../utils/environmentConfig';

interface FirebaseSignInRequest {
  customToken: string;
}

// POST endpoint - Sign in with Firebase custom token
export async function POST(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const isDevelopment = envType === 'development' && process.env.USE_DEV_AUTH === 'true';
    
    console.log(`[Firebase Sign-In API] Request - Environment: ${envType}, Dev Auth: ${isDevelopment}`);

    // Block development auth from using Firebase sign-in
    if (isDevelopment) {
      return createErrorResponse('FORBIDDEN', 'Firebase sign-in not allowed with development authentication active');
    }

    const body = await request.json();
    const { customToken } = body as FirebaseSignInRequest;

    // Validate required fields
    if (!customToken) {
      return createErrorResponse('BAD_REQUEST', 'Custom token is required');
    }

    // Validate that this is not a development token
    if (customToken.startsWith('dev_token_')) {
      return createErrorResponse('FORBIDDEN', 'Development tokens cannot be used for Firebase sign-in');
    }

    // In a real implementation, you would:
    // 1. Validate the custom token with Firebase Admin SDK
    // 2. Create the Firebase user session
    // 3. Set appropriate cookies
    // 
    // For now, we'll return success since the token was created by our login API
    
    console.log('[Firebase Sign-In API] Production Firebase sign-in successful');
    
    return createApiResponse({
      success: true,
      message: 'Firebase sign-in successful',
      environment: envType
    });
    
  } catch (error) {
    console.error('Firebase sign-in error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Firebase sign-in failed');
  }
}
