/**
 * One-time fix: Consolidate testuser accounts
 *
 * The issue:
 * - mP9yRa3nO6gS8wD4xE2hF5jK7m9N has username "testuser2" but owns all the pages
 * - sRPGp5LkRFeKfvL27eo6SCEkW1z2 has username "testuser" but has no data
 *
 * This fix:
 * - Updates mP9yRa3nO6gS8wD4xE2hF5jK7m9N to be "testuser" with test@wewrite.app
 * - Deletes the duplicate sRPGp5LkRFeKfvL27eo6SCEkW1z2
 * - Updates DEV_usernames collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionName } from '../../../utils/environmentConfig';

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82';

async function firestorePatch(collection: string, docId: string, fields: Record<string, any>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`;

  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === 'boolean') {
      firestoreFields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      firestoreFields[key] = { integerValue: String(value) };
    }
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  });

  return response.ok;
}

async function firestoreDelete(collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const response = await fetch(url, { method: 'DELETE' });
  return response.ok;
}

async function firestoreSet(collection: string, docId: string, fields: Record<string, any>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;

  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === 'boolean') {
      firestoreFields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      firestoreFields[key] = { integerValue: String(value) };
    }
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  });

  return response.ok;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }

  const usersCollection = getCollectionName('users');
  const usernamesCollection = getCollectionName('usernames');

  const results: string[] = [];

  try {
    // Step 1: Update the old UID user to be "testuser"
    const oldUid = 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N';
    const newUid = 'sRPGp5LkRFeKfvL27eo6SCEkW1z2';

    const updateOldUser = await firestorePatch(usersCollection, oldUid, {
      username: 'testuser',
      email: 'test@wewrite.app',
      isAdmin: true
    });

    if (updateOldUser) {
      results.push(`✅ Updated ${oldUid} to username=testuser, email=test@wewrite.app`);
    } else {
      results.push(`❌ Failed to update ${oldUid}`);
    }

    // Step 2: Delete the duplicate user
    const deleteNew = await firestoreDelete(usersCollection, newUid);
    if (deleteNew) {
      results.push(`✅ Deleted duplicate user ${newUid}`);
    } else {
      results.push(`⚠️ Could not delete ${newUid} (may not exist)`);
    }

    // Step 3: Update DEV_usernames collection
    const updateUsername = await firestoreSet(usernamesCollection, 'testuser', {
      uid: oldUid,
      username: 'testuser',
      email: 'test@wewrite.app'
    });

    if (updateUsername) {
      results.push(`✅ Updated ${usernamesCollection}/testuser to point to ${oldUid}`);
    } else {
      results.push(`❌ Failed to update usernames collection`);
    }

    // Step 4: Also delete any old testuser2 entry in usernames
    await firestoreDelete(usernamesCollection, 'testuser2');
    results.push(`✅ Cleaned up testuser2 from usernames (if existed)`);

    return NextResponse.json({
      success: true,
      message: 'testuser account consolidated',
      results,
      nextSteps: [
        'Clear your browser cookies or run: fetch("/api/auth/logout", {method: "POST"})',
        'Log back in with test@wewrite.app and DEV_TEST_USER_PASSWORD',
        'Your session will now use UID mP9yRa3nO6gS8wD4xE2hF5jK7m9N with all your pages'
      ]
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results
    }, { status: 500 });
  }
}
