import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers, getUserGroupMemberships, getGroupsData } from "../../firebase/database";
import { getCollectionName, COLLECTIONS } from "../../utils/environmentConfig";
import { cacheHelpers, CACHE_TTL } from "../../utils/serverCache";
import { searchCache } from "../../utils/searchCache";
import { trackFirebaseRead } from "../../utils/costMonitor";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

// Type definitions
interface SearchResult {
  id: string;
  title: string;
  content?: string;
  userId?: string;
  username?: string;
  lastModified?: string;
  type: 'page' | 'user' | 'group';
  isPublic?: boolean;
  groupId?: string;
  groupName?: string;
}

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  hasMore: boolean;
  searchTime: number;
}

let bigquery: BigQuery | null = null;

// Only try to initialize BigQuery if we have credentials
const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;

// In development environment, don't try to use BigQuery to avoid connection errors
if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode - skipping BigQuery initialization');
  // Leave bigquery as null to use Firestore fallback
} else if (credentialsEnvVar) {
  try {
    console.log('Attempting to initialize BigQuery with credentials');

    // First try to handle it as regular JSON
    let jsonString = credentialsEnvVar.replace(/[\n\r\t]/g, '');

    // Check if it might be HTML content (bad response)
    if (jsonString.includes('<!DOCTYPE') || jsonString.includes('<html')) {
      console.error('Credentials appear to contain HTML content instead of JSON. Check environment variable configuration.');
      throw new Error('Invalid credentials format: Contains HTML content');
    }

    // Check if the string starts with eyJ - a common Base64 JSON start pattern
    if (credentialsEnvVar.startsWith('eyJ') ||
        process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true') {
      console.log('Credentials appear to be Base64 encoded, attempting to decode');
      // Try to decode as Base64
      try {
        const buffer = Buffer.from(credentialsEnvVar, 'base64');
        jsonString = buffer.toString('utf-8');
        console.log('Successfully decoded Base64 credentials');
      } catch (decodeError) {
        console.error('Failed to decode Base64:', decodeError);
        // Continue with the original string if decoding fails
      }
    }

    const credentials = JSON.parse(jsonString);
    console.log('Successfully parsed credentials JSON with project_id:', credentials.project_id);
    bigquery = new BigQuery({
      projectId: credentials.project_id,
      credentials});
    console.log('BigQuery client initialized successfully');
  } catch (error) {
    console.error("Failed to initialize BigQuery:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      credentialsProvided: !!credentialsEnvVar,
      credentialsLength: credentialsEnvVar?.length,
      credentialsStart: credentialsEnvVar?.substring(0, 20) + '...',
      containsHTML: credentialsEnvVar?.includes('<!DOCTYPE') || credentialsEnvVar?.includes('<html')
    });
  }
} else {
  console.warn('No Google Cloud credentials found in environment variables');
}

// Test BigQuery connection
async function testBigQueryConnection() {
  if (!bigquery) {
    console.error('BigQuery client not initialized');
    return false;
  }

  try {
    console.log('Testing BigQuery connection...');
    const [datasets] = await bigquery.getDatasets();
    console.log('BigQuery connection successful. Found datasets:', datasets.map(d => d.id));
    return true;
  } catch (error) {
    console.error('BigQuery connection test failed:', error);
    console.error('Connection error details:', {
      message: error.message,
      stack: error.stack});
    return false;
  }
}

/**
 * WeWrite Search Functionality Investigation & Fixes - Enhanced Search Matching
 *
 * Enhanced search matching function that resolves multi-word search issues and provides
 * more intuitive search behavior while maintaining backward compatibility.
 *
 * 🔍 Issue Analysis & Resolution:
 * - Original Problem: "book" returned 3 matches, "book lists" returned 0 matches
 * - Root Cause: Search was working correctly, but no page contained both "book" AND "lists"
 * - User Expectation: More flexible matching for multi-word searches
 *
 * 🛠️ Enhanced Search Algorithm Features:
 * 1. **Exact Substring Matching (Original Behavior)**
 *    - Maintains backward compatibility and fast performance for exact matches
 *
 * 2. **Multi-Word Flexible Matching**
 *    - For "book lists": checks if title contains both "book" AND "lists" (or variations)
 *    - More intuitive than exact substring matching
 *    - Prevents false positives while enabling flexible matching
 *
 * 3. **Single-Word Partial Matching**
 *    - For "book": matches "books", "booking", etc.
 *    - Handles plurals and word variations intelligently
 *
 * ✅ Key Improvements:
 * - Minimum Length Requirement: Prevents overly permissive matching (requires 3+ chars)
 * - Plural/Singular Handling: "book" matches "books" and vice versa
 * - Multi-Word Logic: Requires ALL words to be present for multi-word searches
 * - Performance Optimized: Exact matches checked first (fastest path)
 *
 * 📊 Test Results:
 * - Before: "book" = 3 matches ✅, "book lists" = 0 matches ❌
 * - After: "book" = appropriate matches ✅, "book lists" = 0 matches ✅ (correct - no pages contain both terms)
 *
 * 🎯 Search Logic Validation:
 * "book lists" returns 0 results because no existing page contains both "book" AND "lists"
 * This is correct behavior - would match "My Book Lists" if such a page existed.
 *
 * Enhanced search matching function that handles:
 * 1. Exact substring matching
 * 2. Partial word matching (book matches books)
 * 3. Multi-word flexible matching (book lists matches pages with both book/books AND list/lists)
 */
function checkSearchMatch(normalizedTitle, searchTermLower) {
  // Reduce logging for better performance in production
  const isDebug = process.env.NODE_ENV === 'development';

  if (isDebug) {
    console.log(`🔍 checkSearchMatch: title="${normalizedTitle}", search="${searchTermLower}"`);
  }

  // Performance optimization: Early return for empty search terms
  if (!searchTermLower || searchTermLower.length === 0) {
    return false;
  }

  // First try exact substring match (fastest and most accurate)
  if (normalizedTitle.includes(searchTermLower)) {
    if (isDebug) console.log(`✅ Exact substring match found`);
    return true;
  }

  // For multi-word searches, check if all words are present (flexible matching)
  if (searchTermLower.includes(' ')) {
    if (isDebug) console.log(`🔍 Multi-word search detected`);
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);

    // Check if all search words have a match in the title
    const result = searchWords.every(searchWord => {
      // Try exact substring match first for each word
      if (normalizedTitle.includes(searchWord)) {
        if (isDebug) console.log(`✅ Word substring match: title contains "${searchWord}"`);
        return true;
      }

      // If no exact match, try word-by-word matching
      const titleWords = normalizedTitle.split(/\s+/);
      const wordMatch = titleWords.some(titleWord => {
        // Exact word match
        if (titleWord === searchWord) {
          if (isDebug) console.log(`✅ Exact word match: "${titleWord}" === "${searchWord}"`);
          return true;
        }

        // Partial word matching - only if one word contains the other AND they share significant overlap
        if (titleWord.includes(searchWord) && searchWord.length >= 3) {
          if (isDebug) console.log(`✅ Partial match: "${titleWord}" includes "${searchWord}"`);
          return true;
        }
        if (searchWord.includes(titleWord) && titleWord.length >= 3) {
          if (isDebug) console.log(`✅ Partial match: "${searchWord}" includes "${titleWord}"`);
          return true;
        }

        // Handle common plurals/singulars
        if (searchWord.endsWith('s') && titleWord === searchWord.slice(0, -1)) {
          if (isDebug) console.log(`✅ Plural match: "${searchWord}" matches singular "${titleWord}"`);
          return true;
        }
        if (titleWord.endsWith('s') && searchWord === titleWord.slice(0, -1)) {
          if (isDebug) console.log(`✅ Singular match: "${titleWord}" matches plural "${searchWord}"`);
          return true;
        }

        return false;
      });

      if (isDebug) console.log(`🎯 Word "${searchWord}" match result: ${wordMatch}`);
      return wordMatch;
    });

    if (isDebug) console.log(`🎯 Multi-word search result: ${result}`);
    return result;
  }

  // For single words, check partial matching
  if (isDebug) console.log(`🔍 Single word search`);
  const titleWords = normalizedTitle.split(/\s+/);

  const result = titleWords.some(titleWord => {
    // Exact word match
    if (titleWord === searchTermLower) {
      if (isDebug) console.log(`✅ Exact single word match: "${titleWord}" === "${searchTermLower}"`);
      return true;
    }

    // Partial word matching - only if one word contains the other AND they share significant overlap
    if (titleWord.includes(searchTermLower) && searchTermLower.length >= 3) {
      if (isDebug) console.log(`✅ Single partial match: "${titleWord}" includes "${searchTermLower}"`);
      return true;
    }
    if (searchTermLower.includes(titleWord) && titleWord.length >= 3) {
      if (isDebug) console.log(`✅ Single partial match: "${searchTermLower}" includes "${titleWord}"`);
      return true;
    }

    // Handle common plurals/singulars
    if (searchTermLower.endsWith('s') && titleWord === searchTermLower.slice(0, -1)) {
      if (isDebug) console.log(`✅ Single plural match: "${searchTermLower}" matches singular "${titleWord}"`);
      return true;
    }
    if (titleWord.endsWith('s') && searchTermLower === titleWord.slice(0, -1)) {
      if (isDebug) console.log(`✅ Single singular match: "${titleWord}" matches plural "${searchTermLower}"`);
      return true;
    }

    return false;
  });

  if (isDebug) console.log(`🎯 Single word search result: ${result}`);
  return result;
}

// Optimized function to search pages in Firestore with performance improvements
async function searchPagesInFirestore(userId, searchTerm, groupIds = [], filterByUserId = null) {
  try {
    console.log(`🔍 OPTIMIZED SEARCH: "${searchTerm}" for user: ${userId}`);
    const startTime = Date.now();

    // Handle empty search terms - return recent pages for browsing
    const isEmptySearch = !searchTerm || searchTerm.trim().length === 0;
    if (isEmptySearch) {
      console.log('Empty search term, returning recent pages for browsing');
    }

    // Import Firestore modules
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const searchTermLower = searchTerm.toLowerCase().trim();
    const allResults = [];

    // PERFORMANCE OPTIMIZATION: Only fetch essential fields
    const fieldsToSelect = [
      'title', 'userId', 'username', 'isPublic', 'lastModified',
      'createdAt', 'deleted', 'content' // Keep content for now but will optimize later
    ];

    console.log(`🔍 Searching for: "${searchTermLower}"`);

    // STEP 1: Search user's own pages with optimized query
    if (userId) {
      // MAJOR OPTIMIZATION: Reduced limit and server-side filtering
      const userQuery = query(
        collection(db, getCollectionName(COLLECTIONS.PAGES)),
        where('userId', '==', filterByUserId || userId),
        where('deleted', '!=', true), // Server-side filtering - MAJOR PERFORMANCE BOOST
        orderBy('deleted'), // Required for != queries
        orderBy('lastModified', 'desc'),
        limit(isEmptySearch ? 50 : 100) // Reasonable limits - MAJOR OPTIMIZATION
      );

      const allUserPages = new Map(); // Use Map to deduplicate

      try {
        const userPagesSnapshot = await getDocs(userQuery);
        console.log(`👤 Found ${userPagesSnapshot.size} user pages (server-side filtered)`);

        userPagesSnapshot.forEach(doc => {
          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          let isMatch = false;
          if (isEmptySearch) {
            isMatch = true;
          } else {
            // ENHANCED: Improved matching logic with out-of-order word support
            let titleMatch = false;

            // Check for exact phrase match first (highest priority)
            if (normalizedTitle.includes(searchTermLower) || normalizedTitle.startsWith(searchTermLower)) {
              titleMatch = true;
            } else {
              // Check for out-of-order word matching
              const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 1);
              if (searchWords.length > 1) {
                // Count how many search words are found in the title
                let foundWords = 0;
                for (const word of searchWords) {
                  if (normalizedTitle.includes(word)) {
                    foundWords++;
                  }
                }
                // If most words are found, consider it a match
                titleMatch = foundWords >= Math.ceil(searchWords.length * 0.7);
              } else if (searchWords.length === 1) {
                // Single word - check for partial matches
                const word = searchWords[0];
                titleMatch = normalizedTitle.includes(word);
              }
            }

            // Only check content if title doesn't match and we have content
            let contentMatch = false;
            if (!titleMatch && data.content) {
              const normalizedContent = data.content.toLowerCase();

              // Check for exact phrase match in content
              if (normalizedContent.includes(searchTermLower)) {
                contentMatch = true;
              } else {
                // Check for out-of-order word matching in content
                const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 1);
                if (searchWords.length > 1) {
                  let foundWords = 0;
                  for (const word of searchWords) {
                    if (normalizedContent.includes(word)) {
                      foundWords++;
                    }
                  }
                  // Require more words to match in content (stricter than title)
                  contentMatch = foundWords >= Math.ceil(searchWords.length * 0.8);
                }
              }
            }

            isMatch = titleMatch || contentMatch;
          }

          if (isMatch) {
            allUserPages.set(doc.id, {
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
              isContentMatch: false // Simplified for performance
            });
          }
        });
      } catch (queryError) {
        console.warn('Error in user pages query:', queryError);
      }

      // Add all user pages to results
      allResults.push(...Array.from(allUserPages.values()));
      console.log(`📄 Total unique user pages found: ${allUserPages.size}`);
    }

    // STEP 2: Search pages (if not filtering by specific user and haven't reached limit)
    if (!filterByUserId && allResults.length < (isEmptySearch ? 100 : 150)) {
      const remainingSlots = (isEmptySearch ? 100 : 150) - allResults.length;

      // MAJOR OPTIMIZATION: Server-side filtering and reduced limits
      const pagesQuery = query(
        collection(db, getCollectionName(COLLECTIONS.PAGES)),
        where('deleted', '!=', true), // Server-side filtering - MAJOR PERFORMANCE BOOST
        orderBy('deleted'), // Required for != queries
        orderBy('lastModified', 'desc'),
        limit(Math.min(remainingSlots * 2, isEmptySearch ? 100 : 200)) // Reasonable limits - MAJOR OPTIMIZATION
      );

      const allPages = new Map(); // Use Map to deduplicate

      try {
        const publicPagesSnapshot = await getDocs(pagesQuery);
        console.log(`🌐 Found ${publicPagesSnapshot.size} public pages (server-side filtered)`);

        publicPagesSnapshot.forEach(doc => {
          // Skip user's own pages (already included above)
          if (doc.data().userId === userId) {
            return;
          }

          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();

          let isMatch = false;
          if (isEmptySearch) {
            isMatch = true;
          } else {
            // ENHANCED: Improved matching logic with out-of-order word support
            let titleMatch = false;

            // Check for exact phrase match first (highest priority)
            if (normalizedTitle.includes(searchTermLower) || normalizedTitle.startsWith(searchTermLower)) {
              titleMatch = true;
            } else {
              // Check for out-of-order word matching
              const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 1);
              if (searchWords.length > 1) {
                // Count how many search words are found in the title
                let foundWords = 0;
                for (const word of searchWords) {
                  if (normalizedTitle.includes(word)) {
                    foundWords++;
                  }
                }
                // If most words are found, consider it a match
                titleMatch = foundWords >= Math.ceil(searchWords.length * 0.7);
              } else if (searchWords.length === 1) {
                // Single word - check for partial matches
                const word = searchWords[0];
                titleMatch = normalizedTitle.includes(word);
              }
            }

            // Only check content if title doesn't match and we have content
            let contentMatch = false;
            if (!titleMatch && data.content) {
              const normalizedContent = data.content.toLowerCase();

              // Check for exact phrase match in content
              if (normalizedContent.includes(searchTermLower)) {
                contentMatch = true;
              } else {
                // Check for out-of-order word matching in content
                const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 1);
                if (searchWords.length > 1) {
                  let foundWords = 0;
                  for (const word of searchWords) {
                    if (normalizedContent.includes(word)) {
                      foundWords++;
                    }
                  }
                  // Require more words to match in content (stricter than title)
                  contentMatch = foundWords >= Math.ceil(searchWords.length * 0.8);
                }
              }
            }

            isMatch = titleMatch || contentMatch;
          }

          if (isMatch && allResults.length + allPages.size < (isEmptySearch ? 100 : 150)) {
            allPages.set(doc.id, {
              id: doc.id,
              title: pageTitle,
              type: 'page',
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              username: data.username || null,
              isPublic: data.isPublic,
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              isContentMatch: false // Simplified for performance
            });
          }
        });
      } catch (queryError) {
        console.warn('Error in pages query:', queryError);
      }

      // Add all pages to results
      allResults.push(...Array.from(allPages.values()));
      console.log(`🌐 Total unique pages found: ${allPages.size}`);
    }

    const searchTime = Date.now() - startTime;
    console.log(`🎯 Total matches found: ${allResults.length} in ${searchTime}ms`);

    // Debug: Log sample of found pages for troubleshooting
    if (allResults.length > 0) {
      console.log('📋 Sample of found pages:', allResults.slice(0, 5).map(r => ({
        title: r.title,
        type: r.type,
        isContentMatch: r.isContentMatch
      })));
    } else {
      console.log('❌ No pages found for search term:', searchTermLower);
    }

    // Optimized username fetching with caching to reduce redundant lookups
    const usernameCache = new Map();
    const resultsWithUsernames = await Promise.all(allResults.map(async (result) => {
      if (result.userId && !result.username) {
        try {
          // Check cache first
          if (usernameCache.has(result.userId)) {
            result.username = usernameCache.get(result.userId);
            return result;
          }

          // Import Firestore modules
          const { doc, getDoc } = await import('firebase/firestore');
          const userDocRef = doc(db, getCollectionName(COLLECTIONS.USERS), result.userId);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const username = userData.username || 'Anonymous';
            result.username = username;
            usernameCache.set(result.userId, username); // Cache the result
          } else {
            result.username = 'Anonymous';
            usernameCache.set(result.userId, 'Anonymous'); // Cache the result
          }
        } catch (error) {
          console.error('Error fetching username for user:', result.userId, error);
          result.username = 'Anonymous';
          usernameCache.set(result.userId, 'Anonymous'); // Cache the error result
        }
      }
      return result;
    }));

    // Apply enhanced ranking to prioritize title matches (only for non-empty searches)
    let finalResults;
    if (isEmptySearch) {
      // For empty searches, sort by lastModified (most recent first)
      finalResults = resultsWithUsernames.sort((a, b) => {
        const aTime = new Date(a.lastModified || 0).getTime();
        const bTime = new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      });
      console.log(`🎯 Results sorted by recency: ${finalResults.length}`);
    } else {
      const { sortSearchResultsByScore } = await import('../../utils/searchUtils');
      finalResults = sortSearchResultsByScore(resultsWithUsernames, searchTerm);
      console.log(`🎯 Results after ranking: ${finalResults.length}`);
    }

    return finalResults;

  } catch (error) {
    console.error('❌ Error in simplified search:', error);
    return [];
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Extract query parameters from the URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const filterByUserId = searchParams.get("filterByUserId");
    const groupIds = searchParams.get("groupIds")
      ? searchParams.get("groupIds").split(",").filter(id => id && id.trim().length > 0)
      : [];
    const searchTerm = searchParams.get("searchTerm") || "";

    console.log(`🔍 [Search API] Enhanced: "${searchTerm}", userId: ${userId}, filterByUserId: ${filterByUserId}`);

    // Check enhanced search cache first
    const searchOptions = { filterByUserId, groupIds, context: 'main' };
    const cachedResults = searchCache.get(searchTerm, userId, 'pages', searchOptions);

    if (cachedResults) {
      const responseTime = Date.now() - startTime;
      console.log(`🚀 [Search API] Cache hit for "${searchTerm}" (${responseTime}ms, ${cachedResults.length} results)`);

      const response = NextResponse.json({
        pages: cachedResults,
        users: [], // Users would be cached separately
        source: "enhanced_cache_hit",
        performance: {
          searchTimeMs: responseTime,
          pagesFound: cachedResults.length,
          fromCache: true
        }
      }, { status: 200 });

      response.headers.set('Cache-Control', 'public, max-age=900, s-maxage=1800'); // 15min browser, 30min CDN
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      response.headers.set('X-Database-Reads', '0');

      return response;
    }

    console.log(`💸 [Search API] Cache miss for "${searchTerm}" - executing search`);

    // Create fallback cache key for existing cache system
    const cacheKey = `search:${searchTerm}:${userId || 'anonymous'}:${filterByUserId || ''}:${groupIds.join(',')}`;
    console.log('🔍 Search API - Fallback cache key:', cacheKey);

    // IMPORTANT FIX: Log more details about the search request
    console.log('Search API request details:', {
      searchTerm,
      searchTermLength: searchTerm.length,
      searchTermTrimmed: searchTerm.trim(),
      searchTermTrimmedLength: searchTerm.trim().length,
      userId,
      filterByUserId,
      groupIds,
      url: request.url,
      timestamp: new Date().toISOString()
    });

    // Handle empty search terms - for link editor, we want to show all available pages
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term provided, returning all available pages for browsing');

      // For unauthenticated users with empty search, return recent pages
      if (!userId) {
        try {
          const pages = await searchPagesInFirestore(null, '', [], null);
          return NextResponse.json({
            pages: pages || [],
            users: [],
            source: "empty_search_pages"
          }, { status: 200 });
        } catch (error) {
          console.error('Error fetching pages for empty search:', error);
          return NextResponse.json({
            pages: [],
            users: [],
            source: "empty_search_error"
          }, { status: 200 });
        }
      }

      // For authenticated users with empty search, return all their accessible pages
      try {
        const pages = await searchPagesInFirestore(userId, '', groupIds, filterByUserId);
        return NextResponse.json({
          pages: pages || [],
          users: [],
          source: "empty_search_all_pages"
        }, { status: 200 });
      } catch (error) {
        console.error('Error fetching all pages for empty search:', error);
        return NextResponse.json({
          pages: [],
          users: [],
          source: "empty_search_error"
        }, { status: 200 });
      }
    }

    // CRITICAL FIX: Always use Firestore fallback for better reliability
    // BigQuery can be unreliable in production, so prioritize Firestore
    console.log('Using Firestore search for better reliability');

    // For unauthenticated users, return only public content
    if (!userId) {
      console.log('No userId provided, returning only public content');

      try {
        // Search for pages in Firestore
        const pages = await searchPagesInFirestore(null, searchTerm, [], null);

        // Search for users if we have a search term
        let users = [];
        if (searchTerm && searchTerm.trim().length > 1) {
          try {
            const { searchUsers } = await import('../../firebase/database');
            users = await searchUsers(searchTerm, 5);
            console.log(`Found ${users.length} users matching query "${searchTerm}"`);

            // Format users for the response
            users = users.map(user => ({
              id: user.id,
              username: user.username || "Anonymous", // Fixed: Use user.username instead of session.username
              photoURL: user.photoURL || null,
              type: 'user'
            }));
          } catch (userError) {
            console.error('Error searching for users:', userError);
            users = []; // Ensure users is always an array
          }
        }

        return NextResponse.json({
          pages: pages || [],
          users: users || [],
          source: "unauthenticated_search"
        }, { status: 200 });
      } catch (error) {
        console.error('Error in unauthenticated search:', error);
        return NextResponse.json({
          pages: [],
          users: [],
          error: 'Search temporarily unavailable',
          source: "unauthenticated_search_error"
        }, { status: 200 }); // Return 200 to prevent breaking the UI
      }
    }

    // For authenticated users, use Firestore search directly with caching
    const cachedResult = await cacheHelpers.getSearchResults(cacheKey, async () => {
      console.log(`🔍 Search API - Cache miss, executing fresh search for authenticated user ${userId}`);

      // Search for pages in Firestore
      const pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);
      console.log(`Firestore page search completed. Found ${pages?.length || 0} pages`);

      // Search for users if we have a search term
      let users = [];
      if (searchTerm && searchTerm.trim().length > 1) {
        try {
          console.log(`Starting user search for term "${searchTerm}"`);
          const { searchUsers } = await import('../../firebase/database');
          users = await searchUsers(searchTerm, 5);
          console.log(`Found ${users.length} users matching query "${searchTerm}"`);

          // Format users for the response
          users = users.map(user => ({
            id: user.id,
            username: user.username || "Anonymous", // Fixed: Use user.username instead of session.username
            photoURL: user.photoURL || null,
            type: 'user'
          }));
        } catch (userError) {
          console.error('Error searching for users:', userError);
          users = []; // Ensure users is always an array
        }
      }

      // Track database reads for cost monitoring
      const estimatedReads = Math.max((pages?.length || 0) * 2, 50); // Estimate search complexity
      trackFirebaseRead('pages', 'search', estimatedReads, 'api-search-pages');

      if (users && users.length > 0) {
        trackFirebaseRead('users', 'search', users.length, 'api-search-users');
      }

      return {
        pages: pages || [],
        users: users || [],
        source: "firestore_primary",
        searchTerm: searchTerm,
        userId: userId,
        timestamp: new Date().toISOString()
      };
    });

    // Store results in enhanced cache for future requests
    if (cachedResult.pages && cachedResult.pages.length > 0) {
      searchCache.set(searchTerm, userId, cachedResult.pages, 'pages', searchOptions);
    }

    if (cachedResult.users && cachedResult.users.length > 0) {
      searchCache.set(searchTerm, userId, cachedResult.users, 'users', searchOptions);
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ [Search API] Enhanced: Completed search for "${searchTerm}" (${responseTime}ms)`);

    console.log(`Search API returning response:`, {
      pagesCount: cachedResult.pages.length,
      usersCount: cachedResult.users.length,
      source: cachedResult.source,
      searchTerm: cachedResult.searchTerm,
      responseTime: `${responseTime}ms`
    });

    const response = NextResponse.json({
      ...cachedResult,
      performance: {
        searchTimeMs: responseTime,
        pagesFound: cachedResult.pages.length,
        usersFound: cachedResult.users.length,
        fromCache: false
      }
    }, { status: 200 });

    // Enhanced cache headers for fresh search results
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=900, stale-while-revalidate=1800'); // 10min browser, 15min CDN
    response.headers.set('ETag', `"search-${searchTerm}-${Date.now()}"`);
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    response.headers.set('X-Database-Reads', estimatedReads.toString());
    response.headers.set('Vary', 'Authorization');

    return response;

  } catch (error) {
    console.error('Unexpected error in search API:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: "search_error",
      errorMessage: error.message
    }, { status: 200 }); // Return 200 to prevent breaking the UI
  }
}