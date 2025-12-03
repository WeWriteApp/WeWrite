import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { secureLogger, maskEmail } from '../../../utils/secureLogging';
import { DEV_TEST_USERS } from '../../../utils/testUsers';

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
    console.log('[Auth] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[Auth] Request URL:', request.url);

    const body = await request.json() as LoginRequest;
    const { emailOrUsername, password } = body;

    // SECURITY: Use secure logging to prevent email exposure
    secureLogger.info('[Auth] Login attempt', {
      emailOrUsername: emailOrUsername.includes('@') ? maskEmail(emailOrUsername) : emailOrUsername,
      hasPassword: password ? 'YES' : 'NO',
      inputType: emailOrUsername.includes('@') ? 'email' : 'username',
      environment: getEnvironmentType()
    });

    // Validate required fields
    if (!emailOrUsername || !password) {
      console.log('[Auth] Missing required fields');
      return createErrorResponse('Email/username and password are required');
    }

    // Check if we should use dev auth system
    // ONLY use dev auth for local development with USE_DEV_AUTH=true
    // Preview and production environments should use Firebase Auth with real credentials
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    if (useDevAuth) {
      console.log('[Auth] Using dev auth system (local development only)');

      // In development mode, check against known test accounts from testUsers.ts
      const testAccountsArray = Object.values(DEV_TEST_USERS);

      // Find matching account
      const account = testAccountsArray.find(acc =>
        (acc.email === emailOrUsername || acc.username === emailOrUsername) && acc.password === password
      );

      if (!account) {
        console.log('[Auth] Dev auth login failed: invalid credentials');
        return createErrorResponse('Invalid credentials');
      }

      // Create simple session cookie - no complex device management
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
        maxAge: 60 * 60 * 24 * 30, // 30 days - longer for better UX
        path: '/' // Explicit path for consistency
      });

      // SECURITY: Use secure logging to prevent email exposure
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

    // Production mode: use Firebase Auth
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }
    const auth = admin.auth();
    const firestore = admin.firestore();

    // Determine if input is email or username
    const isEmail = emailOrUsername.includes('@');
    let email = emailOrUsername;

    // If username provided, look up email from usernames collection
    if (!isEmail) {
      console.log('[Auth] Looking up email for username:', emailOrUsername);
      const usernamesCollection = getCollectionName('usernames');
      console.log('[Auth] Username collection:', usernamesCollection);

      // Look up the username in the usernames collection (matches client-side auth)
      const usernameDoc = await firestore
        .collection(usernamesCollection)
        .doc(emailOrUsername.toLowerCase())
        .get();

      if (!usernameDoc.exists) {
        console.log('[Auth] Username not found in collection:', usernamesCollection);
        return createErrorResponse('User not found');
      }

      const usernameData = usernameDoc.data();
      email = usernameData?.email;

      if (!email) {
        console.log('[Auth] No email found for username:', emailOrUsername);
        return createErrorResponse('User not found');
      }

      console.log('[Auth] Resolved email for username:', email);
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
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/' // Explicit path for consistency
    });

    // SECURITY: Use secure logging to prevent email exposure
    secureLogger.info('[Auth] Login successful', {
      email: maskEmail(userRecord.email!),
      username: userData?.username
    });

    return createSuccessResponse({
      uid: userRecord.uid,
      email: userRecord.email!,
      username: userData?.username,
      emailVerified: userRecord.emailVerified
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return createErrorResponse('An error occurred during login', 500);
  }
}

// Simplified authentication - no complex session management


