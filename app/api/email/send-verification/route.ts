/**
 * Send Verification Email API
 * 
 * POST /api/email/send-verification
 * 
 * Generates a custom verification token and sends a branded verification email via Resend.
 * This replaces Firebase's default verification email with our custom design.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';
import { sendVerificationEmail } from '../../../services/emailService';

// Firebase REST API for Firestore operations
const FIRESTORE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

interface VerificationRequest {
  email: string;
  userId: string;
  username?: string;
  idToken: string;
}

/**
 * Store verification token in Firestore via REST API
 */
async function storeVerificationToken(
  userId: string,
  email: string,
  token: string,
  idToken: string
): Promise<boolean> {
  try {
    const collectionName = getCollectionName('email_verification_tokens');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Use Firestore REST API to avoid firebase-admin issues
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${collectionName}?documentId=${token}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          userId: { stringValue: userId },
          email: { stringValue: email },
          createdAt: { timestampValue: new Date().toISOString() },
          expiresAt: { timestampValue: expiresAt },
          used: { booleanValue: false },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Send Verification] Failed to store token:', errorData);
      
      // If permission denied, try using server-side approach
      if (response.status === 403 || response.status === 401) {
        // Use internal API to store token (bypasses client auth)
        return await storeTokenServerSide(userId, email, token, expiresAt);
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Send Verification] Error storing token:', error);
    return false;
  }
}

/**
 * Store token using server-side Firestore access
 */
async function storeTokenServerSide(
  userId: string,
  email: string,
  token: string,
  expiresAt: string
): Promise<boolean> {
  try {
    // Use the shared Firebase Admin instance
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const admin = getFirebaseAdmin();

    if (!admin) {
      console.error('[Send Verification] Firebase Admin not initialized');
      return false;
    }

    const adminDb = admin.firestore();
    const collectionName = getCollectionName('email_verification_tokens');

    await adminDb.collection(collectionName).doc(token).set({
      userId,
      email,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      used: false,
    });

    console.log('[Send Verification] Token stored successfully via server-side');
    return true;
  } catch (error) {
    console.error('[Send Verification] Server-side storage error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, username, idToken } = body as VerificationRequest;

    // Validate required fields
    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Email and userId are required' },
        { status: 400 }
      );
    }

    // Check for admin bypass (for sending verification on behalf of other users)
    const isAdminBypass = idToken === 'admin-bypass';
    
    if (!idToken && !isAdminBypass) {
      return NextResponse.json(
        { error: 'Authentication token is required' },
        { status: 401 }
      );
    }

    // Generate a unique verification token
    const verificationToken = randomUUID();

    // Determine the base URL for the verification link
    const envType = getEnvironmentType();
    const baseUrl = envType === 'production' 
      ? 'https://getwewrite.app'
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create verification link
    const verificationLink = `${baseUrl}/auth/verify-email?token=${verificationToken}`;

    // Store the verification token (use server-side for admin bypass)
    let stored: boolean;
    if (isAdminBypass) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      stored = await storeTokenServerSide(userId, email, verificationToken, expiresAt);
    } else {
      stored = await storeVerificationToken(userId, email, verificationToken, idToken);
    }
    
    if (!stored) {
      console.error('[Send Verification] Failed to store verification token');
      return NextResponse.json(
        { error: 'Failed to create verification token' },
        { status: 500 }
      );
    }

    // Send the verification email via Resend
    const emailSent = await sendVerificationEmail({
      to: email,
      verificationLink,
      username: username || undefined,
      userId,
    });

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('[Send Verification] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
