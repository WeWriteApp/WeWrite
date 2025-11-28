import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { isAdminServer } from '../../../admin-auth-helper';

const IDENTITY_TOOLKIT_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 503 });
    }

    const actorId = await getUserIdFromRequest(request);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorRecord = await admin.auth().getUser(actorId);
    const actorEmail = actorRecord.email;
    const devBypass = process.env.NODE_ENV === 'development';
    if (!actorEmail || (!isAdminServer(actorEmail) && !devBypass)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { uid, email } = body || {};
    let targetEmail = email;

    if (!targetEmail && uid) {
      try {
        const userRec = await admin.auth().getUser(uid);
        targetEmail = userRec.email || undefined;
      } catch (err) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    if (!targetEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Attempt to send Firebase password reset email via REST (Identity Toolkit)
    let sent = false;
    let resetLink: string | null = null;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    if (apiKey) {
      try {
        const resp = await fetch(`${IDENTITY_TOOLKIT_ENDPOINT}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: targetEmail
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          sent = true;
          resetLink = data.emailLink || null;
        } else {
          console.warn('[ADMIN] reset-password REST error', data);
        }
      } catch (err) {
        console.warn('[ADMIN] reset-password REST fetch failed', err);
      }
    }

    // Always generate a link as backup so admin can send manually
    try {
      resetLink = await admin.auth().generatePasswordResetLink(targetEmail);
    } catch (linkErr) {
      console.warn('[ADMIN] generatePasswordResetLink failed', linkErr);
    }

    return NextResponse.json({
      success: true,
      message: sent ? 'Password reset email sent' : 'Reset link generated',
      email: targetEmail,
      resetLink
    });
  } catch (error: any) {
    console.error('[ADMIN] reset-password error', error);
    return NextResponse.json({ error: error?.message || 'Failed to send reset link' }, { status: 500 });
  }
}
