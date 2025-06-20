import { NextResponse } from "next/server";
import { cachedSearch, getSearchCacheStats } from "../../utils/searchCache.js";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

/**
 * Enhanced search matching function with performance optimizations
 */
function checkSearchMatch(normalizedTitle, searchTermLower) {
  if (!searchTermLower || searchTermLower.length === 0) {
    return false;
  }

  // First try exact substring match (fastest and most accurate)
  if (normalizedTitle.includes(searchTermLower)) {
    return true;
  }

  // For multi-word searches, check if all words are present (flexible matching)
  if (searchTermLower.includes(' ')) {
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const titleWords = normalizedTitle.split(/\s+/);
    
    return searchWords.every(searchWord => {
      return titleWords.some(titleWord => {
        // Exact match
        if (titleWord === searchWord) return true;
        // Partial match for plurals/singulars
        if (searchWord.endsWith('s') && titleWord === searchWord.slice(0, -1)) return true;
        if (titleWord.endsWith('s') && searchWord === titleWord.slice(0, -1)) return true;
        return false;
      });
    });
  }

  // Single word flexible matching for plurals/singulars
  const titleWords = normalizedTitle.split(/\s+/);
  return titleWords.some(titleWord => {
    if (titleWord === searchTermLower) return true;
    if (searchTermLower.endsWith('s') && titleWord === searchTermLower.slice(0, -1)) return true;
    if (titleWord.endsWith('s') && searchTermLower === titleWord.slice(0, -1)) return true;
    return false;
  });
}

/**
 * Optimized search function with performance improvements
 * 
 * Key optimizations:
 * - Uses select() to fetch only required fields, reducing data transfer
 * - Server-side filtering for deleted pages using where clauses
 * - Separate lightweight queries for title-only vs content search
 * - Reduced query limits with pagination support
 * - Optimized username resolution with batch fetching
 */
async function searchPagesOptimized(userId, searchTerm, groupIds = [], filterByUserId = null, titleOnly = false, maxResults = 50) {
  try {
    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    
    // Import Firestore modules
    const { collection, query, where, orderBy, limit, getDocs, select, documentId } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const searchTermLower = searchTerm.toLowerCase().trim();
    const allResults = [];

    console.log(`🚀 Optimized search for: "${searchTermLower}" (titleOnly: ${titleOnly}, maxResults: ${maxResults})`);

    // Define fields to select based on search type - MAJOR OPTIMIZATION
    const baseFields = ['title', 'userId', 'username', 'isPublic', 'lastModified', 'createdAt'];
    const fieldsToSelect = titleOnly ? baseFields : [...baseFields, 'content'];

    // STEP 1: Search user's own pages with optimized query
    if (userId) {
      const userQuery = query(
        collection(db, 'pages'),
        where('userId', '==', filterByUserId || userId),
        where('deleted', '!=', true), // Server-side filtering - MAJOR OPTIMIZATION
        orderBy('deleted'), // Required for != queries
        orderBy('lastModified', 'desc'),
        select(...fieldsToSelect), // Only fetch needed fields - MAJOR OPTIMIZATION
        limit(Math.min(maxResults * 2, 100)) // Reasonable limit - MAJOR OPTIMIZATION
      );

      try {
        const userPagesSnapshot = await getDocs(userQuery);
        console.log(`📄 Found ${userPagesSnapshot.size} user pages (server-side filtered)`);

        userPagesSnapshot.forEach(doc => {
          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          let isMatch = false;
          let isContentMatch = false;

          if (isEmptySearch) {
            isMatch = true;
          } else {
            const titleMatch = checkSearchMatch(normalizedTitle, searchTermLower);
            
            if (titleOnly) {
              isMatch = titleMatch;
            } else {
              const pageContent = data.content || '';
              const normalizedContent = pageContent.toLowerCase();
              const contentMatch = pageContent && checkSearchMatch(normalizedContent, searchTermLower);
              isMatch = titleMatch || contentMatch;
              isContentMatch = contentMatch && !titleMatch;
            }
          }

          if (isMatch && allResults.length < maxResults) {
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: true,
              isEditable: true,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              type: 'user',
              isContentMatch
            });
          }
        });
      } catch (queryError) {
        console.warn('Error in optimized user pages query:', queryError);
      }
    }

    // STEP 2: Search public pages with optimized query
    if (!filterByUserId && allResults.length < maxResults) {
      const remainingSlots = maxResults - allResults.length;
      
      const publicQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        where('deleted', '!=', true), // Server-side filtering - MAJOR OPTIMIZATION
        orderBy('deleted'), // Required for != queries
        orderBy('lastModified', 'desc'),
        select(...fieldsToSelect), // Only fetch needed fields - MAJOR OPTIMIZATION
        limit(Math.min(remainingSlots * 2, 100)) // Reasonable limit - MAJOR OPTIMIZATION
      );

      try {
        const publicPagesSnapshot = await getDocs(publicQuery);
        console.log(`🌐 Found ${publicPagesSnapshot.size} public pages (server-side filtered)`);

        publicPagesSnapshot.forEach(doc => {
          const data = doc.data();
          // Skip user's own pages (already included above)
          if (data.userId === userId) {
            return;
          }

          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          let isMatch = false;
          let isContentMatch = false;

          if (isEmptySearch) {
            isMatch = true;
          } else {
            const titleMatch = checkSearchMatch(normalizedTitle, searchTermLower);
            
            if (titleOnly) {
              isMatch = titleMatch;
            } else {
              const pageContent = data.content || '';
              const normalizedContent = pageContent.toLowerCase();
              const contentMatch = pageContent && checkSearchMatch(normalizedContent, searchTermLower);
              isMatch = titleMatch || contentMatch;
              isContentMatch = contentMatch && !titleMatch;
            }
          }

          if (isMatch && allResults.length < maxResults) {
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              type: 'public',
              isContentMatch
            });
          }
        });
      } catch (queryError) {
        console.warn('Error in optimized public pages query:', queryError);
      }
    }

    console.log(`🎯 Total matches found: ${allResults.length}`);

    // Optimized username resolution with batch fetching - MAJOR OPTIMIZATION
    const resultsWithUsernames = await resolveUsernamesBatch(allResults);

    // Apply enhanced ranking
    let finalResults;
    if (isEmptySearch) {
      finalResults = resultsWithUsernames.sort((a, b) => {
        const aTime = new Date(a.lastModified || 0).getTime();
        const bTime = new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      });
    } else {
      const { sortSearchResultsByScore } = await import('../../utils/searchUtils');
      finalResults = sortSearchResultsByScore(resultsWithUsernames, searchTerm);
    }

    return finalResults.slice(0, maxResults);

  } catch (error) {
    console.error('❌ Error in optimized search:', error);
    return [];
  }
}

/**
 * Optimized batch username resolution - MAJOR OPTIMIZATION
 */
async function resolveUsernamesBatch(results) {
  if (!results || results.length === 0) return results;

  const { doc, getDoc, documentId, query, where, collection, getDocs } = await import('firebase/firestore');
  const { db } = await import('../../firebase/database');

  // Get unique user IDs that need username resolution
  const userIdsNeedingResolution = [...new Set(
    results
      .filter(result => result.userId && !result.username)
      .map(result => result.userId)
  )];

  if (userIdsNeedingResolution.length === 0) {
    return results;
  }

  console.log(`🔍 Batch resolving usernames for ${userIdsNeedingResolution.length} users`);

  // Batch fetch usernames (Firestore 'in' queries support up to 10 items)
  const usernameMap = new Map();
  const batchSize = 10;
  
  for (let i = 0; i < userIdsNeedingResolution.length; i += batchSize) {
    const batch = userIdsNeedingResolution.slice(i, i + batchSize);
    
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where(documentId(), 'in', batch)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        usernameMap.set(doc.id, userData.username || 'Anonymous');
      });
    } catch (error) {
      console.warn('Error in batch username resolution:', error);
      // Fallback to individual lookups for this batch
      for (const userId of batch) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            usernameMap.set(userId, userData.username || 'Anonymous');
          } else {
            usernameMap.set(userId, 'Anonymous');
          }
        } catch (individualError) {
          console.warn(`Error resolving username for ${userId}:`, individualError);
          usernameMap.set(userId, 'Anonymous');
        }
      }
    }
  }

  // Apply resolved usernames to results
  return results.map(result => {
    if (result.userId && !result.username && usernameMap.has(result.userId)) {
      result.username = usernameMap.get(result.userId);
    }
    return result;
  });
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
    const titleOnly = searchParams.get("titleOnly") === "true"; // New parameter for link editor
    const maxResults = parseInt(searchParams.get("maxResults") || "50"); // Configurable result limit

    console.log(`🚀 Optimized Search API called:`, {
      searchTerm,
      userId,
      filterByUserId,
      titleOnly,
      maxResults,
      timestamp: new Date().toISOString()
    });

    // Handle empty search terms
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term, returning recent pages');

      // For unauthenticated users with empty search, return recent public pages
      if (!userId) {
        try {
          const publicPages = await searchPagesOptimized(null, '', [], null, titleOnly, maxResults);
          return NextResponse.json({
            pages: publicPages || [],
            users: [],
            source: "optimized_empty_search_public",
            performance: { titleOnly, maxResults }
          }, { status: 200 });
        } catch (error) {
          console.error('Error fetching public pages for empty search:', error);
          return NextResponse.json({
            pages: [],
            users: [],
            source: "optimized_empty_search_error"
          }, { status: 200 });
        }
      }

      // For authenticated users with empty search, return recent accessible pages
      try {
        const pages = await searchPagesOptimized(userId, '', groupIds, filterByUserId, titleOnly, maxResults);
        return NextResponse.json({
          pages: pages || [],
          users: [],
          source: "optimized_empty_search_all_pages",
          performance: { titleOnly, maxResults }
        }, { status: 200 });
      } catch (error) {
        console.error('Error fetching all pages for empty search:', error);
        return NextResponse.json({
          pages: [],
          users: [],
          source: "optimized_empty_search_error"
        }, { status: 200 });
      }
    }

    // For unauthenticated users, return only public content
    if (!userId) {
      console.log('No userId provided, returning only public content');

      try {
        const publicPages = await searchPagesOptimized(null, searchTerm, [], null, titleOnly, maxResults);

        // Search for users if we have a search term and not title-only mode
        let users = [];
        if (searchTerm && searchTerm.trim().length > 1 && !titleOnly) {
          try {
            const { searchUsers } = await import('../../firebase/database');
            users = await searchUsers(searchTerm, 5);
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
          source: "optimized_unauthenticated_search",
          performance: { titleOnly, maxResults }
        }, { status: 200 });
      } catch (error) {
        console.error('Error in optimized unauthenticated search:', error);
        return NextResponse.json({
          pages: [],
          users: [],
          error: 'Search temporarily unavailable',
          source: "optimized_unauthenticated_search_error"
        }, { status: 200 });
      }
    }

    // For authenticated users, use optimized search
    try {
      console.log(`Starting optimized search for authenticated user ${userId}`);
      const startTime = Date.now();

      // Search for pages using optimized function with caching
      const cacheOptions = { titleOnly, maxResults, filterByUserId };
      const pages = await cachedSearch(
        (uid, term, opts) => searchPagesOptimized(uid, term, groupIds, opts.filterByUserId, opts.titleOnly, opts.maxResults),
        userId,
        searchTerm,
        cacheOptions
      );
      const searchTime = Date.now() - startTime;

      console.log(`Optimized page search completed in ${searchTime}ms. Found ${pages?.length || 0} pages`);

      // Search for users if we have a search term and not title-only mode
      let users = [];
      if (searchTerm && searchTerm.trim().length > 1 && !titleOnly) {
        try {
          const { searchUsers } = await import('../../firebase/database');
          users = await searchUsers(searchTerm, 5);
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
        source: "optimized_firestore_primary",
        searchTerm: searchTerm,
        userId: userId,
        performance: {
          titleOnly,
          maxResults,
          searchTimeMs: searchTime,
          pagesFound: pages?.length || 0,
          usersFound: users?.length || 0,
          cacheStats: getSearchCacheStats()
        },
        timestamp: new Date().toISOString()
      };

      console.log(`Optimized Search API returning response:`, {
        pagesCount: response.pages.length,
        usersCount: response.users.length,
        source: response.source,
        searchTimeMs: searchTime
      });

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Error in optimized authenticated search:', error);
      return NextResponse.json({
        pages: [],
        users: [],
        error: 'Search temporarily unavailable',
        source: "optimized_authenticated_search_error",
        errorMessage: error.message
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Unexpected error in optimized search API:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: "optimized_unexpected_error"
    }, { status: 200 });
  }
}
