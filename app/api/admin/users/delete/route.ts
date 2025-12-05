import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

/**
 * Delete a Firebase Auth user using the Identity Toolkit REST API
 * This avoids the jose dependency issues in Vercel production
 */
async function deleteAuthUserViaRestApi(uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    // We need an access token to call the admin API
    // Since we can't use service account auth easily in REST, we'll try using 
    // the Admin SDK for non-Auth operations and fall back to noting the limitation
    
    // The Identity Toolkit API requires an OAuth2 access token, not an API key
    // For now, we'll document that this needs to be done via Firebase Console
    // or we need to implement proper OAuth2 service account flow
    
    console.log('[ADMIN DELETE] Cannot delete Firebase Auth user via REST API without OAuth2 token');
    console.log('[ADMIN DELETE] User must be deleted manually via Firebase Console or implement OAuth2 flow');
    
    return { 
      success: false, 
      error: 'Firebase Auth user deletion requires manual action in Firebase Console due to API limitations' 
    };
  } catch (error: any) {
    console.error('[ADMIN DELETE] REST API deletion error:', error);
    return { success: false, error: error.message };
  }
}

export async function POST(request: NextRequest) {
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
    const { uid } = body || {};
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    const deletionResults = {
      authUser: { deleted: false, error: null as string | null },
      firestoreUser: { deleted: false, error: null as string | null },
      usernameDoc: { deleted: false, error: null as string | null, username: null as string | null },
    };

    // Get user data from Firestore to find username and email
    let userData: any = null;
    try {
      const userDoc = await db.collection(getCollectionName('users')).doc(uid).get();
      userData = userDoc.exists ? userDoc.data() : null;
    } catch (err: any) {
      console.warn('[ADMIN DELETE] Could not fetch user doc:', err.message);
    }

    // Step 1: Try to delete Firebase Auth user (may fail due to jose)
    try {
      await admin.auth().deleteUser(uid);
      deletionResults.authUser.deleted = true;
      console.log('[ADMIN DELETE] Firebase Auth user deleted successfully');
    } catch (authErr: any) {
      console.warn('[ADMIN DELETE] Firebase Auth deletion failed:', authErr.message);
      deletionResults.authUser.error = authErr.message;
      
      // Note: We cannot use REST API for admin deletion without OAuth2 service account flow
      // The user will need to be deleted via Firebase Console
    }

    // Step 2: Delete Firestore user document
    try {
      await db.collection(getCollectionName('users')).doc(uid).delete();
      deletionResults.firestoreUser.deleted = true;
      console.log('[ADMIN DELETE] Firestore user document deleted');
    } catch (fsErr: any) {
      console.warn('[ADMIN DELETE] Firestore user deletion failed:', fsErr.message);
      deletionResults.firestoreUser.error = fsErr.message;
    }

    // Step 3: Delete username mapping document (CRITICAL - this was missing!)
    if (userData?.username) {
      const username = userData.username.toLowerCase();
      deletionResults.usernameDoc.username = username;
      try {
        await db.collection(getCollectionName('usernames')).doc(username).delete();
        deletionResults.usernameDoc.deleted = true;
        console.log('[ADMIN DELETE] Username document deleted:', username);
      } catch (unErr: any) {
        console.warn('[ADMIN DELETE] Username document deletion failed:', unErr.message);
        deletionResults.usernameDoc.error = unErr.message;
      }
    }

    // Determine overall success
    const authDeleted = deletionResults.authUser.deleted;
    const dataDeleted = deletionResults.firestoreUser.deleted;

    // Build response message
    let message = '';
    let warnings: string[] = [];

    if (authDeleted && dataDeleted) {
      message = 'User fully deleted';
    } else if (dataDeleted && !authDeleted) {
      message = 'User data deleted, but Firebase Auth user still exists';
      warnings.push('Firebase Auth user must be manually deleted via Firebase Console');
      warnings.push('The email address will still be "in use" until the Auth user is deleted');
    } else if (!dataDeleted && authDeleted) {
      message = 'Firebase Auth user deleted, but Firestore data may remain';
    } else {
      message = 'Deletion partially failed - check warnings';
    }

    return NextResponse.json({
      success: authDeleted || dataDeleted,
      message,
      uid,
      email: userData?.email || null,
      username: userData?.username || null,
      deletionResults,
      warnings: warnings.length > 0 ? warnings : undefined,
      manualActionRequired: !authDeleted ? {
        action: 'Delete user from Firebase Console',
        url: `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PID}/authentication/users`,
        reason: 'Firebase Admin Auth operations fail in Vercel due to jose dependency issues'
      } : undefined
    });
  } catch (error: any) {
    console.error('[ADMIN DELETE] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete user' }, { status: 500 });
  }
}
