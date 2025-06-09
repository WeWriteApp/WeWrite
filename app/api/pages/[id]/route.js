import { NextResponse } from 'next/server';

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
      groupId: pageData.groupId || null
    };

    console.log(`API: Successfully fetched page details for ${id}:`, {
      title: response.title,
      authorUsername: response.authorUsername,
      userId: response.userId
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
