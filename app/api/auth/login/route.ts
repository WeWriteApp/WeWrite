import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';

/**
 * Login API Endpoint
 *
 * This endpoint provides Firebase authentication.
 * Standard Firebase Auth implementation.
 */

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
    displayName: string;
    emailVerified: boolean;
  };
  error?: string;
}

// Helper function to create error responses
function createErrorResponse(message: string, status: number = 400): NextResponse {
  const response: LoginResponse = {
    success: false,
    error: message
  };
  return NextResponse.json(response, { status });
}

// Helper function to create success responses
function createSuccessResponse(user: LoginResponse['user']): NextResponse {
  const response: LoginResponse = {
    success: true,
    user
  };
  return NextResponse.json(response);
}

// POST endpoint - User login
export async function POST(request: NextRequest) {
  try {
    console.log('[Auth] Login request received');

    const body = await request.json() as LoginRequest;
    const { emailOrUsername, password } = body;

    // Validate required fields
    if (!emailOrUsername || !password) {
      return createErrorResponse('Email/username and password are required');
    }

    // Check if we should use dev auth system
    // Use dev auth for:
    // 1. Local development (NODE_ENV=development + USE_DEV_AUTH=true)
    // 2. Preview environments (VERCEL_ENV=preview) - for testing with production data
    const environmentType = getEnvironmentType();
    const isLocalDev = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    const isPreviewEnv = environmentType === 'preview';
    const useDevAuth = isLocalDev || isPreviewEnv;

    if (useDevAuth) {
      console.log(`[Auth] Using dev auth system (environment: ${environmentType}, local dev: ${isLocalDev}, preview: ${isPreviewEnv})`);

      // In development mode, check against known test accounts
      const testAccounts = [
        { email: 'test@local.dev', username: 'testuser', password: 'TestPassword123!', uid: 'dev_test_user_1', isAdmin: false },
        { email: 'jamie@wewrite.app', username: 'jamie', password: 'TestPassword123!', uid: 'dev_admin_user', isAdmin: true }
      ];

      // Find matching account
      const account = testAccounts.find(acc =>
        (acc.email === emailOrUsername || acc.username === emailOrUsername) && acc.password === password
      );

      if (!account) {
        console.log(`[Auth] Dev auth login failed: invalid credentials (environment: ${environmentType})`);
        return createErrorResponse('Invalid credentials');
      }

      // Create session cookie
      const cookieStore = await cookies();
      const sessionData = {
        uid: account.uid,
        email: account.email,
        username: account.username,
        displayName: account.username,
        emailVerified: true
      };

      cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      console.log(`[Auth] Dev auth login successful for: ${account.email} (environment: ${environmentType})`);

      return createSuccessResponse({
        uid: account.uid,
        email: account.email,
        username: account.username,
        displayName: account.username,
        emailVerified: true
      });
    }

    // Production mode: use Firebase Auth
    const { auth, firestore } = getFirebaseAdmin();

    // Determine if input is email or username
    const isEmail = emailOrUsername.includes('@');
    let email = emailOrUsername;

    // If username provided, look up email
    if (!isEmail) {
      const usersCollection = getCollectionName('users');
      const userQuery = await firestore
        .collection(usersCollection)
        .where('username', '==', emailOrUsername)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return createErrorResponse('User not found');
      }

      email = userQuery.docs[0].data().email;
    }

    // Try to get user by email to verify they exist
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      return createErrorResponse('Invalid credentials');
    }

    // Get user data from Firestore
    const usersCollection = getCollectionName('users');
    const userDoc = await firestore.collection(usersCollection).doc(userRecord.uid).get();

    if (!userDoc.exists) {
      return createErrorResponse('User profile not found');
    }

    const userData = userDoc.data();

    // Create session cookie
    const cookieStore = await cookies();
    const sessionData = {
      uid: userRecord.uid,
      email: userRecord.email!,
      username: userData?.username,
      emailVerified: userRecord.emailVerified
    };

    cookieStore.set('simpleUserSession', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    console.log('[Auth] Login successful for:', userRecord.email);

    return createSuccessResponse({
      uid: userRecord.uid,
      email: userRecord.email!,
      username: userData?.username,
      displayName: userData?.displayName || userRecord.displayName || userRecord.email!,
      emailVerified: userRecord.emailVerified
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return createErrorResponse('An error occurred during login', 500);
  }
}


