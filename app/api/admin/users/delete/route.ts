import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { deleteUserByUid } from '../../../../lib/firebase-rest';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com';

// Resend Audience IDs
const GENERAL_AUDIENCE_ID = '493da2d9-7034-4bb0-99de-1dcfac3b424d';
const DEV_TEST_AUDIENCE_ID = 'e475ed52-8398-442a-9d4e-80c5e97374d2';

/**
 * Delete a contact from a Resend audience by email
 */
async function deleteResendContact(email: string, audienceId: string): Promise<{ deleted: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { deleted: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    // First, list contacts to find the contact ID
    const listResponse = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    });

    if (!listResponse.ok) {
      return { deleted: false, error: `Failed to list contacts: ${listResponse.statusText}` };
    }

    const contacts = await listResponse.json();
    const contact = contacts.data?.find((c: any) => c.email.toLowerCase() === email.toLowerCase());

    if (!contact) {
      // Contact doesn't exist in this audience, that's fine
      return { deleted: true };
    }

    // Delete the contact
    const deleteResponse = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts/${contact.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    });

    if (!deleteResponse.ok) {
      return { deleted: false, error: `Failed to delete contact: ${deleteResponse.statusText}` };
    }

    return { deleted: true };
  } catch (error: any) {
    return { deleted: false, error: error.message };
  }
}

/**
 * Delete a user's contacts from all Resend audiences
 */
async function deleteFromAllResendAudiences(email: string): Promise<{ deleted: boolean; errors: string[] }> {
  const errors: string[] = [];
  let anyDeleted = false;

  // Try to delete from both audiences
  const audiences = [
    { id: GENERAL_AUDIENCE_ID, name: 'general' },
    { id: DEV_TEST_AUDIENCE_ID, name: 'dev-test' },
  ];

  for (const audience of audiences) {
    const result = await deleteResendContact(email, audience.id);
    if (result.deleted) {
      anyDeleted = true;
      console.log(`[ADMIN DELETE] Removed from Resend ${audience.name} audience`);
    } else if (result.error) {
      errors.push(`${audience.name}: ${result.error}`);
      console.warn(`[ADMIN DELETE] Failed to remove from Resend ${audience.name}:`, result.error);
    }
  }

  return { deleted: anyDeleted, errors };
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
      resendContacts: { deleted: false, error: null as string | null },
    };

    // Get user data from Firestore to find username and email
    let userData: any = null;
    try {
      const userDoc = await db.collection(getCollectionName('users')).doc(uid).get();
      userData = userDoc.exists ? userDoc.data() : null;
    } catch (err: any) {
      console.warn('[ADMIN DELETE] Could not fetch user doc:', err.message);
    }

    // Step 1: Try to delete Firebase Auth user
    // First try Admin SDK, then fall back to REST API if jose fails
    try {
      await admin.auth().deleteUser(uid);
      deletionResults.authUser.deleted = true;
      console.log('[ADMIN DELETE] Firebase Auth user deleted via Admin SDK');
    } catch (authErr: any) {
      console.warn('[ADMIN DELETE] Admin SDK deletion failed, trying REST API:', authErr.message);
      
      // Fallback to REST API which doesn't have jose dependency issues
      const restResult = await deleteUserByUid(uid);
      if (restResult.success) {
        deletionResults.authUser.deleted = true;
        console.log('[ADMIN DELETE] Firebase Auth user deleted via REST API');
      } else {
        deletionResults.authUser.error = `Admin SDK: ${authErr.message}; REST API: ${restResult.error}`;
        console.error('[ADMIN DELETE] Both deletion methods failed');
      }
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

    // Step 4: Delete from Resend audiences (email marketing)
    if (userData?.email) {
      try {
        const resendResult = await deleteFromAllResendAudiences(userData.email);
        deletionResults.resendContacts.deleted = resendResult.deleted;
        if (resendResult.errors.length > 0) {
          deletionResults.resendContacts.error = resendResult.errors.join('; ');
        }
        console.log('[ADMIN DELETE] Resend contacts cleanup complete');
      } catch (resendErr: any) {
        console.warn('[ADMIN DELETE] Resend deletion failed:', resendErr.message);
        deletionResults.resendContacts.error = resendErr.message;
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
      warnings.push('Firebase Auth deletion failed - see deletionResults.authUser.error for details');
      warnings.push('The email address will still be "in use" until the Auth user is deleted');
      warnings.push('You may need to manually delete via Firebase Console');
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
    });
  } catch (error: any) {
    console.error('[ADMIN DELETE] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete user' }, { status: 500 });
  }
}
