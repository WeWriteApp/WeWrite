import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { DEV_TEST_USERS } from '../../../firebase/developmentAuth';
import { User, LoginRequest, LoginResponse, AuthErrorCode } from '../../../types/simpleAuth';

/**
 * Simple Login API Endpoint
 * 
 * This endpoint provides simplified authentication that works for both
 * development and production environments without complex multi-auth logic.
 */

// Helper function to create error responses
function createErrorResponse(code: AuthErrorCode, message: string, status: number = 400): NextResponse {
  const response: LoginResponse = {
    success: false,
    error: message
  };
  return NextResponse.json(response, { status });
}

// Helper function to create success responses
function createSuccessResponse(user: User): NextResponse {
  const response: LoginResponse = {
    success: true,
    user
  };
  return NextResponse.json(response);
}

// POST endpoint - Simple user login
export async function POST(request: NextRequest) {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    
    console.log(`[Simple Auth] Login request - Environment: ${process.env.NODE_ENV}, Dev Auth: ${isDevelopment}`);

    const body = await request.json() as LoginRequest;
    const { emailOrUsername, password } = body;

    // Validate required fields
    if (!emailOrUsername || !password) {
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Email/username and password are required');
    }

    if (isDevelopment) {
      return handleDevelopmentLogin(emailOrUsername, password);
    } else {
      return handleProductionLogin(emailOrUsername, password);
    }

  } catch (error) {
    console.error('[Simple Auth] Login error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'An error occurred during login', 500);
  }
}

/**
 * Handle development authentication with test users
 */
async function handleDevelopmentLogin(emailOrUsername: string, password: string): Promise<NextResponse> {
  try {
    // Find test user by email or username
    let testUser = Object.values(DEV_TEST_USERS).find(user => 
      user.email === emailOrUsername || user.username === emailOrUsername
    );

    if (!testUser) {
      console.log(`[Simple Auth] Test user not found: ${emailOrUsername}`);
      return createErrorResponse(AuthErrorCode.USER_NOT_FOUND, 'Invalid credentials');
    }

    // Verify password
    if (password !== 'testpass123') {
      console.log(`[Simple Auth] Invalid password for test user: ${emailOrUsername}`);
      return createErrorResponse(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    // Create user object
    const user: User = {
      uid: testUser.uid,
      email: testUser.email,
      username: testUser.username,
      displayName: testUser.displayName,
      photoURL: testUser.photoURL || undefined,
      emailVerified: testUser.emailVerified,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    // Set session cookie
    const cookieStore = cookies();
    const sessionData = {
      uid: user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    };

    cookieStore.set('simpleUserSession', JSON.stringify(sessionData), cookieOptions);

    console.log(`[Simple Auth] Development login successful: ${user.username} (${user.email})`);
    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Simple Auth] Development login error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Development login failed', 500);
  }
}

/**
 * Handle production authentication with Firebase
 */
async function handleProductionLogin(emailOrUsername: string, password: string): Promise<NextResponse> {
  try {
    const { adminDb, adminAuth } = getFirebaseAdmin();

    // Try to find user by email first, then by username
    let userRecord;
    let userData;

    try {
      // Try email first
      if (emailOrUsername.includes('@')) {
        userRecord = await adminAuth.getUserByEmail(emailOrUsername);
      } else {
        // Search by username in Firestore
        const usersRef = adminDb.collection(getCollectionName('users'));
        const usernameQuery = await usersRef.where('username', '==', emailOrUsername).limit(1).get();
        
        if (usernameQuery.empty) {
          return createErrorResponse(AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        const userDoc = usernameQuery.docs[0];
        userData = userDoc.data();
        userRecord = await adminAuth.getUser(userDoc.id);
      }
    } catch (error) {
      console.log(`[Simple Auth] User not found: ${emailOrUsername}`);
      return createErrorResponse(AuthErrorCode.USER_NOT_FOUND, 'Invalid credentials');
    }

    // Get user data from Firestore if not already retrieved
    if (!userData) {
      const userDoc = await adminDb.collection(getCollectionName('users')).doc(userRecord.uid).get();
      userData = userDoc.data() || {};
    }

    // Create user object
    const user: User = {
      uid: userRecord.uid,
      email: userRecord.email || '',
      username: userData.username || '',
      displayName: userData.displayName || userRecord.displayName || '',
      photoURL: userData.photoURL || userRecord.photoURL || undefined,
      emailVerified: userRecord.emailVerified,
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    // Update last login time
    await adminDb.collection(getCollectionName('users')).doc(user.uid).update({
      lastLoginAt: new Date().toISOString()
    });

    // Create custom token for client-side authentication
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    // Set session cookie
    const cookieStore = cookies();
    const sessionData = {
      uid: user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      customToken
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    };

    cookieStore.set('simpleUserSession', JSON.stringify(sessionData), cookieOptions);

    console.log(`[Simple Auth] Production login successful: ${user.email}`);
    return createSuccessResponse(user);

  } catch (error) {
    console.error('[Simple Auth] Production login error:', error);
    return createErrorResponse(AuthErrorCode.UNKNOWN_ERROR, 'Login failed', 500);
  }
}
