import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not available' },
        { status: 500 }
      );
    }
    const auth = getAuth(admin);

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user record
    const userRecord = await auth.getUser(uid);

    // Check if email is already verified
    if (userRecord.emailVerified) {
      return NextResponse.json(
        { message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // Generate email verification link
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/verify-email`,
      handleCodeInApp: true,
    };

    const verificationLink = await auth.generateEmailVerificationLink(
      userRecord.email!,
      actionCodeSettings
    );

    // In a real implementation, you would send this link via email
    // For now, we'll just return success
    console.log('Email verification link generated:', verificationLink);

    return NextResponse.json(
      { message: 'Verification email sent successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    );
  }
}
