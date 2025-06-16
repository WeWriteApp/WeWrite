import { NextResponse } from 'next/server';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '10', 10);
    const userId = searchParams.get('userId'); // For access control
    const includePrivate = searchParams.get('includePrivate') === 'true'; // Privacy toggle
    const excludeOwnPages = searchParams.get('excludeOwnPages') === 'true'; // "Not mine" filter

    console.log('Random pages API: Requested limit:', limitCount, 'User ID:', userId, 'Include private:', includePrivate, 'Exclude own pages:', excludeOwnPages);

    // Import Firebase modules
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database.ts');
    const { ref, get } = await import('firebase/database');
    const { rtdb } = await import('../../firebase/rtdb.ts');

    if (!db) {
      console.log('Firebase database not available - returning empty array');
      return NextResponse.json({
        randomPages: [],
        error: "Database not available"
      }, { headers });
    }

    // Get a larger pool of public pages to randomize from
    // We'll fetch more than needed and then randomize client-side for better distribution
    const poolSize = Math.max(limitCount * 5, 50); // Get at least 50 pages to choose from

    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(poolSize)
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    if (pagesSnapshot.empty) {
      console.log('No public pages found');
      return NextResponse.json({
        randomPages: [],
        message: "No public pages available"
      }, { headers });
    }

    // Convert to array and add page data
    let pages = [];
    pagesSnapshot.forEach((doc) => {
      const pageData = doc.data();
      pages.push({
        id: doc.id,
        title: pageData.title || 'Untitled',
        userId: pageData.userId,
        username: pageData.username || 'Anonymous',
        lastModified: pageData.lastModified,
        createdAt: pageData.createdAt,
        isPublic: pageData.isPublic,
        groupId: pageData.groupId || null
      });
    });

    // If user is authenticated and privacy toggle is enabled, include their private pages
    if (userId && includePrivate) {
      try {
        // Fetch user's own private pages
        const userPagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', false),
          orderBy('lastModified', 'desc'),
          limit(20) // Add some private pages to the mix
        );

        const userPagesSnapshot = await getDocs(userPagesQuery);
        userPagesSnapshot.forEach((doc) => {
          const pageData = doc.data();
          pages.push({
            id: doc.id,
            title: pageData.title || 'Untitled',
            userId: pageData.userId,
            username: pageData.username || 'Anonymous',
            lastModified: pageData.lastModified,
            createdAt: pageData.createdAt,
            isPublic: pageData.isPublic,
            groupId: pageData.groupId || null
          });
        });

        // TODO: Also fetch pages from private groups the user is a member of
        // This would require querying the user's group memberships first
        // For now, we only include the user's own private pages

      } catch (userPagesError) {
        console.error('Error fetching user private pages:', userPagesError);
        // Continue without user pages
      }
    }

    // Fetch additional data (groups and usernames) for pages
    const pagesWithCompleteInfo = await Promise.all(
      pages.map(async (page) => {
        let updatedPage = { ...page };

        // Fetch group information if page belongs to a group
        if (page.groupId) {
          try {
            const groupRef = ref(rtdb, `groups/${page.groupId}`);
            const groupSnapshot = await get(groupRef);

            if (groupSnapshot.exists()) {
              const groupData = groupSnapshot.val();
              updatedPage.groupName = groupData.name || 'Unknown Group';
              updatedPage.groupIsPublic = groupData.isPublic || false;
            }
          } catch (groupError) {
            console.error(`Error fetching group ${page.groupId}:`, groupError);
          }
        }

        // Fetch username from users collection if missing or showing as Anonymous
        if (!page.username || page.username === 'Anonymous') {
          try {
            const userRef = ref(rtdb, `users/${page.userId}`);
            const userSnapshot = await get(userRef);

            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              updatedPage.username = userData.username || userData.displayName || 'Anonymous';
            }
          } catch (userError) {
            console.error(`Error fetching username for user ${page.userId}:`, userError);
          }
        }

        return updatedPage;
      })
    );

    // Apply strict access control filtering with detailed logging
    let privatePageCount = 0;
    let userPrivatePageCount = 0;
    let publicPageCount = 0;

    const accessiblePages = pagesWithCompleteInfo.filter(page => {
      // CRITICAL: Private pages should ONLY be visible to their owners and only when includePrivate is true
      if (!page.isPublic) {
        privatePageCount++;
        const isOwner = userId && page.userId === userId;
        if (isOwner) {
          userPrivatePageCount++;
        }
        // Only include private pages if the user owns them AND has enabled the privacy toggle
        return isOwner && includePrivate;
      }

      // Apply "Not mine" filter - exclude pages authored by current user
      if (excludeOwnPages && userId && page.userId === userId) {
        return false;
      }

      // For public pages, apply additional group-based filtering
      if (page.groupId) {
        // Public pages in public groups are accessible
        // Public pages in private groups are only accessible to group members (for now, exclude them)
        const isAccessible = page.groupIsPublic;
        if (isAccessible) publicPageCount++;
        return isAccessible;
      }

      // Public pages not in groups are always accessible
      publicPageCount++;
      return true;
    });

    console.log(`Random pages API: Access control summary:`, {
      totalPages: pagesWithCompleteInfo.length,
      privatePages: privatePageCount,
      userPrivatePages: userPrivatePageCount,
      publicPages: publicPageCount,
      accessiblePages: accessiblePages.length,
      userId: userId ? `${userId.substring(0, 8)}...` : 'null'
    });

    // Randomize the array using Fisher-Yates shuffle
    const shuffledPages = [...accessiblePages];
    for (let i = shuffledPages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPages[i], shuffledPages[j]] = [shuffledPages[j], shuffledPages[i]];
    }

    // Take only the requested number of pages
    const randomPages = shuffledPages.slice(0, limitCount);

    console.log(`Random pages API: Returning ${randomPages.length} pages from ${accessiblePages.length} accessible pages`);

    return NextResponse.json({
      randomPages,
      totalAvailable: accessiblePages.length
    }, { headers });

  } catch (error) {
    console.error('Error in random pages API:', error);
    return NextResponse.json({
      randomPages: [],
      error: 'Failed to fetch random pages',
      details: error.message
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
