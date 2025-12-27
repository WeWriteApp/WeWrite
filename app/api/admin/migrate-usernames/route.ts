import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

/**
 * Migration API to fix username documents missing email fields
 * This fixes the username login issue where users can't log in with usernames
 * that were created without email fields.
 */

export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Simple auth check - only allow in development or with admin key
    const { adminKey } = await request.json();
    
    if (process.env.NODE_ENV === 'production' && adminKey !== process.env.ADMIN_MIGRATION_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const firestore = admin.firestore();
    const usernamesCollection = getCollectionName('usernames');
    const usersCollection = getCollectionName('users');

    console.log('[Migration] Starting username email migration...');
    console.log('[Migration] Collections:', { usernamesCollection, usersCollection });

    // Get all username documents
    const usernamesSnapshot = await firestore.collection(usernamesCollection).get();
    
    let totalDocs = 0;
    let missingEmail = 0;
    let fixed = 0;
    let errors = 0;

    const results = [];

    for (const usernameDoc of usernamesSnapshot.docs) {
      totalDocs++;
      const usernameData = usernameDoc.data();
      const username = usernameDoc.id;

      // Check if email field is missing
      if (!usernameData.email) {
        missingEmail++;
        console.log(`[Migration] Username '${username}' missing email field`);

        try {
          // Get the user's email from the users collection
          const uid = usernameData.uid || usernameData.userId; // Handle both field names
          
          if (!uid) {
            console.error(`[Migration] Username '${username}' has no uid/userId field`);
            errors++;
            results.push({ username, status: 'error', reason: 'No uid/userId field' });
            continue;
          }

          const userDoc = await firestore.collection(usersCollection).doc(uid).get();
          
          if (!userDoc.exists) {
            console.error(`[Migration] User document not found for uid: ${uid}`);
            errors++;
            results.push({ username, status: 'error', reason: 'User document not found' });
            continue;
          }

          const userData = userDoc.data();
          const email = userData?.email;

          if (!email) {
            console.error(`[Migration] User ${uid} has no email field`);
            errors++;
            results.push({ username, status: 'error', reason: 'User has no email' });
            continue;
          }

          // Update the username document with the email
          await firestore.collection(usernamesCollection).doc(username).update({
            email: email,
            uid: uid, // Standardize to 'uid' field name
            migratedAt: new Date().toISOString()
          });

          console.log(`[Migration] Fixed username '${username}' with email: ${email}`);
          fixed++;
          results.push({ username, status: 'fixed', email });

        } catch (error) {
          console.error(`[Migration] Error fixing username '${username}':`, error);
          errors++;
          results.push({ username, status: 'error', reason: error.message });
        }
      } else {
        results.push({ username, status: 'already_has_email', email: usernameData.email });
      }
    }

    const summary = {
      totalDocs,
      missingEmail,
      fixed,
      errors,
      alreadyHadEmail: totalDocs - missingEmail
    };

    console.log('[Migration] Migration complete:', summary);

    return NextResponse.json({
      success: true,
      summary,
      results: results.slice(0, 50) // Limit results to first 50 for response size
    });

  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return NextResponse.json({ 
      error: 'Migration failed',
      details: error.message
    }, { status: 500 });
    }
  }); // End withAdminContext
}
