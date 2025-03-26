import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
let app;
try {
  app = admin.app();
} catch (error) {
  const serviceAccount = require('../../../wewrite-ccd82-firebase-adminsdk-tmduq-90269daa53.json');
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://wewrite-ccd82-default-rtdb.firebaseio.com"
  });
}

// Get database references
const db = admin.firestore();
const rtdb = admin.database();

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
        
        // If no username in RTDB, generate a temporary one based on email or user ID
        if (userData.email) {
          username = userData.email.split('@')[0];
          console.log(`API: Generated username from email: ${username}`);
        } else {
          username = `user_${userId.substring(0, 8)}`;
          console.log(`API: Generated username from user ID: ${username}`);
        }
        
        // Update the RTDB with the generated username
        await rtdb.ref(`users/${userId}`).update({
          username: username
        });
        console.log(`API: Updated RTDB with generated username: ${username}`);
      }
    } else {
      console.log(`API: User not found in RTDB for ID: ${userId}`);
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
