/**
 * User Registration API
 * Handles user registration with email verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

// POST endpoint - Register new user
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const auth = admin.auth();
    const db = admin.firestore();

    const body = await request.json();
    const { email, password, username, displayName } = body as RegisterRequest;

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
    const usernameQuery = await db.collection('users')
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
      displayName: displayName || username,
      emailVerified: false
    });

    // Create user document in Firestore
    const userData = {
      email,
      username,
      displayName: displayName || username,
      emailVerified: false,
      isAnonymous: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      pageCount: 0,
      followerCount: 0,
      viewCount: 0
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    // Create username mapping for login by username
    await db.collection('usernames').doc(username.toLowerCase()).set({
      uid: userRecord.uid,
      username,
      email,
      createdAt: new Date().toISOString()
    });

    // Send email verification
    try {
      const emailVerificationLink = await auth.generateEmailVerificationLink(email);
      
      // In a real application, you would send this via your email service
      // For now, we'll just log it and return it in the response for development
      console.log('Email verification link:', emailVerificationLink);
      
      // TODO: Integrate with email service to send verification email
      // await sendVerificationEmail(email, emailVerificationLink);
      
    } catch (emailError) {
      console.error('Failed to generate email verification link:', emailError);
      // Don't fail the registration if email verification fails
    }

    return createApiResponse({
      uid: userRecord.uid,
      email,
      username,
      displayName: userData.displayName,
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
