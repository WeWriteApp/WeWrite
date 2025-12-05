/**
 * Login API Endpoint
 * 
 * Uses Firebase REST API instead of firebase-admin SDK to avoid
 * the jwks-rsa/jose dependency chain that fails in Vercel serverless.
 * 
 * Note: Actual password verification happens client-side via Firebase Auth.
 * This endpoint is mainly for:
 * - Development mode login (with test users)
 * - Username to email lookup
 * - Setting session cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { secureLogger, maskEmail } from '../../../utils/secureLogging';
import { DEV_TEST_USERS } from '../../../utils/testUsers';
import { getFirestoreDoc, queryFirestore } from '../../../lib/firebase-rest';

interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    uid: string;
    email: string;
    username?: string;
    emailVerified: boolean;
  };
  error?: string;
}

// Helper function to create error responses
function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Helper function to create success responses
function createSuccessResponse(user: LoginResponse['user']): NextResponse {
  return NextResponse.json({ success: true, user });
}

// POST endpoint - User login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LoginRequest;
    const { emailOrUsername, password } = body;

    // SECURITY: Use secure logging to prevent email exposure
    secureLogger.info('[Auth] Login attempt', {
      emailOrUsername: emailOrUsername?.includes('@') ? maskEmail(emailOrUsername) : emailOrUsername,
      hasPassword: password ? 'YES' : 'NO',
      inputType: emailOrUsername?.includes('@') ? 'email' : 'username',
      environment: getEnvironmentType()
    });

    // Validate required fields
    if (!emailOrUsername || !password) {
      return createErrorResponse('Email/username and password are required');
    }

    // Check if we should use dev auth system
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    if (useDevAuth) {
      console.log('[Auth] Using dev auth system (local development only)');

      // In development mode, check against known test accounts
      const testAccountsArray = Object.values(DEV_TEST_USERS);

      const account = testAccountsArray.find(acc =>
        (acc.email === emailOrUsername || acc.username === emailOrUsername) && acc.password === password
      );

      if (!account) {
        return createErrorResponse('Invalid credentials');
      }

      // Create session cookie
      const cookieStore = await cookies();
      const sessionData = {
        uid: account.uid,
        email: account.email,
        username: account.username,
        emailVerified: true
      };

      cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
      });

      secureLogger.info('[Auth] Dev auth login successful', {
        email: maskEmail(account.email),
        username: account.username
      });

      return createSuccessResponse({
        uid: account.uid,
        email: account.email,
        username: account.username,
        emailVerified: true
      });
    }

    // Production mode: use Firebase REST API for username lookup
    const isEmail = emailOrUsername.includes('@');
    let email = emailOrUsername;
    let username: string | undefined;

    // If username provided, look up email from usernames collection
    if (!isEmail) {
      console.log('[Auth] Looking up email for username:', emailOrUsername);
      
      // Get username document using REST API
      const usernameDoc = await getFirestoreDoc(
        getCollectionName('usernames'),
        emailOrUsername.toLowerCase()
      );

      if (!usernameDoc || !usernameDoc.email) {
        return createErrorResponse('User not found');
      }

      email = usernameDoc.email;
      username = usernameDoc.username || emailOrUsername;
      console.log('[Auth] Resolved email for username');
    }

    // Note: Actual password verification happens client-side via Firebase Auth
    // This endpoint is mainly for username lookup
    // Return the email so client can use it for Firebase signInWithEmailAndPassword

    return NextResponse.json({
      success: true,
      email,
      username,
      message: 'Use this email with Firebase Auth to complete login'
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return createErrorResponse('An error occurred during login', 500);
  }
}


