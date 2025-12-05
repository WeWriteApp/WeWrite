/**
 * User Registration API (Legacy Endpoint)
 * 
 * This endpoint uses Firebase REST API instead of firebase-admin SDK
 * to avoid the jwks-rsa/jose dependency chain that fails in Vercel serverless.
 * 
 * The new flow is:
 * 1. Create user via Firebase Auth REST API
 * 2. Create Firestore documents via Firestore REST API
 */

import { NextRequest } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { syncUserToResend } from '../../../services/resendContactsService';

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

// Firebase project configuration
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// POST endpoint - Register new user using REST API (no firebase-admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username } = body as RegisterRequest;

    // Validate required fields
    if (!email || !password || !username) {
      return createErrorResponse('BAD_REQUEST', 'Email, password, and username are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse('BAD_REQUEST', 'Invalid email format');
    }

    // Validate password strength
    if (password.length < 6) {
      return createErrorResponse('BAD_REQUEST', 'Password must be at least 6 characters long');
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return createErrorResponse('BAD_REQUEST', 'Username must be 3-20 characters and contain only letters, numbers, hyphens, and underscores');
    }

    console.log('[Register] Creating user via Firebase REST API...');

    // Step 1: Create user via Firebase Auth REST API
    const signUpResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const signUpData = await signUpResponse.json();

    if (!signUpResponse.ok) {
      console.error('[Register] Firebase Auth error:', signUpData);
      
      // Map Firebase error codes to user-friendly messages
      const errorCode = signUpData.error?.message || 'UNKNOWN_ERROR';
      
      if (errorCode === 'EMAIL_EXISTS') {
        return createErrorResponse('BAD_REQUEST', 'This email address is already registered. Please try logging in instead.');
      } else if (errorCode === 'WEAK_PASSWORD') {
        return createErrorResponse('BAD_REQUEST', 'Password is too weak. Please use at least 6 characters.');
      } else if (errorCode === 'INVALID_EMAIL') {
        return createErrorResponse('BAD_REQUEST', 'Invalid email address');
      } else if (errorCode === 'OPERATION_NOT_ALLOWED') {
        return createErrorResponse('BAD_REQUEST', 'Email/password accounts are not enabled');
      } else if (errorCode.includes('TOO_MANY_ATTEMPTS')) {
        return createErrorResponse('BAD_REQUEST', 'Too many attempts. Please wait and try again.');
      }
      
      return createErrorResponse('INTERNAL_ERROR', 'Failed to create account. Please try again.', {
        errorCode,
        errorId: Date.now().toString(36),
      });
    }

    const { localId: uid, idToken } = signUpData;
    console.log('[Register] User created in Firebase Auth:', uid);

    // Step 2: Check if username is already taken using Firestore REST API
    const usernameCheckUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${username.toLowerCase()}`;
    
    const usernameCheckResponse = await fetch(usernameCheckUrl, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    if (usernameCheckResponse.ok) {
      // Username exists - we need to delete the auth user we just created
      console.log('[Register] Username already taken, cleaning up auth user');
      
      // Delete the auth user via REST API
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      
      return createErrorResponse('BAD_REQUEST', 'This username is already taken. Please choose a different username.');
    }

    // Step 3: Create user document in Firestore
    const timestamp = new Date().toISOString();
    const userDocUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?documentId=${uid}`;

    const userDocResponse = await fetch(userDocUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          email: { stringValue: email },
          username: { stringValue: username },
          emailVerified: { booleanValue: false },
          isAnonymous: { booleanValue: false },
          createdAt: { stringValue: timestamp },
          lastLoginAt: { stringValue: timestamp },
          pageCount: { integerValue: '0' },
          followerCount: { integerValue: '0' },
          viewCount: { integerValue: '0' },
        }
      }),
    });

    if (!userDocResponse.ok) {
      const errorText = await userDocResponse.text();
      console.error('[Register] Failed to create user document:', errorText);
      // Don't fail completely - user exists in auth, they can try again
    } else {
      console.log('[Register] User document created');
    }

    // Step 4: Create username mapping document
    const usernameDocUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames?documentId=${username.toLowerCase()}`;

    const usernameDocResponse = await fetch(usernameDocUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          username: { stringValue: username },
          email: { stringValue: email },
          createdAt: { stringValue: timestamp },
        }
      }),
    });

    if (!usernameDocResponse.ok) {
      const errorText = await usernameDocResponse.text();
      console.error('[Register] Failed to create username document:', errorText);
      // Don't fail completely - user can still log in
    } else {
      console.log('[Register] Username document created');
    }

    // Sync user to Resend for broadcast emails (async, non-blocking)
    syncUserToResend({ email, username }).catch(err => {
      console.warn('[Register] Failed to sync user to Resend:', err.message);
    });

    console.log('[Register] Registration complete for:', email);

    return createApiResponse({
      uid,
      email,
      username,
      emailVerified: false,
      message: 'Account created successfully. Please check your email for verification instructions.'
    }, null, 201);

  } catch (error: any) {
    console.error('[Register] Registration error:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    });

    return createErrorResponse('INTERNAL_ERROR', error?.message || 'Failed to create account', {
      errorCode: error?.code || 'unknown',
      errorId: Date.now().toString(36),
    });
  }
}
