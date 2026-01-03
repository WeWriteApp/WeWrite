/**
 * Repair User Script
 *
 * Fixes corrupted user accounts by creating/restoring their Firestore document.
 *
 * Usage:
 *   npx tsx scripts/repair-user.ts diagnose MUAZpZrVTLZjuHxCRQrqTxykmvg1
 *   npx tsx scripts/repair-user.ts repair MUAZpZrVTLZjuHxCRQrqTxykmvg1 mudfish
 *   npx tsx scripts/repair-user.ts find-broken
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
function initializeFirebaseAdmin(): typeof admin {
  if (admin.apps.length > 0) {
    return admin;
  }

  const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
  if (!base64Json) {
    throw new Error('Missing GOOGLE_CLOUD_KEY_JSON environment variable');
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PID;
  if (!projectId) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_PID environment variable');
  }

  const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(decodedJson);

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id || projectId,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n')
    }),
  });

  console.log(`Firebase Admin initialized for project: ${serviceAccount.project_id || projectId}`);
  return admin;
}

async function diagnoseUser(userId: string) {
  const firebaseAdmin = initializeFirebaseAdmin();
  const db = firebaseAdmin.firestore();
  const auth = firebaseAdmin.auth();

  console.log(`\n=== Diagnosing user: ${userId} ===\n`);

  // Check Firebase Auth
  let authUser = null;
  try {
    authUser = await auth.getUser(userId);
    console.log('✅ Firebase Auth: User EXISTS');
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Created: ${authUser.metadata.creationTime}`);
    console.log(`   Last Sign In: ${authUser.metadata.lastSignInTime}`);
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      console.log('❌ Firebase Auth: User NOT FOUND');
    } else {
      console.log(`❌ Firebase Auth: Error - ${e.message}`);
    }
  }

  // Check Firestore (production collection is 'users')
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    console.log('\n✅ Firestore: User document EXISTS');
    console.log(`   Username: ${data?.username}`);
    console.log(`   Email: ${data?.email}`);
    console.log(`   Created: ${data?.createdAt}`);
  } else {
    console.log('\n❌ Firestore: User document MISSING');
    console.log('   This is the problem! The user exists in Auth but not in Firestore.');
  }

  // Check pages owned by this user
  const pagesQuery = await db.collection('pages').where('userId', '==', userId).get();
  console.log(`\n📄 Pages owned by this user: ${pagesQuery.size}`);

  if (pagesQuery.size > 0) {
    console.log('   Sample pages:');
    pagesQuery.docs.slice(0, 3).forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: "${data.title}" (username: ${data.username})`);
    });
  }

  return { authUser, userDoc: userDoc.exists ? userDoc.data() : null, pageCount: pagesQuery.size };
}

async function repairUser(userId: string, username: string) {
  const firebaseAdmin = initializeFirebaseAdmin();
  const db = firebaseAdmin.firestore();
  const auth = firebaseAdmin.auth();

  console.log(`\n=== Repairing user: ${userId} with username: ${username} ===\n`);

  // First, get the auth user to verify they exist
  let authUser;
  try {
    authUser = await auth.getUser(userId);
    console.log(`✅ Found user in Firebase Auth: ${authUser.email}`);
  } catch (e: any) {
    console.log(`❌ User not found in Firebase Auth. Cannot repair.`);
    process.exit(1);
  }

  // Check if Firestore doc exists
  const userDocRef = db.collection('users').doc(userId);
  const userDoc = await userDocRef.get();
  const now = new Date().toISOString();

  if (!userDoc.exists) {
    // Create new document
    const newUserData = {
      email: authUser.email || '',
      username: username,
      createdAt: authUser.metadata.creationTime || now,
      lastModified: now,
      repairedAt: now,
      repairedBy: 'repair-user-script',
      totalPages: 0,
      publicPages: 0,
    };

    await userDocRef.set(newUserData);
    console.log(`✅ Created new Firestore document with username: ${username}`);
  } else {
    // Update existing document
    await userDocRef.update({
      username: username,
      lastModified: now,
      repairedAt: now,
    });
    console.log(`✅ Updated existing Firestore document with username: ${username}`);
  }

  // Propagate username to all pages
  const pagesQuery = await db.collection('pages').where('userId', '==', userId).get();
  if (!pagesQuery.empty) {
    console.log(`\n📄 Updating username on ${pagesQuery.size} pages...`);

    const batch = db.batch();
    pagesQuery.docs.forEach(doc => {
      batch.update(doc.ref, { username: username });
    });
    await batch.commit();
    console.log(`✅ Updated username on all ${pagesQuery.size} pages`);
  }

  console.log(`\n✅ User ${userId} has been repaired with username: ${username}`);
}

async function findBrokenUsers() {
  const firebaseAdmin = initializeFirebaseAdmin();
  const db = firebaseAdmin.firestore();
  const auth = firebaseAdmin.auth();

  console.log('\n=== Finding broken users (Auth exists, Firestore missing) ===\n');

  const brokenUsers: Array<{ uid: string; email: string; created: string }> = [];
  let checkedCount = 0;
  let nextPageToken: string | undefined;

  do {
    const listResult = await auth.listUsers(100, nextPageToken);

    for (const authUser of listResult.users) {
      checkedCount++;

      // Check if Firestore doc exists
      const userDoc = await db.collection('users').doc(authUser.uid).get();

      if (!userDoc.exists) {
        brokenUsers.push({
          uid: authUser.uid,
          email: authUser.email || 'no-email',
          created: authUser.metadata.creationTime || 'unknown',
        });
        console.log(`❌ BROKEN: ${authUser.uid} (${authUser.email})`);
      }

      if (checkedCount % 50 === 0) {
        console.log(`   Checked ${checkedCount} users...`);
      }
    }

    nextPageToken = listResult.pageToken;

    // Limit to avoid timeout
    if (checkedCount >= 500) {
      console.log('\n⚠️  Stopped at 500 users to avoid timeout');
      break;
    }
  } while (nextPageToken);

  console.log(`\n=== Summary ===`);
  console.log(`Checked: ${checkedCount} users`);
  console.log(`Broken: ${brokenUsers.length} users`);

  if (brokenUsers.length > 0) {
    console.log('\nBroken users:');
    brokenUsers.forEach(u => {
      console.log(`  ${u.uid} | ${u.email} | ${u.created}`);
    });
  }

  return brokenUsers;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'diagnose' && args[1]) {
    await diagnoseUser(args[1]);
  } else if (command === 'repair' && args[1] && args[2]) {
    await repairUser(args[1], args[2]);
  } else if (command === 'find-broken') {
    await findBrokenUsers();
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/repair-user.ts diagnose <userId>');
    console.log('  npx tsx scripts/repair-user.ts repair <userId> <username>');
    console.log('  npx tsx scripts/repair-user.ts find-broken');
    process.exit(1);
  }
}

main().catch(console.error);
