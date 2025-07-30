import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

export async function GET(request, { params }) {
  const startTime = Date.now();

  try {
    // Await params for Next.js 15 compatibility
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get the current user ID for access control
    const userId = await getUserIdFromRequest(request);

    // OPTIMIZATION: Import modules in parallel
    const [
      { getFirebaseAdmin },
      { getCollectionName }
    ] = await Promise.all([
      import('../../../firebase/admin'),
      import('../../../utils/environmentConfig')
    ]);

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

    // OPTIMIZATION: Parallel data fetching
    const pageRef = db.collection(getCollectionName('pages')).doc(id);

    // Start both queries in parallel
    const [pageDoc, rtdbPromise] = await Promise.allSettled([
      pageRef.get(),
      // Pre-start RTDB connection for user data (we'll use it conditionally)
      admin.database()
    ]);

    if (pageDoc.status === 'rejected' || !pageDoc.value.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.value.data();

    // CRITICAL: Check if page is soft-deleted
    if (pageData.deleted === true) {
      if (userId && pageData.userId === userId) {
        console.log(`Owner access granted to deleted page ${id} for user ${userId}`);
      } else {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }
    }

    // OPTIMIZATION: Get author information in parallel with response preparation
    let authorUsername = pageData.username || null; // Use cached username first

    // Only fetch from RTDB if we don't have a username and RTDB is available
    if (!authorUsername && pageData.userId && rtdbPromise.status === 'fulfilled') {
      try {
        const rtdb = rtdbPromise.value;
        const userRef = rtdb.ref(`users/${pageData.userId}`);
        const userSnapshot = await userRef.once('value');

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          authorUsername = userData.username || null;
        }
      } catch (userError) {
        console.error(`Error fetching user data for ${pageData.userId}:`, userError);
        // Keep the fallback username from pageData
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
      // Include location data
      location: pageData.location || null,
      // Include deleted status for owner context
      deleted: pageData.deleted || false
    };

    // Performance logging
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (duration > 1000) {
      console.warn(`Slow page API response for ${id}: ${duration}ms`);
    }

    // OPTIMIZATION: Add performance and caching headers
    const headers = {
      'Content-Type': 'application/json',
      // Cache for 30 seconds for public pages, no cache for private pages
      'Cache-Control': pageData.isPublic ? 'public, max-age=30, s-maxage=60' : 'private, no-cache',
      // Add performance timing header
      'X-Response-Time': `${duration}ms`,
      // Add ETag for better caching
      'ETag': `"${id}-${pageData.lastModified || pageData.createdAt}"`,
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Error fetching page details:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching page details' },
      { status: 500 }
    );
  }
}