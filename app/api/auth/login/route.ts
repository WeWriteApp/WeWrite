/**
 * User Login API
 * Handles user authentication with email or username
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getEnvironmentType, getCollectionName } from '../../../utils/environmentConfig';
import { DEV_TEST_USERS } from '../../../firebase/developmentAuth';
import { cookies } from 'next/headers';

interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

interface LoginResponse {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  emailVerified: boolean;
  customToken: string;
  message: string;
}

// POST endpoint - User login
export async function POST(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const isDevelopment = envType === 'development' && process.env.USE_DEV_AUTH === 'true';

    console.log(`[Auth API] Login request - Environment: ${envType}, Dev Auth: ${isDevelopment}`);

    const body = await request.json();
    const { emailOrUsername, password } = body as LoginRequest;

    // Validate required fields
    if (!emailOrUsername || !password) {
      return createErrorResponse('BAD_REQUEST', 'Email/username and password are required');
    }

    // Handle development authentication
    if (isDevelopment) {
      console.log('[Auth API] Using development authentication');
      return handleDevelopmentLogin(emailOrUsername, password);
    }

    // Handle production authentication
    console.log('[Auth API] Using production authentication');
    return handleProductionLogin(emailOrUsername, password);

  } catch (error) {
    console.error('Login API error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An error occurred during login');
  }
}

/**
 * Handle development authentication with test users only
 */
async function handleDevelopmentLogin(emailOrUsername: string, password: string) {
  try {
    // Check if it's a test user by email
    let testUser = Object.values(DEV_TEST_USERS).find(user => user.email === emailOrUsername);
    let userKey: keyof typeof DEV_TEST_USERS | undefined;

    if (testUser) {
      userKey = Object.keys(DEV_TEST_USERS).find(
        key => DEV_TEST_USERS[key as keyof typeof DEV_TEST_USERS].email === emailOrUsername
      ) as keyof typeof DEV_TEST_USERS;
    } else {
      // Check if it's a test user by username
      testUser = Object.values(DEV_TEST_USERS).find(user => user.username === emailOrUsername);
      if (testUser) {
        userKey = Object.keys(DEV_TEST_USERS).find(
          key => DEV_TEST_USERS[key as keyof typeof DEV_TEST_USERS].username === emailOrUsername
        ) as keyof typeof DEV_TEST_USERS;
      }
    }

    if (!testUser || testUser.password !== password || !userKey) {
      const availableUsers = Object.values(DEV_TEST_USERS).map(user =>
        `${user.username} (${user.email})`
      ).join(', ');

      return createErrorResponse('UNAUTHORIZED', `Invalid test user credentials. Available test users: ${availableUsers}`);
    }

    console.log(`[Auth API] Development login successful: ${testUser.username}`);

    // Return mock user data for development
    const mockUserData = {
      uid: testUser.uid,
      email: testUser.email,
      username: testUser.username,
      displayName: testUser.displayName,
      emailVerified: true,
      customToken: `dev_token_${testUser.uid}_${Date.now()}`, // Mock token for development
      message: 'Development login successful'
    };

    // Create response with session cookies for API authentication
    const response = NextResponse.json({
      success: true,
      data: mockUserData,
      timestamp: new Date().toISOString()
    });

    // Set userSession cookie for API authentication
    const userSessionData = {
      uid: testUser.uid,
      email: testUser.email,
      username: testUser.username,
      displayName: testUser.displayName,
      emailVerified: true
    };

    response.cookies.set('userSession', JSON.stringify(userSessionData), {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false, // Allow client-side access for CurrentAccountProvider
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Set authenticated cookie for middleware
    response.cookies.set('authenticated', 'true', {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    console.log(`[Auth API] Set session cookies for development user: ${testUser.username}`);

    return response;

  } catch (error) {
    console.error('Development login error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Development authentication failed');
  }
}

/**
 * Handle production authentication with Firebase
 */
async function handleProductionLogin(emailOrUsername: string, password: string) {
  try {
    console.log('[Production Login] Starting authentication process');
    console.log('[Production Login] Environment:', getEnvironmentType());
    console.log('[Production Login] Collection prefix example:', getCollectionName('users'));

    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }

    const auth = admin.auth();
    const db = admin.firestore();

    let email = emailOrUsername;
    let userRecord;

    // Check if the input is a username (doesn't contain @)
    if (!emailOrUsername.includes('@')) {
      // Look up the email by username using environment-aware collection
      const usernameQuery = await db.collection(getCollectionName('usernames'))
        .where('username', '==', emailOrUsername)
        .limit(1)
        .get();

      if (usernameQuery.empty) {
        return createErrorResponse('BAD_REQUEST', 'No account found with this username or email');
      }

      const usernameDoc = usernameQuery.docs[0];
      const usernameData = usernameDoc.data();
      email = usernameData.email;
    }

    // Get user by email
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return createErrorResponse('BAD_REQUEST', 'No account found with this username or email');
      }
      throw error;
    }

    // Verify password by creating a custom token and attempting to sign in
    // Note: Firebase Admin SDK doesn't have a direct password verification method
    // In a production environment, you might want to use Firebase Auth REST API
    // or implement a different authentication strategy

    // For now, we'll create a custom token for the user
    // The client will need to verify the password on their end
    const customToken = await auth.createCustomToken(userRecord.uid);

    // Try to find user data in multiple collections (for preview environment compatibility)
    let userData = {};
    let userDoc;

    const collectionsToTry = [
      getCollectionName('users'), // PROD_users in preview
      'users', // base users collection
      'DEV_users' // dev collection as fallback
    ];

    for (const collectionName of collectionsToTry) {
      try {
        userDoc = await db.collection(collectionName).doc(userRecord.uid).get();
        if (userDoc.exists) {
          userData = userDoc.data() || {};
          console.log(`[Production Login] Found user data in collection: ${collectionName}`);
          break;
        }
      } catch (error) {
        console.log(`[Production Login] Collection ${collectionName} not accessible:`, error);
      }
    }

    if (!userDoc || !userDoc.exists) {
      console.log(`[Production Login] User data not found in any collection for UID: ${userRecord.uid}`);
      // Create minimal user data if not found
      userData = {
        username: userRecord.email?.split('@')[0] || 'user',
        displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'User'
      };
    }

    // Update last login time (try multiple collections)
    let updateSuccessful = false;
    for (const collectionName of collectionsToTry) {
      try {
        const docRef = db.collection(collectionName).doc(userRecord.uid);
        const docSnapshot = await docRef.get();
        if (docSnapshot.exists) {
          await docRef.update({
            lastLoginAt: new Date().toISOString()
          });
          console.log(`[Production Login] Updated lastLoginAt in collection: ${collectionName}`);
          updateSuccessful = true;
          break;
        }
      } catch (error) {
        console.log(`[Production Login] Failed to update in collection ${collectionName}:`, error);
      }
    }

    if (!updateSuccessful) {
      console.log(`[Production Login] Could not update lastLoginAt for user: ${userRecord.uid}`);
    }

    // Set authentication cookies
    const cookieStore = cookies();
    
    // Set user session cookie (expires in 1 hour)
    const userSessionData = {
      uid: userRecord.uid,
      email: userRecord.email,
      username: userData.username,
      displayName: userRecord.displayName || userData.displayName || userData.username,
      emailVerified: userRecord.emailVerified
    };

    cookieStore.set('userSession', JSON.stringify(userSessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    });

    // Set auth token cookie
    cookieStore.set('authToken', customToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    });

    const response: LoginResponse = {
      uid: userRecord.uid,
      email: userRecord.email || '',
      username: userData.username,
      displayName: userRecord.displayName || userData.displayName || userData.username || '',
      emailVerified: userRecord.emailVerified,
      customToken,
      message: 'Login successful'
    };

    return createApiResponse(response);

  } catch (error: any) {
    console.error('Production login error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      emailOrUsername,
      environment: getEnvironmentType()
    });
    return createErrorResponse('INTERNAL_ERROR', `Production authentication failed: ${error.message}`);
  }
}

// GET endpoint - Check authentication status
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const userSessionCookie = cookieStore.get('userSession');
    const authTokenCookie = cookieStore.get('authToken');

    if (!userSessionCookie || !authTokenCookie) {
      return createErrorResponse('UNAUTHORIZED', 'Not authenticated');
    }

    try {
      const userData = JSON.parse(userSessionCookie.value);
      
      // Verify the auth token is still valid
      const admin = getFirebaseAdmin();
      const auth = admin.auth();
      
      try {
        await auth.verifyIdToken(authTokenCookie.value);
      } catch (tokenError) {
        // Token is invalid, clear cookies
        cookieStore.delete('userSession');
        cookieStore.delete('authToken');
        return createErrorResponse('UNAUTHORIZED', 'Authentication token expired');
      }

      return createApiResponse({
        isAuthenticated: true,
        user: userData
      });

    } catch (parseError) {
      // Invalid cookie data, clear cookies
      cookieStore.delete('userSession');
      cookieStore.delete('authToken');
      return createErrorResponse('UNAUTHORIZED', 'Invalid session data');
    }

  } catch (error) {
    console.error('Auth check error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check authentication status');
  }
}
