/**
 * Update Email API
 *
 * POST /api/users/update-email
 *
 * Updates a user's email address in Firebase Auth and Firestore,
 * then sends a verification email to the new address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { sendVerificationEmail } from '../../../services/emailService';
import { randomUUID } from 'crypto';

interface UpdateEmailRequest {
  newEmail: string;
  userId: string;
  idToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newEmail, userId, idToken } = body as UpdateEmailRequest;

    // Validate required fields
    if (!newEmail || !userId) {
      return NextResponse.json(
        { error: 'New email and userId are required' },
        { status: 400 }
      );
    }

    if (!idToken) {
      return NextResponse.json(
        { error: 'Authentication token is required' },
        { status: 401 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get Firebase Admin
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[Update Email] Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify the ID token to ensure the request is from the authenticated user
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('[Update Email] Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Ensure the user is updating their own email
    if (decodedToken.uid !== userId) {
      return NextResponse.json(
        { error: 'You can only update your own email' },
        { status: 403 }
      );
    }

    // Check if the new email is already in use
    try {
      await admin.auth().getUserByEmail(newEmail);
      // If we get here, the email is already in use
      return NextResponse.json(
        { error: 'This email is already in use by another account' },
        { status: 409 }
      );
    } catch (error: any) {
      // Error code 'auth/user-not-found' means the email is available
      if (error.code !== 'auth/user-not-found') {
        console.error('[Update Email] Error checking email:', error);
        return NextResponse.json(
          { error: 'Failed to verify email availability' },
          { status: 500 }
        );
      }
    }

    // Update email in Firebase Auth
    try {
      await admin.auth().updateUser(userId, {
        email: newEmail,
        emailVerified: false, // Reset verification status
      });
    } catch (error: any) {
      console.error('[Update Email] Failed to update Firebase Auth:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update email' },
        { status: 500 }
      );
    }

    // Update email in Firestore user document
    const db = admin.firestore();
    const usersCollection = getCollectionName('users');

    try {
      await db.collection(usersCollection).doc(userId).update({
        email: newEmail,
        emailVerified: false,
        lastModified: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Update Email] Failed to update Firestore:', error);
      // Don't fail the whole request - Auth update already succeeded
    }

    // Generate verification token and send verification email
    const verificationToken = randomUUID();
    const envType = getEnvironmentType();
    const baseUrl = envType === 'production'
      ? 'https://getwewrite.app'
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationLink = `${baseUrl}/auth/verify-email?token=${verificationToken}`;

    // Store the verification token
    const tokenCollection = getCollectionName('email_verification_tokens');
    try {
      await db.collection(tokenCollection).doc(verificationToken).set({
        userId,
        email: newEmail,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        used: false,
      });
    } catch (error) {
      console.error('[Update Email] Failed to store verification token:', error);
    }

    // Get user's username for the email
    let username: string | undefined;
    try {
      const userDoc = await db.collection(usersCollection).doc(userId).get();
      if (userDoc.exists) {
        username = userDoc.data()?.username;
      }
    } catch (error) {
      console.error('[Update Email] Failed to get username:', error);
    }

    // Send verification email
    try {
      await sendVerificationEmail({
        to: newEmail,
        verificationLink,
        username,
        userId,
      });
    } catch (error) {
      console.error('[Update Email] Failed to send verification email:', error);
      // Don't fail - email update succeeded, user can resend later
    }

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully. Please check your new email for a verification link.',
    });

  } catch (error) {
    console.error('[Update Email] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
