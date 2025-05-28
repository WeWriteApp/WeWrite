import { NextResponse } from 'next/server';
import { initAdmin, admin } from '../../../firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin lazily
let db;

function initializeFirebase() {
  if (db) return { db }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { db: null };
    }

    // Get Firestore instance
    db = getFirestore();
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    return { db: null };
  }

  return { db };
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
    // Initialize Firebase lazily
    const { db: firestore } = initializeFirebase();

    if (!firestore) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized properly' },
        { status: 500, headers }
      );
    }

    // Update local reference
    db = firestore;

    // Parse request body
    const body = await request.json();
    const { userId, oldUsername, newUsername } = body;

    if (!userId || !newUsername) {
      return NextResponse.json(
        { error: 'User ID and new username are required' },
        { status: 400, headers }
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
