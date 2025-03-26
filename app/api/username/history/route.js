import { NextResponse } from 'next/server';

// Server-side only imports
let admin;
let db;

// Only initialize Firebase Admin on the server
if (typeof window === 'undefined') {
  try {
    // Dynamic import to prevent client-side bundling
    admin = require('firebase-admin');
    
    // Check if app is already initialized
    try {
      admin.app();
      db = admin.firestore();
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
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
  }
}

export async function POST(request) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { userId, oldUsername, newUsername } = body;
    
    if (!userId || !newUsername) {
      return NextResponse.json(
        { error: 'User ID and new username are required' }, 
        { status: 400, headers }
      );
    }
    
    // Check if we have admin initialized
    if (!admin || !db) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized properly' }, 
        { status: 500, headers }
      );
    }
    
    // Add record to Firestore
    const historyRef = db.collection('usernameHistory');
    const docRef = await historyRef.add({
      userId,
      oldUsername: oldUsername || 'Unknown',
      newUsername,
      changedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return NextResponse.json({ 
      success: true, 
      id: docRef.id 
    }, { headers });
    
  } catch (error) {
    console.error('Error in username history API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
