/**
 * Password Reset Debug API
 * Helps diagnose password reset issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';

interface DebugRequest {
  email: string;
  action: 'check_user' | 'generate_link' | 'test_config';
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [Password Reset Debug] Debug request received');
    
    const admin = initAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not available');
    }
    
    const auth = admin.auth();
    const body = await request.json();
    const { email, action } = body as DebugRequest;

    if (!email) {
      return createErrorResponse('BAD_REQUEST', 'Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse('BAD_REQUEST', 'Invalid email format');
    }

    const debugInfo: any = {
      email: email.substring(0, 3) + '***@' + email.split('@')[1],
      timestamp: new Date().toISOString(),
      action
    };

    try {
      switch (action) {
        case 'check_user':
          console.log('🔍 [Password Reset Debug] Checking if user exists');
          const userRecord = await auth.getUserByEmail(email);
          debugInfo.userExists = true;
          debugInfo.userInfo = {
            uid: userRecord.uid,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime
          };
          break;

        case 'generate_link':
          console.log('🔍 [Password Reset Debug] Generating reset link');
          await auth.getUserByEmail(email); // Check user exists first
          
          const actionCodeSettings = {
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.getwewrite.app'}/auth/reset-password`,
            handleCodeInApp: false
          };

          const resetLink = await auth.generatePasswordResetLink(email, actionCodeSettings);
          debugInfo.linkGenerated = true;
          debugInfo.resetLink = resetLink;
          debugInfo.actionCodeSettings = actionCodeSettings;
          break;

        case 'test_config':
          console.log('🔍 [Password Reset Debug] Testing Firebase configuration');
          debugInfo.firebaseConfig = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
            hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON,
            hasFirebaseApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
          };
          
          // Test basic auth functionality
          try {
            await auth.getUserByEmail(email);
            debugInfo.authWorking = true;
          } catch (error: any) {
            debugInfo.authWorking = false;
            debugInfo.authError = error.code;
          }
          break;

        default:
          return createErrorResponse('BAD_REQUEST', 'Invalid action');
      }

      return createApiResponse({
        message: 'Debug information collected',
        debug: debugInfo
      });

    } catch (error: any) {
      console.error('🔍 [Password Reset Debug] Error during debug action:', error);
      
      debugInfo.error = {
        code: error.code,
        message: error.message
      };

      if (error.code === 'auth/user-not-found') {
        debugInfo.userExists = false;
      }

      return createApiResponse({
        message: 'Debug completed with errors',
        debug: debugInfo
      });
    }

  } catch (error: any) {
    console.error('🔍 [Password Reset Debug] Debug request error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Debug request failed');
  }
}
