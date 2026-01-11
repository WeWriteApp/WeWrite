/**
 * Refresh Session API Endpoint
 *
 * Re-queries the user from Firestore and updates the session cookie with the correct data.
 * This is useful when the session has stale data (e.g., old hardcoded UIDs).
 *
 * For development mode only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollectionName, getEnvironmentType } from '../../../utils/environmentConfig';

export async function POST(request: NextRequest) {
  // Only available in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Only available in development' }, { status: 403 });
  }

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('simpleUserSession');

    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'No session found' }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie.value);
    const email = sessionData.email;

    if (!email) {
      return NextResponse.json({ success: false, error: 'No email in session' }, { status: 400 });
    }

    console.log('[Auth] Refreshing session for email:', email);

    // Query Firestore for the actual user by email
    const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';
    const usersCollection = getCollectionName('users');

    const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: usersCollection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: email }
            }
          },
          limit: 1
        }
      })
    });

    const queryResult = await queryResponse.json();

    if (!queryResult[0]?.document) {
      return NextResponse.json({
        success: false,
        error: `User not found in ${usersCollection} collection with email: ${email}`,
        hint: 'You may need to create the account via /api/dev/create-test-account'
      }, { status: 404 });
    }

    const userDoc = queryResult[0].document;
    const fields = userDoc.fields || {};
    const docPath = userDoc.name || '';
    const uid = docPath.split('/').pop() || '';

    const updatedSessionData = {
      uid,
      email: fields.email?.stringValue || email,
      username: fields.username?.stringValue || '',
      emailVerified: fields.emailVerified?.booleanValue || false,
      isAdmin: fields.isAdmin?.booleanValue || false
    };

    // Update the session cookie
    cookieStore.set('simpleUserSession', JSON.stringify(updatedSessionData), {
      httpOnly: true,
      secure: false, // Dev mode
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    console.log('[Auth] Session refreshed successfully:', {
      oldUid: sessionData.uid,
      newUid: uid,
      username: updatedSessionData.username
    });

    return NextResponse.json({
      success: true,
      message: 'Session refreshed',
      user: {
        uid: updatedSessionData.uid,
        email: updatedSessionData.email,
        username: updatedSessionData.username,
        isAdmin: updatedSessionData.isAdmin
      },
      changes: {
        uidChanged: sessionData.uid !== uid,
        oldUid: sessionData.uid,
        newUid: uid
      }
    });

  } catch (error) {
    console.error('[Auth] Error refreshing session:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh session'
    }, { status: 500 });
  }
}
