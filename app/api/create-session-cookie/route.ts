import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

/**
 * POST /api/create-session-cookie
 * 
 * Creates a Firebase session cookie from an ID token
 * This fixes the issuer claim mismatch by properly creating session cookies
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    // Verify the ID token first
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Create session cookie that expires in 7 days
    const expiresIn = 60 * 60 * 24 * 7 * 1000; // 7 days in milliseconds
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    // Set the session cookie in the response
    const response = NextResponse.json({ 
      success: true,
      uid: decodedToken.uid 
    });

    // Set the session cookie with proper security flags
    response.cookies.set('session', sessionCookie, {
      maxAge: expiresIn / 1000, // maxAge is in seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Error creating session cookie:', error);
    return NextResponse.json(
      { error: 'Failed to create session cookie', message: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
