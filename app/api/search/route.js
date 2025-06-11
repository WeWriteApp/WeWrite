import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers, getUserGroupMemberships, getGroupsData } from "../../firebase/database";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

let bigquery = null;

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
      credentials,
    });
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
      stack: error.stack,
    });
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
  console.log(`🔍 checkSearchMatch: title="${normalizedTitle}", search="${searchTermLower}"`);

  // First try exact substring match (fastest)
  if (normalizedTitle.includes(searchTermLower)) {
    console.log(`✅ Exact substring match found`);
    return true;
  }



  // For multi-word searches, check if all words are present (flexible matching)
  if (searchTermLower.includes(' ')) {
    console.log(`🔍 Multi-word search detected`);
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const titleWords = normalizedTitle.split(/\s+/);
    console.log(`🔍 Search words: [${searchWords.join(', ')}]`);
    console.log(`🔍 Title words: [${titleWords.join(', ')}]`);

    // Check if all search words have a match in the title
    const result = searchWords.every(searchWord => {
      const wordMatch = titleWords.some(titleWord => {
        // Exact word match
        if (titleWord === searchWord) {
          console.log(`✅ Exact word match: "${titleWord}" === "${searchWord}"`);
          return true;
        }

        // Partial word matching - only if one word contains the other AND they share significant overlap
        if (titleWord.includes(searchWord) && searchWord.length >= 3) {
          console.log(`✅ Partial match: "${titleWord}" includes "${searchWord}"`);
          return true;
        }
        if (searchWord.includes(titleWord) && titleWord.length >= 3) {
          console.log(`✅ Partial match: "${searchWord}" includes "${titleWord}"`);
          return true;
        }

        // Handle common plurals/singulars
        if (searchWord.endsWith('s') && titleWord === searchWord.slice(0, -1)) {
          console.log(`✅ Plural match: "${searchWord}" matches singular "${titleWord}"`);
          return true;
        }
        if (titleWord.endsWith('s') && searchWord === titleWord.slice(0, -1)) {
          console.log(`✅ Singular match: "${titleWord}" matches plural "${searchWord}"`);
          return true;
        }

        return false;
      });
      console.log(`🎯 Word "${searchWord}" match result: ${wordMatch}`);
      return wordMatch;
    });
    console.log(`🎯 Multi-word search result: ${result}`);
    return result;
  }

  // For single words, check partial matching
  console.log(`🔍 Single word search`);
  const titleWords = normalizedTitle.split(/\s+/);
  console.log(`🔍 Title words: [${titleWords.join(', ')}]`);

  const result = titleWords.some(titleWord => {
    // Exact word match
    if (titleWord === searchTermLower) {
      console.log(`✅ Exact single word match: "${titleWord}" === "${searchTermLower}"`);
      return true;
    }

    // Partial word matching - only if one word contains the other AND they share significant overlap
    if (titleWord.includes(searchTermLower) && searchTermLower.length >= 3) {
      console.log(`✅ Single partial match: "${titleWord}" includes "${searchTermLower}"`);
      return true;
    }
    if (searchTermLower.includes(titleWord) && titleWord.length >= 3) {
      console.log(`✅ Single partial match: "${searchTermLower}" includes "${titleWord}"`);
      return true;
    }

    // Handle common plurals/singulars
    if (searchTermLower.endsWith('s') && titleWord === searchTermLower.slice(0, -1)) {
      console.log(`✅ Single plural match: "${searchTermLower}" matches singular "${titleWord}"`);
      return true;
    }
    if (titleWord.endsWith('s') && searchTermLower === titleWord.slice(0, -1)) {
      console.log(`✅ Single singular match: "${titleWord}" matches plural "${searchTermLower}"`);
      return true;
    }

    return false;
  });
  console.log(`🎯 Single word search result: ${result}`);
  return result;
}

// Simplified function to search pages in Firestore
async function searchPagesInFirestore(userId, searchTerm, groupIds = [], filterByUserId = null) {
  try {
    console.log(`🔍 SIMPLIFIED SEARCH: "${searchTerm}" for user: ${userId}`);

    // Handle empty search terms
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term, returning empty results');
      return [];
    }

    // Import Firestore modules
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    const searchTermLower = searchTerm.toLowerCase().trim();
    const allResults = [];

    console.log(`🔍 Searching for: "${searchTermLower}"`);

    // STEP 1: Search user's own pages
    if (userId) {
      const userPagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', filterByUserId || userId),
        orderBy('lastModified', 'desc'),
        limit(2000) // Search through 2000 most recent pages to include older content
      );

      const userPagesSnapshot = await getDocs(userPagesQuery);
      console.log(`📄 Found ${userPagesSnapshot.size} user pages to search`);



      userPagesSnapshot.forEach(doc => {
        const data = doc.data();
        const pageTitle = data.title || 'Untitled';
        const normalizedTitle = pageTitle.toLowerCase();

        // Enhanced search logic
        const isMatch = checkSearchMatch(normalizedTitle, searchTermLower);

        if (isMatch) {
          console.log(`✅ User page match: "${pageTitle}" matches "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            username: data.username || null, // Include username from page data
            isPublic: data.isPublic,
            lastModified: data.lastModified,
            type: 'user'
          });
        }
      });
    }

    // STEP 2: Search public pages (if not filtering by specific user)
    if (!filterByUserId) {
      // Try multiple queries to ensure we find all relevant pages
      const queries = [
        // Recent pages first
        query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          orderBy('lastModified', 'desc'),
          limit(1000)
        ),
        // Also search by creation date to catch older pages
        query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          limit(500)
        )
      ];

      const allPublicPages = new Map(); // Use Map to deduplicate

      for (const publicPagesQuery of queries) {
        try {
          const publicPagesSnapshot = await getDocs(publicPagesQuery);
          console.log(`🌐 Found ${publicPagesSnapshot.size} public pages in this query`);

          publicPagesSnapshot.forEach(doc => {
            if (!allPublicPages.has(doc.id)) {
              allPublicPages.set(doc.id, doc);


            }
          });
        } catch (queryError) {
          console.error('Error in public pages query:', queryError);
          // Continue with other queries
        }
      }

      console.log(`🌐 Total unique public pages to search: ${allPublicPages.size}`);

      allPublicPages.forEach(doc => {
        const data = doc.data();

        // Skip user's own pages (already included above)
        if (data.userId === userId) {
          return;
        }

        const pageTitle = data.title || 'Untitled';
        const normalizedTitle = pageTitle.toLowerCase();



        // Enhanced search logic
        const isMatch = checkSearchMatch(normalizedTitle, searchTermLower);



        if (isMatch) {
          console.log(`✅ Public page match: "${pageTitle}" matches "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: false,
            isEditable: false,
            userId: data.userId,
            username: data.username || null, // Include username from page data
            isPublic: data.isPublic,
            lastModified: data.lastModified,
            type: 'public'
          });
        }
      });
    }

    console.log(`🎯 Total matches found: ${allResults.length}`);

    // Fetch usernames for pages that don't have them
    const resultsWithUsernames = await Promise.all(allResults.map(async (result) => {
      if (result.userId && !result.username) {
        try {
          // Import Firestore modules
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
    console.error('❌ Error in simplified search:', error);
    return [];
  }
}

export async function GET(request) {
  try {
    // Extract query parameters from the URL
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const filterByUserId = searchParams.get("filterByUserId"); // Add parameter to filter by specific user
    const groupIds = searchParams.get("groupIds")
      ? searchParams.get("groupIds").split(",").filter(id => id && id.trim().length > 0)
      : [];
    const searchTerm = searchParams.get("searchTerm") || "";

    console.log(`Search API called with searchTerm: "${searchTerm}", userId: ${userId}, filterByUserId: ${filterByUserId}`);
    console.log(`SEARCH API USING FIXED MULTI-WORD SEARCH LOGIC`);



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

    // Additional validation
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term provided, returning empty results');
      return NextResponse.json({
        pages: [],
        users: [],
        source: "empty_search_term"
      }, { status: 200 });
    }

    // CRITICAL FIX: Always use Firestore fallback for better reliability
    // BigQuery can be unreliable in production, so prioritize Firestore
    console.log('Using Firestore search for better reliability');

    // For unauthenticated users, return only public content
    if (!userId) {
      console.log('No userId provided, returning only public content');

      try {
        // Search for public pages in Firestore
        const publicPages = await searchPagesInFirestore(null, searchTerm, [], null);

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
              username: user.username || "Anonymous",
              photoURL: user.photoURL || null,
              type: 'user'
            }));
          } catch (userError) {
            console.error('Error searching for users:', userError);
            users = []; // Ensure users is always an array
          }
        }

        return NextResponse.json({
          pages: publicPages || [],
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

    // For authenticated users, use Firestore search directly
    try {
      console.log(`Starting Firestore search for authenticated user ${userId}`);

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
            username: user.username || "Anonymous",
            photoURL: user.photoURL || null,
            type: 'user'
          }));
        } catch (userError) {
          console.error('Error searching for users:', userError);
          users = []; // Ensure users is always an array
        }
      }

      const response = {
        pages: pages || [],
        users: users || [],
        source: "firestore_primary",
        searchTerm: searchTerm,
        userId: userId,
        timestamp: new Date().toISOString()
      };

      console.log(`Search API returning response:`, {
        pagesCount: response.pages.length,
        usersCount: response.users.length,
        source: response.source,
        searchTerm: response.searchTerm
      });

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Error in authenticated search:', error);
      console.error('Error stack:', error.stack);
      return NextResponse.json({
        pages: [],
        users: [],
        error: 'Search temporarily unavailable',
        source: "authenticated_search_error",
        errorMessage: error.message
      }, { status: 200 }); // Return 200 to prevent breaking the UI
    }

  } catch (error) {
    console.error('Unexpected error in search API:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: "unexpected_error"
    }, { status: 200 }); // Return 200 to prevent breaking the UI
  }
}
