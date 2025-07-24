import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

export async function GET(request, { params }) {
  try {
    // Await params for Next.js 15 compatibility
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Only log page fetching when debugging
    if (process.env.PAGE_DEBUG === 'true') {
      console.log(`API: Fetching page details for ID: ${id}`);
    }

    // Get the current user ID for access control
    const userId = await getUserIdFromRequest(request);

    // Import Firebase Admin modules (server-side)
    const { getFirebaseAdmin } = await import('../../../firebase/admin');
    const { getCollectionName } = await import('../../../utils/environmentConfig');

    // Get Firebase Admin instance
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (error) {
      console.error('Error getting Firebase Admin:', error);
      return new Response(JSON.stringify({ error: 'Firebase Admin initialization failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!admin) {
      console.error('Firebase Admin not available');
      return new Response(JSON.stringify({ error: 'Firebase Admin not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const db = admin.firestore();

    // Get the page document from Firestore using Admin SDK
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // CRITICAL: Check if page is soft-deleted
    // Only page owners can access their own deleted pages through the "Recently Deleted Pages" section
    if (pageData.deleted === true) {
      // Allow page owners to access their deleted pages only in specific contexts
      if (userId && pageData.userId === userId) {
        // For now, we'll allow access for owners but this should ideally be restricted
        // to specific contexts like the "Recently Deleted Pages" interface
        console.log(`Owner access granted to deleted page ${id} for user ${userId}`);
      } else {
        // For all other users, deleted pages are not accessible
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }
    }

    // Get author information from Realtime Database using Admin SDK
    let authorUsername = null;
    if (pageData.userId) {
      try {
        const rtdb = admin.database();
        const userRef = rtdb.ref(`users/${pageData.userId}`);
        const userSnapshot = await userRef.once('value');

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          authorUsername = userData.username || null;
        }
      } catch (userError) {
        console.error(`Error fetching user data for ${pageData.userId}:`, userError);
        // Use the username from page data as fallback
        authorUsername = pageData.username || null;
      }
    }

    // Return page details with author information
    const response = {
      id: id,
      title: pageData.title || 'Untitled',
      content: pageData.content || null,
      userId: pageData.userId,
      username: pageData.username || 'Anonymous',
      authorUsername: authorUsername || pageData.username || 'Anonymous',
      isPublic: pageData.isPublic,
      lastModified: pageData.lastModified,
      createdAt: pageData.createdAt,
      groupId: pageData.groupId || null,
      // Include custom date for daily notes
      customDate: pageData.customDate || null,
      // Include deleted status for owner context
      deleted: pageData.deleted || false
    };

    // Only log successful page fetches when debugging
    if (process.env.PAGE_DEBUG === 'true') {
      console.log(`API: Successfully fetched page details for ${id}:`, {
        title: response.title,
        authorUsername: response.authorUsername,
        userId: response.userId,
        deleted: response.deleted
      });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching page details:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching page details' },
      { status: 500 }
    );
  }
}