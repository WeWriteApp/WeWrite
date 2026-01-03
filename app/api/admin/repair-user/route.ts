/**
 * Admin API: Repair User
 *
 * Diagnoses and repairs corrupted user accounts by:
 * 1. Checking if user exists in Firebase Auth
 * 2. Checking if user document exists in Firestore
 * 3. Creating/restoring the Firestore document if missing
 * 4. Optionally setting/restoring the username
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface DiagnosticResult {
  userId: string;
  firebaseAuthExists: boolean;
  firestoreDocExists: boolean;
  authEmail?: string;
  authCreatedAt?: string;
  firestoreData?: any;
  issues: string[];
  pages?: number;
}

// GET endpoint - Diagnose a user account
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const findBroken = searchParams.get('findBroken') === 'true';

    // Mode 1: Find all broken users
    if (findBroken) {
      return await findBrokenUsers(admin);
    }

    // Mode 2: Diagnose specific user
    if (!userId && !username) {
      return NextResponse.json({
        error: 'Either userId, username, or findBroken=true parameter is required'
      }, { status: 400 });
    }

    const result = await diagnoseUser(admin, userId, username);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Repair User] Error:', error);
    return NextResponse.json({
      error: 'Failed to diagnose user',
      details: error?.message
    }, { status: 500 });
  }
}

// POST endpoint - Repair a user account
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const { userId, username, email } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = admin.firestore();
    const usersCollection = getCollectionName('users');

    // First, diagnose to understand current state
    const diagnosis = await diagnoseUser(admin, userId, null);

    if (!diagnosis.firebaseAuthExists) {
      return NextResponse.json({
        error: 'User does not exist in Firebase Auth - cannot repair',
        diagnosis
      }, { status: 400 });
    }

    // If Firestore doc doesn't exist, create it
    const userDocRef = db.collection(usersCollection).doc(userId);
    const userDoc = await userDocRef.get();

    const now = new Date().toISOString();

    if (!userDoc.exists) {
      // Create new document with required fields
      const newUserData: any = {
        email: email || diagnosis.authEmail || '',
        username: username || `user_${userId.slice(0, 8)}`,
        createdAt: diagnosis.authCreatedAt || now,
        lastModified: now,
        repairedAt: now,
        repairedBy: 'admin-repair-user-api',
        totalPages: 0,
        publicPages: 0,
      };

      await userDocRef.set(newUserData);

      console.log(`[Repair User] Created Firestore document for user ${userId} with username ${newUserData.username}`);

      return NextResponse.json({
        success: true,
        action: 'created',
        message: `Created Firestore document for user ${userId}`,
        userData: newUserData
      });
    } else {
      // Document exists but might need updates
      const existingData = userDoc.data();
      const updates: any = {
        lastModified: now,
        repairedAt: now,
      };

      // Only update username if provided and different
      if (username && username !== existingData?.username) {
        updates.username = username;
      }

      // Ensure required fields exist
      if (!existingData?.email && (email || diagnosis.authEmail)) {
        updates.email = email || diagnosis.authEmail;
      }

      await userDocRef.update(updates);

      console.log(`[Repair User] Updated Firestore document for user ${userId}`);

      // Propagate username to pages if username was changed
      if (updates.username) {
        const pagesCollection = getCollectionName('pages');
        const pagesSnap = await db.collection(pagesCollection)
          .where('userId', '==', userId)
          .get();

        if (!pagesSnap.empty) {
          const batch = db.batch();
          pagesSnap.forEach((doc) => {
            batch.update(doc.ref, { username: updates.username });
          });
          await batch.commit();
          console.log(`[Repair User] Updated username on ${pagesSnap.size} pages`);
        }
      }

      return NextResponse.json({
        success: true,
        action: 'updated',
        message: `Updated Firestore document for user ${userId}`,
        updates
      });
    }

  } catch (error: any) {
    console.error('[Repair User] Error:', error);
    return NextResponse.json({
      error: 'Failed to repair user',
      details: error?.message
    }, { status: 500 });
  }
}

async function diagnoseUser(
  admin: any,
  userId: string | null,
  username: string | null
): Promise<DiagnosticResult> {
  const db = admin.firestore();
  const auth = admin.auth();
  const usersCollection = getCollectionName('users');
  const pagesCollection = getCollectionName('pages');

  const issues: string[] = [];
  let resolvedUserId = userId;
  let authUser = null;
  let firestoreData = null;

  // If we have userId, check Firebase Auth
  if (userId) {
    try {
      authUser = await auth.getUser(userId);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        issues.push('User not found in Firebase Auth');
      } else {
        issues.push(`Firebase Auth error: ${e.message}`);
      }
    }
  }

  // Check Firestore by userId
  if (resolvedUserId) {
    const userDoc = await db.collection(usersCollection).doc(resolvedUserId).get();
    if (userDoc.exists) {
      firestoreData = userDoc.data();
    } else {
      issues.push('User document missing in Firestore');
    }
  }

  // If username provided but no userId, try to find by username
  if (!resolvedUserId && username) {
    const usernameQuery = await db.collection(usersCollection)
      .where('username', '==', username)
      .get();

    if (!usernameQuery.empty) {
      const userDoc = usernameQuery.docs[0];
      resolvedUserId = userDoc.id;
      firestoreData = userDoc.data();

      // Now check Firebase Auth with the found userId
      try {
        authUser = await auth.getUser(resolvedUserId);
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          issues.push('User not found in Firebase Auth');
        }
      }
    } else {
      issues.push(`No user found with username: ${username}`);
    }
  }

  // Count pages for this user
  let pageCount = 0;
  if (resolvedUserId) {
    try {
      const pagesQuery = db.collection(pagesCollection).where('userId', '==', resolvedUserId);
      const pagesSnap = await pagesQuery.count().get();
      pageCount = pagesSnap.data()?.count ?? 0;
    } catch (e) {
      // Fallback if count() isn't available
      const pagesSnap = await db.collection(pagesCollection)
        .where('userId', '==', resolvedUserId)
        .select()
        .get();
      pageCount = pagesSnap.size;
    }
  }

  // Check for mismatches
  if (authUser && firestoreData) {
    if (authUser.email !== firestoreData.email) {
      issues.push(`Email mismatch: Auth=${authUser.email}, Firestore=${firestoreData.email}`);
    }
  }

  return {
    userId: resolvedUserId || userId || 'unknown',
    firebaseAuthExists: !!authUser,
    firestoreDocExists: !!firestoreData,
    authEmail: authUser?.email,
    authCreatedAt: authUser?.metadata?.creationTime,
    firestoreData: firestoreData ? {
      username: firestoreData.username,
      email: firestoreData.email,
      createdAt: firestoreData.createdAt,
      lastModified: firestoreData.lastModified,
    } : undefined,
    issues,
    pages: pageCount,
  };
}

async function findBrokenUsers(admin: any): Promise<NextResponse> {
  const db = admin.firestore();
  const auth = admin.auth();
  const usersCollection = getCollectionName('users');

  const brokenUsers: any[] = [];
  let checkedCount = 0;

  try {
    // Get all users from Firebase Auth (paginated)
    let nextPageToken: string | undefined;

    do {
      const listResult = await auth.listUsers(100, nextPageToken);

      for (const authUser of listResult.users) {
        checkedCount++;

        // Check if Firestore doc exists
        const userDoc = await db.collection(usersCollection).doc(authUser.uid).get();

        if (!userDoc.exists) {
          brokenUsers.push({
            userId: authUser.uid,
            email: authUser.email,
            authCreatedAt: authUser.metadata.creationTime,
            issue: 'Missing Firestore document',
          });
        }
      }

      nextPageToken = listResult.pageToken;

      // Limit to first 500 users to avoid timeout
      if (checkedCount >= 500) {
        break;
      }
    } while (nextPageToken);

    return NextResponse.json({
      success: true,
      checkedCount,
      brokenCount: brokenUsers.length,
      brokenUsers,
      note: checkedCount >= 500 ? 'Stopped at 500 users to avoid timeout' : undefined
    });

  } catch (error: any) {
    console.error('[Find Broken Users] Error:', error);
    return NextResponse.json({
      error: 'Failed to find broken users',
      details: error?.message,
      checkedCount,
      brokenUsers
    }, { status: 500 });
  }
}
