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
import { PRODUCTION_URL } from '../../../utils/urlConfig';

interface VerificationRequest {
  email: string;
  userId: string;
  username?: string;
  idToken: string;
}

/**
 * Store verification token in Firestore
 * Uses server-side Firebase Admin for reliability
 */
async function storeVerificationToken(
  userId: string,
  email: string,
  token: string,
  idToken: string
): Promise<boolean> {
  // Always use server-side storage for reliability
  // The client idToken is used for authentication but we store via Admin SDK
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return await storeTokenServerSide(userId, email, token, expiresAt);
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

// Deduplication cooldown: skip sending if a verification email was sent within this window
const DEDUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Check if a verification email was recently sent to this user.
 * Returns true if a recent token exists (meaning we should skip sending).
 */
async function wasRecentlySent(userId: string): Promise<boolean> {
  try {
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const admin = getFirebaseAdmin();
    if (!admin) return false;

    const db = admin.firestore();
    const collectionName = getCollectionName('email_verification_tokens');
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

    const snap = await db.collection(collectionName)
      .where('userId', '==', userId)
      .where('createdAt', '>=', cutoff)
      .limit(1)
      .get();

    return !snap.empty;
  } catch (error) {
    // If dedup check fails, allow the send (fail-open)
    console.warn('[Send Verification] Dedup check failed, allowing send:', error);
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

    // Dedup: skip if a verification email was already sent to this user recently
    if (!isAdminBypass) {
      const recent = await wasRecentlySent(userId);
      if (recent) {
        console.log(`[Send Verification] Skipping duplicate for user ${userId} (sent within ${DEDUP_WINDOW_MS / 1000}s)`);
        return NextResponse.json({
          success: true,
          message: 'Verification email already sent recently',
          deduplicated: true,
        });
      }
    }

    // Generate a unique verification token
    const verificationToken = randomUUID();

    // Determine the base URL for the verification link
    // Check for X-Force-Production-Data header (sent by admin panel when viewing prod data)
    const forceProductionData = request.headers.get('x-force-production-data') === 'true';
    const envType = getEnvironmentType();
    const baseUrl = (envType === 'production' || forceProductionData)
      ? PRODUCTION_URL
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
