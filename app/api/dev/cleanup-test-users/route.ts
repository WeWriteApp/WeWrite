import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { DEV_TEST_USERS } from "../../../utils/testUsers";

/**
 * API route to clean up old test users before recreating them
 * This handles the migration from old UID format to Firebase-style UIDs
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({
        error: 'This endpoint is only available in development'
      }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const auth = admin.auth();

    const results = [];

    // Old UIDs that need to be cleaned up
    const oldUIDs = [
      'dev_test_user_1',
      'dev_test_user_2', 
      'dev_test_admin',
      'dev_test_writer',
      'dev_test_reader'
    ];

    // Clean up old Firebase Auth users
    for (const oldUID of oldUIDs) {
      try {
        await auth.deleteUser(oldUID);
        console.log(`✅ Deleted old Firebase Auth user: ${oldUID}`);
        results.push({ uid: oldUID, auth: 'deleted' });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.log(`⚠️ Firebase Auth user not found (already deleted): ${oldUID}`);
          results.push({ uid: oldUID, auth: 'not_found' });
        } else {
          console.error(`❌ Error deleting Firebase Auth user ${oldUID}:`, error);
          results.push({ uid: oldUID, auth: 'error', error: error.message });
        }
      }
    }

    // Clean up old Firestore documents
    for (const oldUID of oldUIDs) {
      try {
        // Delete from users collection
        await db.collection(getCollectionName('users')).doc(oldUID).delete();
        console.log(`✅ Deleted old Firestore user: ${oldUID}`);
        results.find(r => r.uid === oldUID)!.firestore = 'deleted';
      } catch (error: any) {
        console.error(`❌ Error deleting Firestore user ${oldUID}:`, error);
        results.find(r => r.uid === oldUID)!.firestore = 'error';
      }
    }

    // Clean up username mappings for old users
    const oldUsernames = ['testuser1', 'testuser2', 'testadmin', 'testwriter', 'testreader'];
    for (const username of oldUsernames) {
      try {
        await db.collection(getCollectionName('usernames')).doc(username).delete();
        console.log(`✅ Deleted old username mapping: ${username}`);
      } catch (error: any) {
        console.error(`❌ Error deleting username mapping ${username}:`, error);
      }
    }

    // Also clean up any existing users with the new UIDs (in case of partial migration)
    for (const [key, testUser] of Object.entries(DEV_TEST_USERS)) {
      try {
        // Try to delete from Firebase Auth
        try {
          await auth.deleteUser(testUser.uid);
          console.log(`✅ Deleted existing Firebase Auth user: ${testUser.uid}`);
        } catch (error: any) {
          if (error.code !== 'auth/user-not-found') {
            console.error(`❌ Error deleting Firebase Auth user ${testUser.uid}:`, error);
          }
        }

        // Try to delete from Firestore
        await db.collection(getCollectionName('users')).doc(testUser.uid).delete();
        console.log(`✅ Deleted existing Firestore user: ${testUser.uid}`);

        // Try to delete username mapping
        await db.collection(getCollectionName('usernames')).doc(testUser.username).delete();
        console.log(`✅ Deleted existing username mapping: ${testUser.username}`);

      } catch (error: any) {
        console.error(`❌ Error cleaning up existing user ${testUser.username}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test users cleaned up successfully',
      results,
      collections: {
        firestore_users: getCollectionName('users'),
        usernames: getCollectionName('usernames')
      }
    });

  } catch (error) {
    console.error('Error cleaning up test users:', error);
    return NextResponse.json({
      error: 'Failed to clean up test users',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
