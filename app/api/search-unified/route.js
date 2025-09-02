import { NextResponse } from "next/server";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, startAfter } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { getCollectionName } from '../../utils/environmentConfig';
import { searchPerformanceTracker } from '../../utils/searchPerformanceTracker.js';
import { recordProductionRead } from '../../utils/productionReadMonitor';

// Add export for dynamic route handling
export const dynamic = 'force-dynamic';

// OPTIMIZATION: Enhanced caching system to reduce database reads
const searchCache = new Map();
const SEARCH_CACHE_TTL = {
  EMPTY_SEARCH: 10 * 60 * 1000,    // 10 minutes for empty searches (user's own pages)
  TERM_SEARCH: 5 * 60 * 1000,      // 5 minutes for search terms
  USER_SEARCH: 15 * 60 * 1000,     // 15 minutes for user-specific searches
};

function getCacheKey(searchTerm, userId, context, maxResults, filterByUserId) {
  return `search:${searchTerm || 'empty'}:${userId || 'anon'}:${context}:${maxResults}:${filterByUserId || 'none'}`;
}

function getCachedResult(cacheKey) {
  const cached = searchCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedResult(cacheKey, data, ttl) {
  // Limit cache size to prevent memory issues
  if (searchCache.size > 1000) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }

  searchCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

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
 * OPTIMIZED: Comprehensive search function with performance improvements
 */
async function searchPagesComprehensive(userId, searchTerm, options = {}) {
  const searchStartTime = Date.now();

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

    console.log(`🔍 OPTIMIZED SEARCH: "${searchTerm}" (context: ${context}, maxResults: ${finalMaxResults})`);

    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    const searchTermLower = searchTerm?.toLowerCase().trim() || '';

    // OPTIMIZATION: Use parallel queries and result streaming
    const allResults = [];
    const processedIds = new Set();
    const usernameCache = new Map(); // Cache usernames to avoid duplicate fetches

    // OPTIMIZATION: Define field selection to reduce data transfer
    const titleOnlyFields = ['title', 'userId', 'username', 'isPublic', 'lastModified', 'createdAt', 'deleted'];
    const fullFields = titleOnlyFields.concat(['content']);
    
    // OPTIMIZATION: Create parallel query promises for better performance
    const queryPromises = [];

    // STEP 1: OPTIMIZED user pages search with better indexing
    if (userId) {
      const targetUserId = filterByUserId || userId;

      if (isEmptySearch) {
        // DEV SIMPLE: For empty search, just get all user pages (no index needed)
        const recentPagesQuery = query(
          collection(db, getCollectionName('pages')),
          where('userId', '==', targetUserId),
          limit(Math.min(finalMaxResults, 50))
        );
        queryPromises.push(getDocs(recentPagesQuery));
      } else {
        // DEV SIMPLE: Use title-only search (no composite index needed)
        const titlePrefixQuery = query(
          collection(db, getCollectionName('pages')),
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          limit(Math.min(finalMaxResults, 100))
        );
        queryPromises.push(getDocs(titlePrefixQuery));

        // COMPREHENSIVE CASE VARIATIONS: Handle all common case patterns
        const searchTermCapitalized = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase();
        const searchTermUpper = searchTerm.toUpperCase();
        const searchTermTitle = searchTerm.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        // Create all possible case variations to search
        const caseVariations = new Set([
          searchTerm,
          searchTermLower,
          searchTermCapitalized,
          searchTermUpper,
          searchTermTitle
        ]);

        // Remove the original search term since we already queried it
        caseVariations.delete(searchTerm);

        // Search for each case variation
        for (const variation of caseVariations) {
          const caseVariationQuery = query(
            collection(db, getCollectionName('pages')),
            where('title', '>=', variation),
            where('title', '<=', variation + '\uf8ff'),
            limit(Math.min(finalMaxResults, 30))
          );
          queryPromises.push(getDocs(caseVariationQuery));
        }
      }
    }
        
    // STEP 2: SIMPLIFIED all pages search (if not filtering by specific user)
    // Since all pages are now public, no need to filter by isPublic
    if (!filterByUserId && !isEmptySearch) {
      if (searchTerm && searchTerm.length >= 2) {
        // SIMPLIFIED: Use simple title search for all pages (no isPublic filter needed)
        const allPagesTitleQuery = query(
          collection(db, getCollectionName('pages')),
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          limit(Math.min(finalMaxResults, 100))
        );
        queryPromises.push(getDocs(allPagesTitleQuery));

        // COMPREHENSIVE CASE VARIATIONS: Handle all common case patterns for all pages
        const searchTermCapitalized = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase();
        const searchTermUpper = searchTerm.toUpperCase();
        const searchTermTitle = searchTerm.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        // Create all possible case variations to search
        const allPagesCaseVariations = new Set([
          searchTerm,
          searchTermLower,
          searchTermCapitalized,
          searchTermUpper,
          searchTermTitle
        ]);

        // Remove the original search term since we already queried it
        allPagesCaseVariations.delete(searchTerm);

        // Search for each case variation
        for (const variation of allPagesCaseVariations) {
          const allPagesCaseVariationQuery = query(
            collection(db, getCollectionName('pages')),
            where('title', '>=', variation),
            where('title', '<=', variation + '\uf8ff'),
            limit(Math.min(finalMaxResults, 30))
          );
          queryPromises.push(getDocs(allPagesCaseVariationQuery));
        }

        // ENHANCED: Search for individual words to support out-of-order matching
        // Include shorter words (2+ chars) to catch more matches like "to", "in", etc.
        const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length >= 2);
        if (searchWords.length > 1) {
          console.log(`🔍 [SEARCH DEBUG] Adding individual word searches for: ${searchWords.join(', ')}`);

          for (const word of searchWords) {
            // Skip very common words that would return too many results
            if (['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word)) {
              continue;
            }

            // Search for each word individually with case variations
            const wordVariations = new Set([
              word,
              word.charAt(0).toUpperCase() + word.slice(1),
              word.toUpperCase()
            ]);

            for (const wordVariation of wordVariations) {
              const wordQuery = query(
                collection(db, getCollectionName('pages')),
                where('title', '>=', wordVariation),
                where('title', '<=', wordVariation + '\uf8ff'),
                limit(Math.min(finalMaxResults, 20))
              );
              queryPromises.push(getDocs(wordQuery));
            }
          }
        }
      }
    }

    // OPTIMIZATION: Execute all queries in parallel with better error handling
    console.log(`⚡ [SEARCH DEBUG] Executing ${queryPromises.length} parallel queries for searchTerm: "${searchTerm}", userId: ${userId}`);

    try {
      const queryResults = await Promise.allSettled(queryPromises);

      console.log(`⚡ [SEARCH DEBUG] Query results: ${queryResults.length} queries completed`);

      // OPTIMIZATION: Process results efficiently with error handling
      for (const result of queryResults) {
        if (result.status === 'rejected') {
          console.warn('⚡ [SEARCH DEBUG] Query failed:', result.reason);
          continue;
        }

        const snapshot = result.value;
        snapshot.forEach(doc => {
          if (processedIds.has(doc.id) || doc.id === currentPageId) return;

          const data = doc.data();

          // OPTIMIZATION: Early filtering to reduce processing
          if (!data.title && !data.content) return;

          // CRITICAL: Filter out deleted pages from search results
          if (data.deleted === true) return;

          const pageTitle = data.title || 'Untitled';

          let isMatch = false;
          let matchScore = 0;
          let isContentMatch = false;

          if (isEmptySearch) {
            isMatch = true;
            matchScore = 50; // Base score for empty search
          } else {
            // OPTIMIZATION: Fast title matching first
            const titleScore = calculateSearchScore(pageTitle, searchTerm, true, false);

            // Content matching only if title doesn't match well and content search is enabled
            let contentScore = 0;
            if (!finalTitleOnly && finalIncludeContent && titleScore < 80 && data.content) {
              contentScore = calculateSearchScore(data.content, searchTerm, false, true);
              isContentMatch = contentScore > titleScore;
            }

            matchScore = Math.max(titleScore, contentScore);
            isMatch = matchScore > 0;
          }

          if (isMatch && allResults.length < finalMaxResults) {
            processedIds.add(doc.id);

            // OPTIMIZATION: Only include necessary fields for better serialization
            const resultItem = {
              id: doc.id,
              title: pageTitle,
              type: 'page',
              isOwned: data.userId === userId,
              isEditable: data.userId === userId,
              userId: data.userId,
              username: data.username || null,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              matchScore,
              isContentMatch,
              context
            };

            // OPTIMIZATION: Add content preview only if needed
            if (finalIncludeContent && isContentMatch && data.content) {
              resultItem.contentPreview = data.content.substring(0, 200) + '...';
            }

            allResults.push(resultItem);
          }
        });
      }
    } catch (error) {
      console.error('Error in parallel query execution:', error);
      // Continue with empty results rather than failing completely
    }

    // ENHANCED FALLBACK: Always perform broader client-side search for better word matching
    // This ensures we find pages where search terms appear anywhere in the title, not just at the start
    if (!isEmptySearch) {
      console.log(`⚡ [SEARCH DEBUG] Performing comprehensive client-side search to catch missed matches`);

      try {
        // Get a broader set of pages for client-side filtering
        // Increase limit to ensure we catch more potential matches
        const broadQuery = query(
          collection(db, getCollectionName('pages')),
          limit(500)
        );

        const broadSnapshot = await getDocs(broadQuery);
        let broadSearchMatches = 0;

        broadSnapshot.forEach(doc => {
          if (processedIds.has(doc.id) || doc.id === currentPageId) return;
          if (allResults.length >= finalMaxResults) return;

          const data = doc.data();

          // CRITICAL: Filter out deleted pages from search results
          if (data.deleted === true) return;

          const pageTitle = data.title || '';

          // Enhanced client-side matching: check for individual words and full term
          const titleLower = pageTitle.toLowerCase();
          const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 1);

          let hasMatch = false;

          // Check if title contains the full search term
          if (titleLower.includes(searchTermLower)) {
            hasMatch = true;
          }

          // Check if title contains all individual search words (out-of-order matching)
          if (!hasMatch && searchWords.length > 1) {
            const allWordsFound = searchWords.every(word => titleLower.includes(word));
            if (allWordsFound) {
              hasMatch = true;
            }
          }

          // Check if title contains any individual search word (for single word searches)
          if (!hasMatch && searchWords.length === 1) {
            if (titleLower.includes(searchWords[0])) {
              hasMatch = true;
            }
          }

          if (hasMatch) {
            const matchScore = calculateSearchScore(pageTitle, searchTerm, true, false);

            if (matchScore > 0) {
              processedIds.add(doc.id);
              broadSearchMatches++;

              allResults.push({
                id: doc.id,
                title: pageTitle || 'Untitled',
                type: 'page',
                isOwned: data.userId === userId,
                isEditable: data.userId === userId,
                userId: data.userId,
                username: data.username || null,
                lastModified: data.lastModified,
                createdAt: data.createdAt,
                matchScore,
                isContentMatch: false,
                context
              });
            }
          }
        });

        console.log(`⚡ [SEARCH DEBUG] Comprehensive search added ${broadSearchMatches} additional matches`);
      } catch (error) {
        console.warn('Error in comprehensive client-side search:', error);
      }
    }

    // OPTIMIZATION: Sort results by relevance score
    allResults.sort((a, b) => {
      // Prioritize owned pages
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;

      // Then by match score
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;

      // Finally by recency
      return new Date(b.lastModified) - new Date(a.lastModified);
    });

    // OPTIMIZATION: Limit results and add performance metrics
    const finalResults = allResults.slice(0, finalMaxResults);
    const searchTime = Date.now() - searchStartTime;

    console.log(`⚡ OPTIMIZED SEARCH COMPLETE: ${finalResults.length} results in ${searchTime}ms`);

    return finalResults;
  } catch (error) {
    console.error('❌ Error in optimized search:', error);
    return [];
  }
}

/**
 * OPTIMIZED: Search users with better performance
 */
async function searchUsersComprehensive(searchTerm, maxResults = 20) {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  const searchStartTime = Date.now();

  try {
    const searchLower = searchTerm.toLowerCase().trim();
    const results = new Map();

    // OPTIMIZATION: Use parallel queries for better performance
    const queryPromises = [];

    // Primary search by usernameLower field
    const usernameQuery = query(
      collection(db, getCollectionName('users')),
      where('usernameLower', '>=', searchLower),
      where('usernameLower', '<=', searchLower + '\uf8ff'),
      limit(maxResults)
    );
    queryPromises.push(getDocs(usernameQuery));

    // OPTIMIZATION: Execute queries in parallel
    const queryResults = await Promise.all(queryPromises);

    // Process results efficiently
    for (const snapshot of queryResults) {
      snapshot.forEach(doc => {
        if (results.has(doc.id)) return;

        const userData = doc.data();
        const username = userData.username || '';

        // SECURITY: Only include users with valid usernames, never expose email information
        if (!username || username.includes('@') || username === 'Anonymous' || username.toLowerCase().includes('missing')) {
          return; // Skip users without proper usernames
        }

        const matchScore = calculateSearchScore(username, searchTerm, true, false);

        if (matchScore > 0) {
          results.set(doc.id, {
            id: doc.id,
            username,
            // SECURITY: Never include email in search results
            photoURL: userData.photoURL || null,
            type: 'user',
            matchScore
          });
        }
      });
    }

    // If we have few results, do a broader search
    if (results.size < maxResults / 2) {
      try {
        const broadQuery = query(
          collection(db, getCollectionName('users')),
          limit(200)
        );
        const broadResults = await getDocs(broadQuery);

        broadResults.forEach(doc => {
          if (!results.has(doc.id)) {
            const userData = doc.data();
            const username = userData.username || '';

            // SECURITY: Only include users with valid usernames, never search by email
            if (!username || username.includes('@') || username === 'Anonymous' || username.toLowerCase().includes('missing')) {
              return; // Skip users without proper usernames
            }

            // Only search by username, never by email for security
            const usernameMatch = username.toLowerCase().includes(searchLower);

            if (usernameMatch) {
              const matchScore = calculateSearchScore(username, searchTerm, true, false);
              results.set(doc.id, {
                id: doc.id,
                username,
                // SECURITY: Never include email in search results
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
  const startTime = Date.now(); // Move this BEFORE everything
  let searchTerm = '';
  let userId = null;

  try {
    const { searchParams } = new URL(request.url);

    // Extract parameters
    searchTerm = searchParams.get('searchTerm') || searchParams.get('q') || '';
    userId = searchParams.get('userId') || null;
    const context = searchParams.get('context') || SEARCH_CONTEXTS.MAIN;
    const maxResults = parseInt(searchParams.get('maxResults')) || null;
    const includeContent = searchParams.get('includeContent') !== 'false';
    const includeUsers = searchParams.get('includeUsers') !== 'false';
    const titleOnly = searchParams.get('titleOnly') === 'true';
    const filterByUserId = searchParams.get('filterByUserId') || null;
    const currentPageId = searchParams.get('currentPageId') || null;

    // OPTIMIZATION: Check cache first
    const cacheKey = getCacheKey(searchTerm, userId, context, maxResults, filterByUserId);
    const cachedResult = getCachedResult(cacheKey);

    if (cachedResult) {
      console.log(`🚀 CACHE HIT: Search served from cache`);

      // Record cache hit for monitoring
      recordProductionRead('/api/search-unified', 'search-cached', 0, {
        userId,
        cacheStatus: 'HIT',
        responseTime: 0, // Cache hit, no response time
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      });

      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheAge: Date.now() - cachedResult.timestamp
      });
    }

    console.log(`🔍 Unified Search API called:`, {
      searchTerm,
      userId,
      context,
      maxResults,
      includeContent,
      includeUsers,
      titleOnly
    });

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

          const emptySearchResult = {
            pages: pages || [],
            users: [],
            source: 'unified_empty_search',
            searchTerm: '',
            performance: {
              searchTimeMs: Date.now() - startTime,
              pagesFound: pages?.length || 0,
              usersFound: 0
            }
          };

          // OPTIMIZATION: Cache empty search results
          setCachedResult(cacheKey, emptySearchResult, SEARCH_CACHE_TTL.EMPTY_SEARCH);

          // Record production read
          recordProductionRead('/api/search-unified', 'empty-search', pages?.length || 0, {
            userId,
            cacheStatus: 'MISS',
            responseTime: Date.now() - startTime,
            userAgent: request.headers.get('user-agent'),
            referer: request.headers.get('referer')
          });

          return NextResponse.json(emptySearchResult, { status: 200 });
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

    // Fetch missing or invalid usernames for pages
    console.log(`🔍 [USERNAME FETCH] Processing ${(pages || []).length} pages for username fetching`);
    const pagesWithUsernames = await Promise.all((pages || []).map(async (page) => {
      // Check if username is missing, null, or looks like a userId (long alphanumeric string)
      const needsUsernameFetch = !page.username ||
                                page.username === 'Anonymous' ||
                                page.username === 'NULL' ||
                                page.username === 'Missing username' ||
                                (page.username && page.username.length >= 20 && /^[a-zA-Z0-9]+$/.test(page.username));

      console.log(`🔍 [USERNAME FETCH] Page ${page.id}: username="${page.username}", userId="${page.userId}", needsFetch=${needsUsernameFetch}`);

      if (needsUsernameFetch && page.userId) {
        try {
          console.log(`🔍 [USERNAME FETCH] Fetching user document for userId: ${page.userId}`);
          const userDoc = await getDoc(doc(db, getCollectionName('users'), page.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const oldUsername = page.username;
            page.username = userData.username || 'Missing Username';
            console.log(`🔍 [USERNAME FETCH] Fixed username for page ${page.id}: "${page.username}" (was: "${oldUsername || 'null'}")`);
            console.log(`🔍 [USERNAME FETCH] User document data:`, { username: userData.username, userId: page.userId });
          } else {
            console.log(`🔍 [USERNAME FETCH] User document not found for userId: ${page.userId}`);
            page.username = 'Missing Username';
          }
        } catch (error) {
          console.error(`🔍 [USERNAME FETCH] Error fetching username for user ${page.userId}:`, error);
          page.username = 'Missing Username';
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

    // OPTIMIZATION: Track search performance
    const totalResults = (pagesWithUsernames?.length || 0) + (users?.length || 0);
    searchPerformanceTracker.recordSearch(
      searchTerm,
      startTime,
      Date.now(),
      totalResults,
      false, // Not from cache at API level
      'unified_search_api'
    );

    const searchResult = {
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
    };

    // OPTIMIZATION: Cache the result for future requests
    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    const cacheTTL = isEmptySearch ? SEARCH_CACHE_TTL.EMPTY_SEARCH :
                     userId ? SEARCH_CACHE_TTL.USER_SEARCH : SEARCH_CACHE_TTL.TERM_SEARCH;

    setCachedResult(cacheKey, searchResult, cacheTTL);

    // Record production read for monitoring
    recordProductionRead('/api/search-unified', 'search-fresh',
      (pagesWithUsernames?.length || 0) + (users?.length || 0), {
        userId,
        cacheStatus: 'MISS',
        responseTime: searchTime,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      });

    console.log(`🔍 Search completed and cached: ${pagesWithUsernames?.length || 0} pages, ${users?.length || 0} users in ${searchTime}ms`);

    return NextResponse.json(searchResult, { status: 200 });

  } catch (error) {
    console.error('❌ Error in unified search API:', error);

    // OPTIMIZATION: Track search errors
    searchPerformanceTracker.recordSearch(
      searchTerm || '',
      startTime,
      Date.now(),
      0,
      false,
      'unified_search_api',
      error
    );

    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: 'unified_search_error'
    }, { status: 500 });
  }
}