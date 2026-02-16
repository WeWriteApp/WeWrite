/**
 * Verify Email Token API
 * 
 * POST /api/auth/verify-email-token
 * 
 * Validates a verification token and marks the user's email as verified.
 * Updates both Firestore and Firebase Auth emailVerified status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionName } from '../../../utils/environmentConfig';

// Firebase REST API config
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const FIRESTORE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

interface VerifyTokenRequest {
  token: string;
}

interface TokenData {
  userId: string;
  email: string;
  expiresAt: Date;
  used: boolean;
}

/**
 * Get and validate token from Firestore
 */
async function getAndValidateToken(token: string): Promise<{
  valid: boolean;
  data?: TokenData;
  error?: string;
}> {
  try {
    const { getAdminFirestore } = await import('../../../firebase/firebaseAdmin');
    const adminDb = getAdminFirestore();
    const collectionName = getCollectionName('email_verification_tokens');

    const tokenDoc = await adminDb.collection(collectionName).doc(token).get();

    if (!tokenDoc.exists) {
      return { valid: false, error: 'Invalid verification token' };
    }

    const data = tokenDoc.data()!;
    
    // Check if already used
    if (data.used) {
      return { valid: false, error: 'TOKEN_ALREADY_USED' };
    }

    // Check if expired
    const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
    if (expiresAt < new Date()) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }

    return {
      valid: true,
      data: {
        userId: data.userId,
        email: data.email,
        expiresAt,
        used: data.used,
      },
    };
  } catch (error) {
    console.error('[Verify Token] Error fetching token:', error);
    return { valid: false, error: 'Failed to validate token' };
  }
}

/**
 * Mark token as used
 */
async function markTokenAsUsed(token: string): Promise<boolean> {
  try {
    const { getAdminFirestore } = await import('../../../firebase/firebaseAdmin');
    const adminDb = getAdminFirestore();
    const collectionName = getCollectionName('email_verification_tokens');

    await adminDb.collection(collectionName).doc(token).update({
      used: true,
      usedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('[Verify Token] Error marking token as used:', error);
    return false;
  }
}

/**
 * Update user's email verified status in Firestore
 */
async function updateUserEmailVerified(userId: string): Promise<boolean> {
  try {
    const { getAdminFirestore } = await import('../../../firebase/firebaseAdmin');
    const adminDb = getAdminFirestore();
    const collectionName = getCollectionName('users');

    await adminDb.collection(collectionName).doc(userId).update({
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('[Verify Token] Error updating user:', error);
    return false;
  }
}

/**
 * Update Firebase Auth emailVerified status via Admin SDK
 * Note: This requires firebase-admin Auth which may have issues in some environments
 */
async function updateFirebaseAuthEmailVerified(userId: string): Promise<boolean> {
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const adminAuth = getAuth();

    await adminAuth.updateUser(userId, {
      emailVerified: true,
    });

    return true;
  } catch (error) {
    console.error('[Verify Token] Error updating Firebase Auth:', error);
    // Non-fatal - we can continue even if this fails
    // The Firestore emailVerified field is the source of truth
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as VerifyTokenRequest;

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Validate the token
    const validation = await getAndValidateToken(token);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.error === 'TOKEN_ALREADY_USED' ? 200 : 400 }
      );
    }

    const { userId, email } = validation.data!;

    // Mark token as used
    await markTokenAsUsed(token);

    // Update user's email verified status in Firestore (primary source of truth)
    const userUpdated = await updateUserEmailVerified(userId);
    if (!userUpdated) {
      return NextResponse.json(
        { error: 'Failed to update user verification status' },
        { status: 500 }
      );
    }

    // Try to update Firebase Auth as well (best effort)
    await updateFirebaseAuthEmailVerified(userId);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      email,
    });
  } catch (error) {
    console.error('[Verify Token] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
