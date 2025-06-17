import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    console.log(`API: Fetching page details for ID: ${id}`);

    // Get the current user ID for access control
    const userId = await getUserIdFromRequest(request);

    // Import Firebase modules
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../../firebase/database');
    const { ref, get } = await import('firebase/database');
    const { rtdb } = await import('../../../firebase/rtdb');

    // Get the page document from Firestore
    const pageRef = doc(db, 'pages', id);
    const pageDoc = await getDoc(pageRef);

    if (!pageDoc.exists()) {
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

    // Get author information from Realtime Database
    let authorUsername = null;
    if (pageData.userId) {
      try {
        const userRef = ref(rtdb, `users/${pageData.userId}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          authorUsername = userData.username || userData.displayName || null;
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
      userId: pageData.userId,
      username: pageData.username || 'Anonymous',
      authorUsername: authorUsername || pageData.username || 'Anonymous',
      isPublic: pageData.isPublic,
      lastModified: pageData.lastModified,
      createdAt: pageData.createdAt,
      groupId: pageData.groupId || null,
      // Include deleted status for owner context
      deleted: pageData.deleted || false
    };

    console.log(`API: Successfully fetched page details for ${id}:`, {
      title: response.title,
      authorUsername: response.authorUsername,
      userId: response.userId,
      deleted: response.deleted
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching page details:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching page details' },
      { status: 500 }
    );
  }
}