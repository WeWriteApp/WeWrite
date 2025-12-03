/**
 * User Registration API
 * Handles user registration with email verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

// POST endpoint - Register new user
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

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

    // Check if username is already taken
    const usernameQuery = await db.collection(getCollectionName('users'))
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!usernameQuery.empty) {
      return createErrorResponse('BAD_REQUEST', 'Username is already taken');
    }

    // Check if email is already registered
    try {
      await auth.getUserByEmail(email);
      return createErrorResponse('BAD_REQUEST', 'An account with this email already exists');
    } catch (error: any) {
      // User doesn't exist, which is what we want
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create the user account
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false
    });

    // Create user document in Firestore
    const userData = {
      email,
      username,
      emailVerified: false,
      isAnonymous: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      pageCount: 0,
      followerCount: 0,
      viewCount: 0
    };

    await db.collection(getCollectionName('users')).doc(userRecord.uid).set(userData);

    // Create username mapping for login by username
    await db.collection(getCollectionName('usernames')).doc(username.toLowerCase()).set({
      uid: userRecord.uid,
      username,
      email,
      createdAt: new Date().toISOString()
    });

    // Note: Email verification is sent client-side after registration
    // The client signs in and calls sendEmailVerification() from Firebase client SDK
    // This ensures the email is sent through Firebase's built-in email delivery system
    console.log('User registered successfully. Client will send verification email.');

    return createApiResponse({
      uid: userRecord.uid,
      email,
      username,
      emailVerified: false,
      message: 'Account created successfully. Please check your email for verification instructions.'
    }, null, 201);

  } catch (error: any) {
    console.error('Registration error:', error);

    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return createErrorResponse('BAD_REQUEST', 'An account with this email already exists');
    } else if (error.code === 'auth/invalid-email') {
      return createErrorResponse('BAD_REQUEST', 'Invalid email address');
    } else if (error.code === 'auth/weak-password') {
      return createErrorResponse('BAD_REQUEST', 'Password is too weak');
    }

    return createErrorResponse('INTERNAL_ERROR', 'Failed to create account');
  }
}
