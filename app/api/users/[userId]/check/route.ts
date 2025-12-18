import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

interface UserResponse {
  id: string;
  username: string;
}

export async function HEAD(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { userId } = await params;

    if (!userId) {
      return new NextResponse(null, { status: 400 });
    }

    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return new NextResponse(null, { status: 500 });
    }

    const rtdb = admin.database();
    const userRef = rtdb.ref(`users/${userId}`);
    const userSnapshot = await userRef.once('value');

    if (userSnapshot.exists()) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      });
    } else {
      return new NextResponse(null, {
        status: 404,
        headers: {
          'Cache-Control': 'public, max-age=60',
        }
      });
    }

  } catch (error) {
    console.error('Error checking user existence:', error);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not available' },
        { status: 500 }
      );
    }

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

    const response: UserResponse = {
      id: userId,
      username: userData.username || 'Anonymous',
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300',
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
