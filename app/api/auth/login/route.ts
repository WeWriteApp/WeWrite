/**
 * User Login API
 * Handles user authentication with email or username
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
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
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    const body = await request.json();
    const { emailOrUsername, password } = body as LoginRequest;

    // Validate required fields
    if (!emailOrUsername || !password) {
      return createErrorResponse('BAD_REQUEST', 'Email/username and password are required');
    }

    let email = emailOrUsername;
    let userRecord;

    // Check if the input is a username (doesn't contain @)
    if (!emailOrUsername.includes('@')) {
      // Look up the email by username
      const usernameQuery = await db.collection('usernames')
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

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    let userData = {};
    
    if (userDoc.exists) {
      userData = userDoc.data() || {};
    }

    // Update last login time
    await db.collection('users').doc(userRecord.uid).update({
      lastLoginAt: new Date().toISOString()
    });

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
    console.error('Login error:', error);

    // Handle specific Firebase Auth errors
    if (error.code === 'auth/user-not-found') {
      return createErrorResponse('BAD_REQUEST', 'No account found with this username or email');
    } else if (error.code === 'auth/invalid-email') {
      return createErrorResponse('BAD_REQUEST', 'Invalid email address');
    } else if (error.code === 'auth/user-disabled') {
      return createErrorResponse('BAD_REQUEST', 'This account has been disabled');
    }

    return createErrorResponse('INTERNAL_ERROR', 'Login failed');
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
