import { NextResponse } from 'next/server';

// Server-side only imports
let admin;
let db;
let rtdb;

// Only initialize Firebase Admin on the server
if (typeof window === 'undefined') {
  try {
    // Dynamic import to prevent client-side bundling
    admin = require('firebase-admin');
    
    // Check if app is already initialized
    try {
      admin.app();
      db = admin.firestore();
      rtdb = admin.database();
    } catch (error) {
      // Initialize a new app
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://wewrite-ccd82-default-rtdb.firebaseio.com"
      });
      
      db = admin.firestore();
      rtdb = admin.database();
    }
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
