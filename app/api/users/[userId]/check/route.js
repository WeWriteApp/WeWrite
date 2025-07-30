import { NextResponse } from 'next/server';

export async function HEAD(request, { params }) {
  try {
    // Await params for Next.js 15 compatibility
    const { userId } = await params;

    if (!userId) {
      return new NextResponse(null, { status: 400 });
    }

    // Import Firebase Admin modules (server-side)
    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      return new NextResponse(null, { status: 500 });
    }

    // Check if user exists in Realtime Database
    const rtdb = admin.database();
    const userRef = rtdb.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');

    if (userSnapshot.exists()) {
      return new NextResponse(null, { 
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        }
      });
    } else {
      return new NextResponse(null, { 
        status: 404,
        headers: {
          'Cache-Control': 'public, max-age=60', // Cache 404s for 1 minute
        }
      });
    }

  } catch (error) {
    console.error('Error checking user existence:', error);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    // Await params for Next.js 15 compatibility
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Import Firebase Admin modules (server-side)
    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not available' },
        { status: 500 }
      );
    }

    // Get user data from Realtime Database
    const rtdb = admin.database();
    const userRef = rtdb.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');

    if (!userSnapshot.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userSnapshot.val();

    // Return basic user information
    const response = {
      id: userId,
      username: userData.username || 'Anonymous',
      // Don't expose sensitive information
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching user details' },
      { status: 500 }
    );
  }
}
