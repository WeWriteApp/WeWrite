import { NextResponse } from "next/server";
import { searchUsers } from "../../firebase/database";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

// Enhanced search function with unlimited page coverage
async function searchPagesInFirestoreUnlimited(userId, searchTerm, groupIds = [], filterByUserId = null) {
  try {
    console.log(`🔍 UNLIMITED SEARCH: "${searchTerm}" for user: ${userId}`);

    // Handle empty search terms
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term, returning empty results');
      return [];
    }

    // Import Firestore modules
    const { collection, query, where, orderBy, limit, getDocs, startAfter } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const searchTermLower = searchTerm.toLowerCase().trim();
    const allResults = [];

    console.log(`🔍 Searching for: "${searchTermLower}"`);

    // Helper function to check if title matches search term
    const checkSearchMatch = (title, searchTerm) => {
      // Exact substring match (case-insensitive)
      if (title.includes(searchTerm)) {
        console.log(`✅ Exact substring match found`);
        return true;
      }

      // Split search term into words for multi-word search
      const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);

      if (searchWords.length === 1) {
        // Single word search - check if any word in title starts with search term
        const titleWords = title.split(/\s+/).map(word => word.toLowerCase());
        const found = titleWords.some(word => word.startsWith(searchWords[0]));
        console.log(`🎯 Single word search result: ${found}`);
        return found;
      } else {
        // Multi-word search - all words must be found in title
        const found = searchWords.every(word => title.includes(word));
        console.log(`🎯 Multi-word search result: ${found}`);
        return found;
      }
    };

    // STEP 1: Search user's own pages (UNLIMITED)
    if (userId) {
      let lastDoc = null;
      let hasMore = true;
      let totalUserPages = 0;
      let userMatches = 0;

      console.log(`📄 Starting unlimited search through user pages...`);

      while (hasMore) {
        let userPagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', filterByUserId || userId),
          orderBy('lastModified', 'desc'),
          limit(1000) // Process in chunks of 1000
        );

        if (lastDoc) {
          userPagesQuery = query(
            collection(db, 'pages'),
            where('userId', '==', filterByUserId || userId),
            orderBy('lastModified', 'desc'),
            startAfter(lastDoc),
            limit(1000)
          );
        }

        const userPagesSnapshot = await getDocs(userPagesQuery);
        totalUserPages += userPagesSnapshot.size;

        if (userPagesSnapshot.empty || userPagesSnapshot.size < 1000) {
          hasMore = false;
        } else {
          lastDoc = userPagesSnapshot.docs[userPagesSnapshot.docs.length - 1];
        }

        userPagesSnapshot.forEach(doc => {
          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          const isMatch = checkSearchMatch(normalizedTitle, searchTermLower);

          if (isMatch) {
            userMatches++;
            console.log(`✅ User page match: "${pageTitle}" matches "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: true,
              isEditable: true,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              type: 'user'
            });
          }
        });

        console.log(`📄 Processed ${totalUserPages} user pages so far, found ${userMatches} matches`);
      }
      console.log(`📄 Completed unlimited search: ${totalUserPages} total user pages, ${userMatches} matches`);
    }

    // STEP 2: Search public pages (UNLIMITED, if not filtering by specific user)
    if (!filterByUserId) {
      let lastDoc = null;
      let hasMore = true;
      let totalPublicPages = 0;
      let publicMatches = 0;

      console.log(`🌐 Starting unlimited search through public pages...`);

      while (hasMore) {
        let publicPagesQuery = query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          limit(1000) // Process in chunks of 1000
        );

        if (lastDoc) {
          publicPagesQuery = query(
            collection(db, 'pages'),
            where('isPublic', '==', true),
            orderBy('lastModified', 'desc'),
            startAfter(lastDoc),
            limit(1000)
          );
        }

        const publicPagesSnapshot = await getDocs(publicPagesQuery);
        totalPublicPages += publicPagesSnapshot.size;

        if (publicPagesSnapshot.empty || publicPagesSnapshot.size < 1000) {
          hasMore = false;
        } else {
          lastDoc = publicPagesSnapshot.docs[publicPagesSnapshot.docs.length - 1];
        }

        publicPagesSnapshot.forEach(doc => {
          const data = doc.data();

          // Skip user's own pages (already included above)
          if (data.userId === userId) {
            return;
          }

          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          const isMatch = checkSearchMatch(normalizedTitle, searchTermLower);

          if (isMatch) {
            publicMatches++;
            console.log(`✅ Public page match: "${pageTitle}" matches "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              type: 'public'
            });
          }
        });

        console.log(`🌐 Processed ${totalPublicPages} public pages so far, found ${publicMatches} matches`);
      }
      console.log(`🌐 Completed unlimited search: ${totalPublicPages} total public pages, ${publicMatches} matches`);
    }

    console.log(`🎯 Total matches found: ${allResults.length}`);

    // Fetch usernames for pages that don't have them
    const resultsWithUsernames = await Promise.all(allResults.map(async (result) => {
      if (result.userId && !result.username) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const userDocRef = doc(db, 'users', result.userId);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            result.username = userData.username || 'Anonymous';
          } else {
            result.username = 'Anonymous';
          }
        } catch (error) {
          console.error('Error fetching username for user:', result.userId, error);
          result.username = 'Anonymous';
        }
      }
      return result;
    }));

    // Apply enhanced ranking to prioritize title matches
    const { sortSearchResultsByScore } = await import('../../utils/searchUtils');
    const rankedResults = sortSearchResultsByScore(resultsWithUsernames, searchTerm);

    console.log(`🎯 Results after ranking: ${rankedResults.length}`);
    return rankedResults;

  } catch (error) {
    console.error('❌ Error in unlimited search:', error);
    return [];
  }
}

export async function GET(request) {
  try {
    // Extract query parameters from the URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const filterByUserId = searchParams.get("filterByUserId");
    const groupIds = searchParams.get("groupIds")
      ? searchParams.get("groupIds").split(",").filter(id => id && id.trim().length > 0)
      : [];
    const searchTerm = searchParams.get("searchTerm") || "";

    console.log(`Unlimited Search API called with searchTerm: "${searchTerm}", userId: ${userId}, filterByUserId: ${filterByUserId}`);

    // Additional validation
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term provided, returning empty results');
      return NextResponse.json({
        pages: [],
        users: [],
        source: "empty_search_term",
        unlimited: true
      }, { status: 200 });
    }

    // For unauthenticated users, return only public content
    if (!userId) {
      console.log('No userId provided, returning only public content');

      try {
        // Search for public pages in Firestore (unlimited)
        const publicPages = await searchPagesInFirestoreUnlimited(null, searchTerm, [], null);

        // Search for users if we have a search term
        let users = [];
        if (searchTerm && searchTerm.trim().length > 1) {
          try {
            users = await searchUsers(searchTerm, 5);
            console.log(`Found ${users.length} users matching query "${searchTerm}"`);

            // Format users for the response
            users = users.map(user => ({
              id: user.id,
              username: user.username || "Anonymous",
              photoURL: user.photoURL || null,
              type: 'user'
            }));
          } catch (userError) {
            console.error('Error searching for users:', userError);
            users = [];
          }
        }

        return NextResponse.json({
          pages: publicPages || [],
          users: users || [],
          source: "unauthenticated_unlimited_search",
          unlimited: true
        }, { status: 200 });
      } catch (error) {
        console.error('Error in unauthenticated unlimited search:', error);
        return NextResponse.json({
          pages: [],
          users: [],
          error: 'Search temporarily unavailable',
          source: "unauthenticated_unlimited_search_error",
          unlimited: true
        }, { status: 200 });
      }
    }

    // For authenticated users, use unlimited Firestore search
    try {
      console.log(`Starting unlimited Firestore search for authenticated user ${userId}`);

      // Search for pages in Firestore (unlimited)
      const pages = await searchPagesInFirestoreUnlimited(userId, searchTerm, groupIds, filterByUserId);
      console.log(`Unlimited Firestore page search completed. Found ${pages?.length || 0} pages`);

      // Search for users if we have a search term
      let users = [];
      if (searchTerm && searchTerm.trim().length > 1) {
        try {
          console.log(`Starting user search for term "${searchTerm}"`);
          users = await searchUsers(searchTerm, 5);
          console.log(`Found ${users.length} users matching query "${searchTerm}"`);

          // Format users for the response
          users = users.map(user => ({
            id: user.id,
            username: user.username || "Anonymous",
            photoURL: user.photoURL || null,
            type: 'user'
          }));
        } catch (userError) {
          console.error('Error searching for users:', userError);
          users = [];
        }
      }

      const response = {
        pages: pages || [],
        users: users || [],
        source: "firestore_unlimited",
        searchTerm: searchTerm,
        userId: userId,
        unlimited: true,
        timestamp: new Date().toISOString()
      };

      console.log(`Unlimited Search API returning response:`, {
        pagesCount: response.pages.length,
        usersCount: response.users.length,
        source: response.source,
        searchTerm: response.searchTerm,
        unlimited: response.unlimited
      });

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Error in authenticated unlimited search:', error);
      console.error('Error stack:', error.stack);
      return NextResponse.json({
        pages: [],
        users: [],
        error: 'Search temporarily unavailable',
        source: "authenticated_unlimited_search_error",
        unlimited: true,
        errorMessage: error.message
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Unexpected error in unlimited search API:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: "unexpected_unlimited_error",
      unlimited: true
    }, { status: 200 });
  }
}
