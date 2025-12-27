import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { withAdminContext } from '../../../../utils/adminRequestContext';

/**
 * Firebase Identity Toolkit REST API for password reset
 * This sends the password reset email via Firebase's built-in email system
 * See: https://firebase.google.com/docs/reference/rest/auth#section-send-password-reset-email
 */
const IDENTITY_TOOLKIT_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';

export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) {
        return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
      }
      const db = admin.firestore();

      // Verify admin access using session cookie
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
      }

      const body = await request.json();
      const { uid, email } = body || {};
      let targetEmail = email;

      // Get email from Firestore if not provided (avoids firebase-admin auth/jose issues)
      if (!targetEmail && uid) {
        try {
          const userDoc = await db.collection(getCollectionName('users')).doc(uid).get();
          targetEmail = userDoc.data()?.email || undefined;
        } catch (err) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
      }

      if (!targetEmail) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }

      // Send Firebase password reset email via REST API (Identity Toolkit)
      // This automatically sends an email to the user via Firebase's email system
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          error: 'Firebase API key not configured',
          details: 'NEXT_PUBLIC_FIREBASE_API_KEY is required'
        }, { status: 500 });
      }

      console.log(`[ADMIN] Sending password reset email to: ${targetEmail}`);

      const resp = await fetch(`${IDENTITY_TOOLKIT_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: targetEmail
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        console.error('[ADMIN] reset-password REST error:', data);
        // Handle specific Firebase errors
        const errorMessage = data.error?.message || 'Failed to send reset email';
        if (errorMessage.includes('EMAIL_NOT_FOUND')) {
          return NextResponse.json({
            error: 'No Firebase Auth account found with this email',
            details: 'The user may not have a Firebase Auth account'
          }, { status: 404 });
        }
        return NextResponse.json({
          error: errorMessage,
          details: JSON.stringify(data.error)
        }, { status: 400 });
      }

      console.log(`[ADMIN] Password reset email sent successfully to: ${targetEmail}`);

      return NextResponse.json({
        success: true,
        message: 'Password reset email sent via Firebase',
        email: targetEmail,
        // Note: Firebase REST API doesn't return the reset link, it just sends the email
        note: 'User will receive an email from noreply@YOUR-PROJECT.firebaseapp.com'
      });
    } catch (error: any) {
      console.error('[ADMIN] reset-password error:', error);
      return NextResponse.json({
        error: error?.message || 'Failed to send reset email',
        details: error?.stack?.split('\n').slice(0, 3).join('\n')
      }, { status: 500 });
    }
  }); // End withAdminContext
}
