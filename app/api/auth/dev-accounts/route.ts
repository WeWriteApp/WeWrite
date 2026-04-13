/**
 * Dev Accounts API - Lists available dev accounts for quick login
 * Only available in development mode with USE_DEV_AUTH=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { DEV_TEST_USERS } from '../../../utils/testUsers';
import { getCollectionName } from '../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
  if (!useDevAuth) {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 403 });
  }

  // Start with predefined test accounts
  const accounts: {
    uid: string;
    email: string;
    username: string;
    displayName: string;
    isAdmin: boolean;
    source: 'predefined' | 'registered';
  }[] = Object.values(DEV_TEST_USERS).map((user) => ({
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    source: 'predefined' as const,
  }));

  // Fetch dynamically registered dev users from Firestore
  try {
    const admin = getFirebaseAdmin();
    if (admin) {
      const db = admin.firestore();
      const usersSnap = await db
        .collection(getCollectionName('users'))
        .limit(50)
        .get();

      const predefinedUids = new Set(accounts.map((a) => a.uid));

      for (const doc of usersSnap.docs) {
        if (predefinedUids.has(doc.id)) continue;
        const data = doc.data();
        if (data.deleted) continue;

        accounts.push({
          uid: doc.id,
          email: data.email || '',
          username: data.username || '',
          displayName: data.displayName || data.username || '',
          isAdmin: data.isAdmin === true,
          source: 'registered',
        });
      }
    }
  } catch (error) {
    console.warn('[Dev Accounts] Error fetching registered users:', error);
  }

  return NextResponse.json({ success: true, accounts });
}
