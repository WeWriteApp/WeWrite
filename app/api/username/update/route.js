import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/adminConfig';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

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
    const { userId, newUsername } = body;
    
    if (!userId || !newUsername) {
      return NextResponse.json(
        { error: 'User ID and new username are required' }, 
        { status: 400, headers }
      );
    }
    
    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (error) {
      console.error("Error initializing Firebase Admin:", error);
      return NextResponse.json(
        { error: 'Firebase Admin not initialized properly', details: error.message }, 
        { status: 500, headers }
      );
    }
    
    // Update displayName in Firebase Auth
    try {
      await admin.auth().updateUser(userId, {
        displayName: newUsername
      });
      console.log("DisplayName updated in Firebase Auth");
      
      return NextResponse.json({ 
        success: true, 
        message: 'Username updated in Firebase Auth'
      }, { headers });
    } catch (authError) {
      console.error("Error updating displayName in Auth:", authError);
      return NextResponse.json(
        { error: 'Error updating Firebase Auth', details: authError.message }, 
        { status: 500, headers }
      );
    }
  } catch (error) {
    console.error('Error in username update API:', error);
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
