/**
 * User Registration Completion API
 * Creates user documents in Firestore after client-side Firebase Auth registration
 * 
 * This endpoint does NOT use firebase-admin SDK to avoid the jwks-rsa/jose dependency
 * chain that causes issues in Vercel serverless. Instead, it uses the Firebase REST API.
 */

import { NextRequest } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { syncUserToResend } from '../../../services/resendContactsService';

interface RegisterUserRequest {
  uid: string;
  email: string;
  username: string;
  idToken: string; // Firebase ID token for verification
}

// Firebase project configuration
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Helper to make Firestore REST API calls
async function firestoreRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  idToken: string,
  body?: any
): Promise<any> {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const url = `${baseUrl}${path}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firestore API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Helper to verify Firebase ID token using REST API
async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      console.error('[Register User] Token verification failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      return {
        uid: data.users[0].localId,
        email: data.users[0].email,
      };
    }
    return null;
  } catch (error) {
    console.error('[Register User] Token verification error:', error);
    return null;
  }
}

// Check if username is taken using Firestore REST API
async function isUsernameTaken(username: string, idToken: string): Promise<boolean> {
  try {
    // Query the usernames collection
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'usernames' }],
          where: {
            fieldFilter: {
              field: { fieldPath: '__name__' },
              op: 'EQUAL',
              value: { referenceValue: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${username.toLowerCase()}` }
            }
          },
          limit: 1
        }
      }),
    });

    if (!response.ok) {
      // If query fails, try a direct document get
      const docResponse = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${username.toLowerCase()}`,
        {
          headers: { 'Authorization': `Bearer ${idToken}` }
        }
      );
      return docResponse.ok;
    }

    const results = await response.json();
    // Check if any documents were returned
    return results.some((r: any) => r.document);
  } catch (error) {
    console.error('[Register User] Username check error:', error);
    // Assume not taken if we can't check - let Firestore rules handle it
    return false;
  }
}

// POST endpoint - Complete user registration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email, username, idToken } = body as RegisterUserRequest;

    // Validate required fields
    if (!uid || !email || !username || !idToken) {
      return createErrorResponse('BAD_REQUEST', 'Missing required fields');
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return createErrorResponse('BAD_REQUEST', 'Username must be 3-20 characters and contain only letters, numbers, hyphens, and underscores');
    }

    // Verify the ID token
    const tokenUser = await verifyIdToken(idToken);
    if (!tokenUser || tokenUser.uid !== uid) {
      return createErrorResponse('UNAUTHORIZED', 'Invalid authentication token');
    }

    // Check if username is already taken
    const taken = await isUsernameTaken(username, idToken);
    if (taken) {
      return createErrorResponse('BAD_REQUEST', 'Username is already taken');
    }

    // Create user document using Firestore REST API
    const userDocUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?documentId=${uid}`;
    const timestamp = new Date().toISOString();

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
      console.error('[Register User] Failed to create user document:', errorText);
      throw new Error(`Failed to create user document: ${errorText}`);
    }

    // Create username mapping document
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
      console.error('[Register User] Failed to create username document:', errorText);
      // Don't fail if username doc fails - user doc is created
    }

    // Sync user to Resend for broadcast emails (async, non-blocking)
    syncUserToResend({ email, username }).catch(err => {
      console.warn('[Register User] Failed to sync user to Resend:', err.message);
    });

    console.log('[Register User] User registered successfully:', { uid, email, username });

    return createApiResponse({
      uid,
      email,
      username,
      emailVerified: false,
      message: 'Account created successfully. Please check your email for verification instructions.'
    }, null, 201);

  } catch (error: any) {
    console.error('[Register User] Registration error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    });

    return createErrorResponse('INTERNAL_ERROR', error?.message || 'Failed to complete registration', {
      errorCode: error?.code || 'unknown',
      errorId: Date.now().toString(36),
    });
  }
}
