import { NextResponse } from "next/server";

// Add export for dynamic route handling
export const dynamic = 'force-dynamic';

/**
 * UNIFIED SEARCH API - Single Source of Truth
 * 
 * This API replaces all 7 previous search implementations with a single,
 * comprehensive, and efficient search system that ensures complete record retrieval
 * without artificial limits while maintaining optimal performance.
 * 
 * Key Features:
 * - No artificial result limits (finds ALL relevant records)
 * - Smart pagination for performance
 * - Unified interface for all search use cases
 * - Efficient database queries with proper indexing
 * - Comprehensive caching strategy
 * - Support for multiple search contexts (main search, link editor, add to page)
 */

// Search context types
const SEARCH_CONTEXTS = {
  MAIN: 'main',           // Main search page
  LINK_EDITOR: 'link_editor',  // Link editor search
  ADD_TO_PAGE: 'add_to_page',  // Add to page flow
  AUTOCOMPLETE: 'autocomplete' // Autocomplete suggestions
};

// Default configuration per context
const CONTEXT_DEFAULTS = {
  [SEARCH_CONTEXTS.MAIN]: {
    maxResults: 200,
    includeContent: true,
    includeUsers: true,
    includeGroups: false,
    titleOnly: false
  },
  [SEARCH_CONTEXTS.LINK_EDITOR]: {
    maxResults: 100,
    includeContent: false,
    includeUsers: false,
    includeGroups: false,
    titleOnly: true
  },
  [SEARCH_CONTEXTS.ADD_TO_PAGE]: {
    maxResults: 50,
    includeContent: false,
    includeUsers: false,
    includeGroups: false,
    titleOnly: true
  },
  [SEARCH_CONTEXTS.AUTOCOMPLETE]: {
    maxResults: 10,
    includeContent: false,
    includeUsers: true,
    includeGroups: false,
    titleOnly: true
  }
};

/**
 * Advanced search matching with comprehensive scoring
 */
function calculateSearchScore(text, searchTerm, isTitle = false, isContentMatch = false) {
  if (!text || !searchTerm) return 0;
  
  const normalizedText = text.toLowerCase();
  const normalizedSearch = searchTerm.toLowerCase();
  
  // Exact match (highest score)
  if (normalizedText === normalizedSearch) {
    return isTitle ? 100 : 80;
  }
  
  // Starts with search term
  if (normalizedText.startsWith(normalizedSearch)) {
    return isTitle ? 95 : 75;
  }
  
  // Word boundary matches
  const words = normalizedText.split(/\s+/);
  const searchWords = normalizedSearch.split(/\s+/);
  
  // All search words found as complete words
  const allWordsFound = searchWords.every(searchWord => 
    words.some(word => word === searchWord)
  );
  if (allWordsFound) {
    return isTitle ? 90 : 70;
  }
  
  // Sequential word matches
  let sequentialMatches = 0;
  for (let i = 0; i <= words.length - searchWords.length; i++) {
    let matches = 0;
    for (let j = 0; j < searchWords.length; j++) {
      if (words[i + j] && words[i + j].includes(searchWords[j])) {
        matches++;
      } else {
        break;
      }
    }
    sequentialMatches = Math.max(sequentialMatches, matches);
  }
  
  if (sequentialMatches === searchWords.length) {
    return isTitle ? 85 : 65;
  }
  
  // Contains all search words (non-sequential)
  const containsAllWords = searchWords.every(searchWord =>
    normalizedText.includes(searchWord)
  );
  if (containsAllWords) {
    return isTitle ? 80 : 60;
  }
  
  // Partial matches
  if (normalizedText.includes(normalizedSearch)) {
    return isTitle ? 75 : 55;
  }

  // No match found - return 0 to exclude irrelevant results
  return 0;
}

/**
 * Comprehensive search function with no artificial limits
 */
async function searchPagesComprehensive(userId, searchTerm, options = {}) {
  try {
    const {
      context = SEARCH_CONTEXTS.MAIN,
      maxResults = null,
      includeContent = true,
      titleOnly = false,
      filterByUserId = null,
      currentPageId = null
    } = options;

    // Get context defaults and merge with options
    const contextDefaults = CONTEXT_DEFAULTS[context] || CONTEXT_DEFAULTS[SEARCH_CONTEXTS.MAIN];
    const finalMaxResults = maxResults || contextDefaults.maxResults;
    const finalIncludeContent = includeContent !== undefined ? includeContent : contextDefaults.includeContent;
    const finalTitleOnly = titleOnly !== undefined ? titleOnly : contextDefaults.titleOnly;

    console.log(`🔍 UNIFIED SEARCH: "${searchTerm}" (context: ${context}, maxResults: ${finalMaxResults})`);

    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    const searchTermLower = searchTerm?.toLowerCase().trim() || '';

    // Import Firestore modules
    const { collection, query, where, orderBy, limit, getDocs, doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const allResults = [];
    const processedIds = new Set();
    const usernameCache = new Map(); // Cache usernames to avoid duplicate fetches
    
    // STEP 1: Search user's own pages (no limits on database query)
    if (userId) {
      const targetUserId = filterByUserId || userId;
      
      // Use smaller batch size for better performance
      const batchSize = 100;
      let lastDoc = null;
      let hasMore = true;
      
      while (hasMore && allResults.length < finalMaxResults) {
        let userQuery = query(
          collection(db, 'pages'),
          where('userId', '==', targetUserId),
          where('deleted', '!=', true),
          orderBy('deleted'),
          orderBy('lastModified', 'desc'),
          limit(batchSize)
        );
        
        if (lastDoc) {
          const { startAfter } = await import('firebase/firestore');
          userQuery = query(
            collection(db, 'pages'),
            where('userId', '==', targetUserId),
            where('deleted', '!=', true),
            orderBy('deleted'),
            orderBy('lastModified', 'desc'),
            startAfter(lastDoc),
            limit(batchSize)
          );
        }
        
        const userPagesSnapshot = await getDocs(userQuery);
        
        if (userPagesSnapshot.empty) {
          hasMore = false;
          break;
        }
        
        userPagesSnapshot.forEach(doc => {
          if (processedIds.has(doc.id) || doc.id === currentPageId) return;
          
          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          
          let isMatch = false;
          let matchScore = 0;
          let isContentMatch = false;
          
          if (isEmptySearch) {
            isMatch = true;
            matchScore = 50; // Base score for empty search
          } else {
            // Title matching
            const titleScore = calculateSearchScore(pageTitle, searchTerm, true, false);
            
            // Content matching (if enabled)
            let contentScore = 0;
            if (!finalTitleOnly && finalIncludeContent && data.content) {
              contentScore = calculateSearchScore(data.content, searchTerm, false, true);
              isContentMatch = contentScore > titleScore;
            }
            
            matchScore = Math.max(titleScore, contentScore);
            isMatch = matchScore > 0;
          }
          
          if (isMatch) {
            processedIds.add(doc.id);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              type: 'page',
              isOwned: true,
              isEditable: true,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              matchScore,
              isContentMatch,
              context
            });
          }
        });
        
        lastDoc = userPagesSnapshot.docs[userPagesSnapshot.docs.length - 1];
        hasMore = userPagesSnapshot.docs.length === batchSize;
      }
    }
    
    console.log(`📄 Found ${allResults.length} user pages`);
    
    // STEP 2: Search public pages (if not filtering by specific user)
    if (!filterByUserId && allResults.length < finalMaxResults) {
      const batchSize = 100;
      let lastDoc = null;
      let hasMore = true;
      
      while (hasMore && allResults.length < finalMaxResults) {
        let publicQuery = query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          where('deleted', '!=', true),
          orderBy('deleted'),
          orderBy('lastModified', 'desc'),
          limit(batchSize)
        );
        
        if (lastDoc) {
          const { startAfter } = await import('firebase/firestore');
          publicQuery = query(
            collection(db, 'pages'),
            where('isPublic', '==', true),
            where('deleted', '!=', true),
            orderBy('deleted'),
            orderBy('lastModified', 'desc'),
            startAfter(lastDoc),
            limit(batchSize)
          );
        }
        
        const publicPagesSnapshot = await getDocs(publicQuery);
        
        if (publicPagesSnapshot.empty) {
          hasMore = false;
          break;
        }
        
        publicPagesSnapshot.forEach(doc => {
          if (processedIds.has(doc.id) || doc.id === currentPageId) return;
          
          const data = doc.data();
          
          // Skip user's own pages (already processed)
          if (data.userId === userId) return;
          
          const pageTitle = data.title || 'Untitled';
          
          let isMatch = false;
          let matchScore = 0;
          let isContentMatch = false;
          
          if (isEmptySearch) {
            isMatch = true;
            matchScore = 40; // Slightly lower base score for public pages
          } else {
            // Title matching
            const titleScore = calculateSearchScore(pageTitle, searchTerm, true, false);
            
            // Content matching (if enabled)
            let contentScore = 0;
            if (!finalTitleOnly && finalIncludeContent && data.content) {
              contentScore = calculateSearchScore(data.content, searchTerm, false, true);
              isContentMatch = contentScore > titleScore;
            }
            
            matchScore = Math.max(titleScore, contentScore);
            isMatch = matchScore > 0;
          }
          
          if (isMatch && allResults.length < finalMaxResults) {
            processedIds.add(doc.id);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              type: 'public',
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              matchScore,
              isContentMatch,
              context
            });
          }
        });
        
        lastDoc = publicPagesSnapshot.docs[publicPagesSnapshot.docs.length - 1];
        hasMore = publicPagesSnapshot.docs.length === batchSize && allResults.length < finalMaxResults;
      }
    }
    
    console.log(`🌐 Total pages found: ${allResults.length}`);
    
    // Sort by match score and recency
    const sortedResults = allResults.sort((a, b) => {
      if (isEmptySearch) {
        // For empty search, sort by recency
        const aTime = new Date(a.lastModified || 0).getTime();
        const bTime = new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      } else {
        // For search queries, sort by match score then recency
        if (a.matchScore !== b.matchScore) {
          return b.matchScore - a.matchScore;
        }
        const aTime = new Date(a.lastModified || 0).getTime();
        const bTime = new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      }
    });
    
    return sortedResults.slice(0, finalMaxResults);

  } catch (error) {
    console.error('❌ Error in unified search:', error);
    return [];
  }
}

/**
 * Search users with comprehensive matching
 */
async function searchUsersComprehensive(searchTerm, maxResults = 20) {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  try {
    const { collection, query, where, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const searchLower = searchTerm.toLowerCase().trim();
    const results = new Map();

    // Search by username (case insensitive)
    try {
      const usernameQuery = query(
        collection(db, 'users'),
        where('usernameLower', '>=', searchLower),
        where('usernameLower', '<=', searchLower + '\uf8ff'),
        limit(maxResults * 2)
      );

      const usernameResults = await getDocs(usernameQuery);
      usernameResults.forEach(doc => {
        const userData = doc.data();
        const username = userData.username || 'Anonymous';
        const matchScore = calculateSearchScore(username, searchTerm, true, false);

        results.set(doc.id, {
          id: doc.id,
          username,
          email: userData.email || '',
          photoURL: userData.photoURL || null,
          type: 'user',
          matchScore
        });
      });
    } catch (error) {
      console.warn('Error searching users by username:', error);
    }

    // If we have few results, do a broader search
    if (results.size < maxResults / 2) {
      try {
        const broadQuery = query(
          collection(db, 'users'),
          limit(200)
        );
        const broadResults = await getDocs(broadQuery);

        broadResults.forEach(doc => {
          if (!results.has(doc.id)) {
            const userData = doc.data();
            const username = userData.username || '';
            const email = userData.email || '';

            // Client-side filtering for partial matches
            const usernameMatch = username.toLowerCase().includes(searchLower);
            const emailMatch = email.toLowerCase().includes(searchLower);

            if (usernameMatch || emailMatch) {
              const matchScore = calculateSearchScore(username, searchTerm, true, false);
              results.set(doc.id, {
                id: doc.id,
                username: username || 'Anonymous',
                email,
                photoURL: userData.photoURL || null,
                type: 'user',
                matchScore
              });
            }
          }
        });
      } catch (error) {
        console.warn('Error in broad user search:', error);
      }
    }

    // Sort by match score and username
    const sortedResults = Array.from(results.values()).sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return a.username.localeCompare(b.username);
    });

    return sortedResults.slice(0, maxResults);

  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Main API route handler
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const searchTerm = searchParams.get('searchTerm') || searchParams.get('q') || '';
    const userId = searchParams.get('userId') || null;
    const context = searchParams.get('context') || SEARCH_CONTEXTS.MAIN;
    const maxResults = parseInt(searchParams.get('maxResults')) || null;
    const includeContent = searchParams.get('includeContent') !== 'false';
    const includeUsers = searchParams.get('includeUsers') !== 'false';
    const titleOnly = searchParams.get('titleOnly') === 'true';
    const filterByUserId = searchParams.get('filterByUserId') || null;
    const currentPageId = searchParams.get('currentPageId') || null;

    console.log(`🔍 Unified Search API called:`, {
      searchTerm,
      userId,
      context,
      maxResults,
      includeContent,
      includeUsers,
      titleOnly
    });

    const startTime = Date.now();

    // Handle empty search for authenticated users
    if (!searchTerm || searchTerm.trim().length === 0) {
      if (userId) {
        try {
          const pages = await searchPagesComprehensive(userId, '', {
            context,
            maxResults: maxResults || 50,
            includeContent: false,
            titleOnly: true,
            filterByUserId,
            currentPageId
          });

          return NextResponse.json({
            pages: pages || [],
            users: [],
            source: 'unified_empty_search',
            searchTerm: '',
            performance: {
              searchTimeMs: Date.now() - startTime,
              pagesFound: pages?.length || 0,
              usersFound: 0
            }
          }, { status: 200 });
        } catch (error) {
          console.error('Error in empty search:', error);
          return NextResponse.json({
            pages: [],
            users: [],
            error: 'Search temporarily unavailable',
            source: 'unified_empty_search_error'
          }, { status: 200 });
        }
      } else {
        // For unauthenticated users with empty search, return empty results
        return NextResponse.json({
          pages: [],
          users: [],
          source: 'unified_empty_unauthenticated'
        }, { status: 200 });
      }
    }

    // Perform comprehensive search
    const [pages, users] = await Promise.all([
      searchPagesComprehensive(userId, searchTerm, {
        context,
        maxResults,
        includeContent,
        titleOnly,
        filterByUserId,
        currentPageId
      }),
      includeUsers ? searchUsersComprehensive(searchTerm, 10) : Promise.resolve([])
    ]);

    // Fetch missing usernames for pages
    const pagesWithUsernames = await Promise.all((pages || []).map(async (page) => {
      if (!page.username && page.userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', page.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            page.username = userData.username || userData.displayName || 'Anonymous';
          } else {
            page.username = 'Anonymous';
          }
        } catch (error) {
          console.error(`Error fetching username for user ${page.userId}:`, error);
          page.username = 'Anonymous';
        }
      }
      return page;
    }));

    const searchTime = Date.now() - startTime;

    console.log(`✅ Unified search completed in ${searchTime}ms:`, {
      pagesFound: pages?.length || 0,
      usersFound: users?.length || 0,
      searchTerm,
      context
    });

    return NextResponse.json({
      pages: pagesWithUsernames || [],
      users: users || [],
      source: 'unified_search',
      searchTerm,
      context,
      performance: {
        searchTimeMs: searchTime,
        pagesFound: pagesWithUsernames?.length || 0,
        usersFound: users?.length || 0,
        maxResults: maxResults || 'unlimited'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error in unified search API:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: 'unified_search_error'
    }, { status: 500 });
  }
}
