import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/adminConfig';

// Server-side only imports
let admin;
let db;
let rtdb;

// Only initialize Firebase Admin on the server
if (typeof window === 'undefined') {
  try {
    // Use the unified Firebase Admin initialization
    admin = getFirebaseAdmin();
    db = admin.firestore();
    rtdb = admin.database();
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
  }
}

export async function GET(request) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  try {
    // Get userId from query parameter
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400, headers }
      );
    }

    console.log(`API: Fetching username for user ID: ${userId}`);

    // Check if we have admin initialized
    if (!admin || !rtdb || !db) {
      // Return a fallback response when Firebase Admin is not available
      return NextResponse.json(
        {
          username: `user_${userId.substring(0, 8)}`,
          history: [],
          error: 'Firebase Admin not initialized properly. Using fallback username.'
        },
        { headers }
      );
    }

    // Get user data from RTDB
    const userSnapshot = await rtdb.ref(`users/${userId}`).get();

    let username = 'Unknown';
    let userData = null;

    // Check RTDB for username
    if (userSnapshot.exists()) {
      userData = userSnapshot.val();
      console.log(`API: User data found in RTDB: ${JSON.stringify(userData).substring(0, 100)}...`);

      if (userData.username) {
        username = userData.username;
        console.log(`API: Username found in RTDB: ${username}`);
      } else {
        console.log(`API: No username field in RTDB for user ID: ${userId}`);

        // Try to get username from Firestore first
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const firestoreData = userDoc.data();
            if (firestoreData.username) {
              username = firestoreData.username;
              console.log(`API: Username found in Firestore: ${username}`);

              // Update RTDB with the Firestore username for consistency
              await rtdb.ref(`users/${userId}`).update({
                username: username
              });
              console.log(`API: Updated RTDB with Firestore username: ${username}`);

              // Skip the fallback logic
              return;
            }
          }
        } catch (firestoreErr) {
          console.error(`API: Error checking Firestore for username:`, firestoreErr);
        }

        // If no username in Firestore or RTDB, use a temporary ID-based username
        // We no longer use email as fallback to avoid inconsistency
        username = `user_${userId.substring(0, 8)}`;
        console.log(`API: Generated username from user ID: ${username}`);

        // Don't update RTDB with generated username anymore
        // This allows the user to set their own username later
      }
    } else {
      console.log(`API: User not found in RTDB for ID: ${userId}`);
      username = `user_${userId.substring(0, 8)}`;
    }

    // Get username history from Firestore
    let history = [];
    try {
      const historySnapshot = await db.collection('usernameHistory')
        .where('userId', '==', userId)
        .orderBy('changedAt', 'desc')
        .get();

      if (!historySnapshot.empty) {
        history = historySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            oldUsername: data.oldUsername,
            newUsername: data.newUsername,
            changedAt: data.changedAt ? data.changedAt.toDate().toISOString() : new Date().toISOString()
          };
        });
        console.log(`API: Found ${history.length} username history entries`);
      } else {
        console.log(`API: No username history found for user ID: ${userId}`);
      }
    } catch (firestoreErr) {
      console.error(`API: Error fetching history: ${firestoreErr.message}`);
      // Don't fail the whole request, just log the error
    }

    return NextResponse.json({
      username,
      history,
      debug: {
        userDataKeys: userData ? Object.keys(userData) : [],
        hasUsername: userData ? !!userData.username : false,
        rtdbExists: !!userSnapshot.exists()
      }
    }, { headers });
  } catch (error) {
    console.error('API Error fetching username:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers }
    );
  }
}
