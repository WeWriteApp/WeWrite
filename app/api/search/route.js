import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers } from "../../firebase/database";

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

// Fallback function to search pages in Firestore when BigQuery is not available
async function searchPagesInFirestore(userId, searchTerm, groupIds = [], filterByUserId = null) {
  try {
    console.log(`Using Firestore fallback for page search with term: "${searchTerm}"`);

    // IMPORTANT FIX: Handle empty search terms
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term provided to Firestore fallback, fetching recent pages');

      // For empty search terms, return recent pages instead of empty results
      // This is especially useful for the link editor context
      try {
        // Import Firestore modules dynamically
        const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase/database');

        // Get user's own recent pages
        const recentPagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId || 'anonymous'),
          orderBy('lastModified', 'desc'),
          limit(10)
        );

        const recentPagesSnapshot = await getDocs(recentPagesQuery);
        console.log(`Found ${recentPagesSnapshot.size} recent pages for empty search term`);

        const recentPages = [];
        recentPagesSnapshot.forEach(doc => {
          const data = doc.data();
          recentPages.push({
            id: doc.id,
            title: data.title || 'Untitled',
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user'
          });
        });

        return recentPages;
      } catch (error) {
        console.error('Error fetching recent pages:', error);
        return [];
      }
    }

    // Import Firestore modules dynamically
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');
    const { containsAllSearchWords } = await import('../../utils/searchUtils');

    // Format search term for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase().trim();
    console.log(`Normalized search term: "${searchTermLower}"`);

    // IMPORTANT FIX: Log more details about the search
    console.log('Firestore search details:', {
      searchTermLower,
      searchTermLength: searchTermLower.length,
      userId,
      filterByUserId,
      groupIds: groupIds.length
    });

    // For multi-word searches, split into individual words
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const hasMultipleWords = searchWords.length > 1;
    console.log(`Search words: ${JSON.stringify(searchWords)}, hasMultipleWords: ${hasMultipleWords}`);

    // Log the search strategy
    if (hasMultipleWords) {
      console.log(`Using multi-word search strategy for "${searchTermLower}" with words: ${JSON.stringify(searchWords)}`);
    } else {
      console.log(`Using single-word search strategy for "${searchTermLower}"`);
    }

    // Determine if we should filter by a specific user ID
    const isFilteringByUser = !!filterByUserId;

    // Initialize results array
    const allResults = [];

    // STEP 1: Get user's own pages
    console.log(`Getting pages for user: ${isFilteringByUser ? filterByUserId : userId}`);
    const userPagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', isFilteringByUser ? filterByUserId : userId),
      orderBy('lastModified', 'desc'),
      limit(50) // Increased limit to ensure we get enough matches
    );

    const userPagesSnapshot = await getDocs(userPagesQuery);
    console.log(`Found ${userPagesSnapshot.size} user pages before filtering`);

    // Process user's pages
    userPagesSnapshot.forEach(doc => {
      const data = doc.data();
      const pageTitle = data.title || 'Untitled';
      const normalizedTitle = pageTitle.toLowerCase();
      const titleWords = normalizedTitle.split(/\s+/);

      // If no search term, include all pages
      if (!searchTermLower) {
        allResults.push({
          id: doc.id,
          title: pageTitle,
          isOwned: true,
          isEditable: true,
          userId: data.userId,
          lastModified: data.lastModified,
          type: 'user'
        });
        return;
      }

      // For multi-word searches, check if title contains all words
      if (hasMultipleWords) {
        console.log(`Checking if user page "${pageTitle}" contains all words in "${searchTermLower}"`);
        if (containsAllSearchWords(pageTitle, searchTermLower)) {
          console.log(`✅ User page match (all words): "${pageTitle}" contains all words in "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            containsAllSearchWords: true
          });
          return; // Only return if we found a match
        } else {
          console.log(`❌ User page "${pageTitle}" does not contain all words in "${searchTermLower}"`);
        }
        // Continue checking other criteria if we didn't find a match for all words
        console.log(`Continuing with other search criteria for user page "${pageTitle}"`);
      }

      // For single-word searches, check if title includes the search term
      if (normalizedTitle.includes(searchTermLower)) {
        console.log(`User page match (direct): "${pageTitle}" includes "${searchTermLower}"`);
        allResults.push({
          id: doc.id,
          title: pageTitle,
          isOwned: true,
          isEditable: true,
          userId: data.userId,
          lastModified: data.lastModified,
          type: 'user'
        });
        return;
      }

      // Check if any word in the title contains the search term
      // This helps with partial word matches like "book" in "notebook"
      for (const word of titleWords) {
        if (word.includes(searchTermLower)) {
          console.log(`User page match (partial word): "${word}" in "${pageTitle}" contains "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            matchQuality: 'partialWord'
          });
          return;
        }
      }

      // Additional check: See if the search term is part of the title as a whole
      // This helps with cases where the search term might span multiple words
      if (normalizedTitle.includes(searchTermLower)) {
        console.log(`User page match (title contains): "${pageTitle}" contains "${searchTermLower}" as a substring`);
        allResults.push({
          id: doc.id,
          title: pageTitle,
          isOwned: true,
          isEditable: true,
          userId: data.userId,
          lastModified: data.lastModified,
          type: 'user',
          matchQuality: 'titleContains'
        });
        return;
      }

      // Check if any word in the title starts with the search term
      for (const word of titleWords) {
        if (word.startsWith(searchTermLower)) {
          console.log(`User page match (word starts with): "${word}" in "${pageTitle}" starts with "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            matchQuality: 'wordStartsWith'
          });
          return;
        }
      }
    });

    // STEP 2: Get public pages if not filtering by user
    if (!isFilteringByUser) {
      console.log('Getting public pages');
      const publicPagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(50) // Increased limit to ensure we get enough matches
      );

      const publicPagesSnapshot = await getDocs(publicPagesQuery);
      console.log(`Found ${publicPagesSnapshot.size} public pages before filtering`);

      // Process public pages
      publicPagesSnapshot.forEach(doc => {
        const data = doc.data();

        // Skip user's own pages (already included above)
        if (data.userId === userId) {
          return;
        }

        const pageTitle = data.title || 'Untitled';
        const normalizedTitle = pageTitle.toLowerCase();
        const titleWords = normalizedTitle.split(/\s+/);

        // If no search term, include all pages
        if (!searchTermLower) {
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: false,
            isEditable: false,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'public'
          });
          return;
        }

        // For multi-word searches, check if title contains all words
        if (hasMultipleWords) {
          console.log(`Checking if public page "${pageTitle}" contains all words in "${searchTermLower}"`);
          if (containsAllSearchWords(pageTitle, searchTermLower)) {
            console.log(`✅ Public page match (all words): "${pageTitle}" contains all words in "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'public',
              containsAllSearchWords: true
            });
            return; // Only return if we found a match
          } else {
            console.log(`❌ Public page "${pageTitle}" does not contain all words in "${searchTermLower}"`);
          }
          // Continue checking other criteria if we didn't find a match for all words
          console.log(`Continuing with other search criteria for public page "${pageTitle}"`);
        }

        // For single-word searches, check if title includes the search term
        if (normalizedTitle.includes(searchTermLower)) {
          console.log(`Public page match (direct): "${pageTitle}" includes "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: false,
            isEditable: false,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'public'
          });
          return;
        }

        // Check if any word in the title contains the search term
        // This helps with partial word matches like "book" in "notebook"
        for (const word of titleWords) {
          if (word.includes(searchTermLower)) {
            console.log(`Public page match (partial word): "${word}" in "${pageTitle}" contains "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'public',
              matchQuality: 'partialWord'
            });
            return;
          }
        }

        // Additional check: See if the search term is part of the title as a whole
        // This helps with cases where the search term might span multiple words
        if (normalizedTitle.includes(searchTermLower)) {
          console.log(`Public page match (title contains): "${pageTitle}" contains "${searchTermLower}" as a substring`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: false,
            isEditable: false,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'public',
            matchQuality: 'titleContains'
          });
          return;
        }

        // Check if any word in the title starts with the search term
        for (const word of titleWords) {
          if (word.startsWith(searchTermLower)) {
            console.log(`Public page match (word starts with): "${word}" in "${pageTitle}" starts with "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'public',
              matchQuality: 'wordStartsWith'
            });
            return;
          }
        }
      });
    }

    // STEP 3: Get group pages if group IDs are provided
    if (groupIds.length > 0 && !isFilteringByUser) {
      console.log(`Getting pages for ${groupIds.length} groups`);

      // Process each group in batches of 10 (Firestore limit for 'in' queries)
      const batchSize = 10;
      for (let i = 0; i < groupIds.length; i += batchSize) {
        const groupBatch = groupIds.slice(i, i + batchSize);

        if (groupBatch.length === 0) continue;

        const groupPagesQuery = query(
          collection(db, 'pages'),
          where('groupId', 'in', groupBatch),
          orderBy('lastModified', 'desc'),
          limit(50)
        );

        const groupPagesSnapshot = await getDocs(groupPagesQuery);
        console.log(`Found ${groupPagesSnapshot.size} group pages before filtering`);

        // Process group pages
        groupPagesSnapshot.forEach(doc => {
          const data = doc.data();
          const pageTitle = data.title || 'Untitled';
          const normalizedTitle = pageTitle.toLowerCase();
          const titleWords = normalizedTitle.split(/\s+/);

          // If no search term, include all pages
          if (!searchTermLower) {
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: data.userId === userId,
              isEditable: true, // User can edit group pages
              userId: data.userId,
              groupId: data.groupId,
              lastModified: data.lastModified,
              type: 'group'
            });
            return;
          }

          // For multi-word searches, check if title contains all words
          if (hasMultipleWords) {
            console.log(`Checking if group page "${pageTitle}" contains all words in "${searchTermLower}"`);
            if (containsAllSearchWords(pageTitle, searchTermLower)) {
              console.log(`✅ Group page match (all words): "${pageTitle}" contains all words in "${searchTermLower}"`);
              allResults.push({
                id: doc.id,
                title: pageTitle,
                isOwned: data.userId === userId,
                isEditable: true,
                userId: data.userId,
                groupId: data.groupId,
                lastModified: data.lastModified,
                type: 'group',
                containsAllSearchWords: true
              });
              return; // Only return if we found a match
            } else {
              console.log(`❌ Group page "${pageTitle}" does not contain all words in "${searchTermLower}"`);
            }
            // Continue checking other criteria if we didn't find a match for all words
            console.log(`Continuing with other search criteria for group page "${pageTitle}"`);
          }

          // For single-word searches, check if title includes the search term
          if (normalizedTitle.includes(searchTermLower)) {
            console.log(`Group page match (direct): "${pageTitle}" includes "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: data.userId === userId,
              isEditable: true,
              userId: data.userId,
              groupId: data.groupId,
              lastModified: data.lastModified,
              type: 'group'
            });
            return;
          }

          // Check if any word in the title contains the search term
          // This helps with partial word matches like "book" in "notebook"
          for (const word of titleWords) {
            if (word.includes(searchTermLower)) {
              console.log(`Group page match (partial word): "${word}" in "${pageTitle}" contains "${searchTermLower}"`);
              allResults.push({
                id: doc.id,
                title: pageTitle,
                isOwned: data.userId === userId,
                isEditable: true,
                userId: data.userId,
                groupId: data.groupId,
                lastModified: data.lastModified,
                type: 'group',
                matchQuality: 'partialWord'
              });
              return;
            }
          }

          // Additional check: See if the search term is part of the title as a whole
          // This helps with cases where the search term might span multiple words
          if (normalizedTitle.includes(searchTermLower)) {
            console.log(`Group page match (title contains): "${pageTitle}" contains "${searchTermLower}" as a substring`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: data.userId === userId,
              isEditable: true,
              userId: data.userId,
              groupId: data.groupId,
              lastModified: data.lastModified,
              type: 'group',
              matchQuality: 'titleContains'
            });
            return;
          }

          // Check if any word in the title starts with the search term
          for (const word of titleWords) {
            if (word.startsWith(searchTermLower)) {
              console.log(`Group page match (word starts with): "${word}" in "${pageTitle}" starts with "${searchTermLower}"`);
              allResults.push({
                id: doc.id,
                title: pageTitle,
                isOwned: data.userId === userId,
                isEditable: true,
                userId: data.userId,
                groupId: data.groupId,
                lastModified: data.lastModified,
                type: 'group',
                matchQuality: 'wordStartsWith'
              });
              return;
            }
          }
        });
      }
    }

    // Sort results by last modified date (newest first)
    allResults.sort((a, b) => {
      const dateA = new Date(a.lastModified || 0);
      const dateB = new Date(b.lastModified || 0);
      return dateB - dateA;
    });

    console.log(`Firestore search found ${allResults.length} total matches for "${searchTermLower}"`);

    // Return all results (limit to reasonable number)
    return allResults.slice(0, 50);
  } catch (error) {
    console.error('Error in Firestore fallback search:', error);
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
      url: request.url
    });

    // For unauthenticated users, return only public content
    if (!userId) {
      console.log('No userId provided, returning only public content');

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
        }
      }

      return NextResponse.json({
        pages: publicPages,
        users,
        source: "unauthenticated_search"
      }, { status: 200 });
    }

    // If BigQuery is not initialized, use Firestore fallback
    if (!bigquery) {
      console.log('BigQuery client not initialized, using Firestore fallback');

      // Search for pages in Firestore
      const pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);

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
        }
      }

      return NextResponse.json({
        pages,
        users,
        source: "firestore_fallback"
      }, { status: 200 });
    }

    // Test BigQuery connection first
    const isConnected = await testBigQueryConnection();
    if (!isConnected) {
      console.log('BigQuery connection failed, falling back to Firestore');

      // Search for pages in Firestore
      const pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);

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
        }
      }

      return NextResponse.json({
        pages,
        users,
        source: "firestore_fallback_after_bigquery_connection_failed"
      }, { status: 200 });
    }

    // Ensure searchTerm is properly handled if not provided
    // Use % wildcards to match any characters before and after the search term
    // This ensures we match partial words like "book" in "notebook"
    const searchTermLower = searchTerm.toLowerCase().trim();

    // For multi-word searches, split into individual words
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const hasMultipleWords = searchWords.length > 1;

    // Create more flexible patterns for matching
    // 1. Standard pattern with wildcards on both sides for substring matching
    const searchTermFormatted = searchTermLower ? `%${searchTermLower}%` : "%";

    // 2. Pattern for matching at the beginning of words (helps with "book" matching "books")
    const wordStartPattern = searchTermLower ? `% ${searchTermLower}%` : "%";

    // 3. Pattern for matching partial words (helps with "book" in "notebook")
    // Use a more aggressive partial word pattern to ensure we catch all relevant matches
    const partialWordPattern = searchTermLower.length > 1
      ? `%${searchTermLower}%`
      : searchTermFormatted;

    // 4. Add a pattern specifically for matching words that contain the search term
    const wordContainsPattern = searchTermLower ? `% %${searchTermLower}% %` : "%";

    // 4. For multi-word searches, create patterns for each word
    let wordPatterns = [];
    if (hasMultipleWords && searchWords.length > 0) {
      // Create patterns for each individual word
      wordPatterns = searchWords.map(word => `%${word}%`);
      console.log(`Created word patterns for multi-word search: ${JSON.stringify(wordPatterns)}`);
    }

    console.log(`BigQuery search patterns: standard="${searchTermFormatted}", wordStart="${wordStartPattern}", partial="${partialWordPattern}"`);
    console.log(`Multi-word search: ${hasMultipleWords}, words=${JSON.stringify(searchWords)}`);


    console.log(`BigQuery search term formatted as: "${searchTermFormatted}" for original term: "${searchTerm}"`);

    // First try a direct search to see if we get any results
    try {
      // Build the test query
      let testQuery = `
        SELECT COUNT(*) as count
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE LOWER(title) LIKE @searchTerm
          OR LOWER(title) LIKE @wordStartPattern
          OR LOWER(title) LIKE @partialWordPattern
          OR LOWER(title) LIKE @wordContainsPattern
      `;

      // Add conditions for multi-word searches
      const params = {
        searchTerm: searchTermFormatted,
        wordStartPattern: wordStartPattern,
        partialWordPattern: partialWordPattern,
        wordContainsPattern: wordContainsPattern
      };

      const types = {
        searchTerm: "STRING",
        wordStartPattern: "STRING",
        partialWordPattern: "STRING",
        wordContainsPattern: "STRING"
      };

      // For multi-word searches, add conditions to check for each word
      if (hasMultipleWords && wordPatterns.length > 0) {
        // Add a condition to check if title contains all words
        let multiWordCondition = "\n          OR (";

        wordPatterns.forEach((pattern, index) => {
          const paramName = `wordPattern${index}`;
          multiWordCondition += `\n            LOWER(title) LIKE @${paramName}`;
          if (index < wordPatterns.length - 1) {
            multiWordCondition += " AND";
          }

          // Add parameter
          params[paramName] = pattern;
          types[paramName] = "STRING";
        });

        multiWordCondition += "\n          )";
        testQuery += multiWordCondition;

        console.log("Added multi-word condition to test query:", multiWordCondition);
      }

      const [testResult] = await bigquery.query({
        query: testQuery,
        params: params,
        types: types
      });

      console.log(`BigQuery test query found ${testResult[0].count} matches for "${searchTermFormatted}"`);

      // If no results found with BigQuery, fall back to Firestore
      if (testResult[0].count === 0) {
        console.log('No results found in BigQuery, falling back to Firestore');
        const pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);

        // Also search for users
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
          }
        }

        return NextResponse.json({
          pages,
          users,
          source: "firestore_fallback_after_bigquery_zero_results"
        }, { status: 200 });
      }
    } catch (testError) {
      console.error('Error running BigQuery test query:', testError);
      // Continue with normal query flow
    }


    if (!userId) {
      return NextResponse.json(
        {
          pages: [],
          users: [],
          message: "userId is required"
        },
        { status: 400 }
      );
    }

    // searchTermFormatted is already defined above

    // Skip verification query to reduce BigQuery costs

    // Check if we're filtering by a specific user ID
    const isFilteringByUser = !!filterByUserId;

    // Build the search conditions
    let searchCondition = `
            LOWER(title) LIKE @searchTerm
            OR LOWER(title) LIKE @wordStartPattern
            OR LOWER(title) LIKE @partialWordPattern
            OR LOWER(title) LIKE @wordContainsPattern
          `;

    // Add multi-word search condition if applicable
    if (hasMultipleWords && wordPatterns.length > 0) {
      let multiWordCondition = "OR (";

      wordPatterns.forEach((pattern, index) => {
        const paramName = `wordPattern${index}`;
        multiWordCondition += `\n              LOWER(title) LIKE @${paramName}`;
        if (index < wordPatterns.length - 1) {
          multiWordCondition += " AND";
        }
      });

      multiWordCondition += "\n            )";
      searchCondition += multiWordCondition;

      console.log("Added multi-word condition to combined query:", multiWordCondition);
    }

    // Use a single combined query to reduce BigQuery costs
    const combinedQuery = `
      WITH user_pages AS (
        SELECT
          document_id,
          title,
          userId,
          lastModified,
          'user' as page_type,
          NULL as groupId
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE userId = ${isFilteringByUser ? '@filterByUserId' : '@userId'}
          AND (
            ${searchCondition}
          )
        ORDER BY lastModified DESC
        LIMIT ${isFilteringByUser ? '20' : '10'}
      ),
      ${groupIds.length > 0 ? `
      group_pages AS (
        SELECT
          document_id,
          title,
          userId,
          lastModified,
          'group' as page_type,
          groupId
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE groupId IN UNNEST(@groupIds)
          AND (
            ${searchCondition}
          )
        ORDER BY lastModified DESC
        LIMIT 5
      ),` : ''}
      public_pages AS (
        SELECT
          document_id,
          title,
          userId,
          lastModified,
          'public' as page_type,
          NULL as groupId
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE userId != @userId
          AND (
            ${searchCondition}
          )
          ${groupIds.length > 0 ? `AND document_id NOT IN (
            SELECT document_id
            FROM \`wewrite-ccd82.pages_indexes.pages\`
            WHERE groupId IN UNNEST(@groupIds)
          )` : ''}
        ORDER BY lastModified DESC
        LIMIT 10
      )

      SELECT * FROM user_pages
      ${groupIds.length > 0 && !isFilteringByUser ? 'UNION ALL SELECT * FROM group_pages' : ''}
      ${!isFilteringByUser ? 'UNION ALL SELECT * FROM public_pages' : ''}
    `;

    // Prepare query parameters
    const queryParams = {
      userId: userId,
      ...(isFilteringByUser ? { filterByUserId: filterByUserId } : {}),
      ...(groupIds.length > 0 ? { groupIds: groupIds } : {}),
      searchTerm: searchTermFormatted,
      wordStartPattern: wordStartPattern,
      partialWordPattern: partialWordPattern,
      wordContainsPattern: wordContainsPattern
    };

    const queryTypes = {
      userId: "STRING",
      ...(isFilteringByUser ? { filterByUserId: "STRING" } : {}),
      ...(groupIds.length > 0 ? { groupIds: ['STRING'] } : {}),
      searchTerm: "STRING",
      wordStartPattern: "STRING",
      partialWordPattern: "STRING",
      wordContainsPattern: "STRING"
    };

    // Add word pattern parameters for multi-word searches
    if (hasMultipleWords && wordPatterns.length > 0) {
      wordPatterns.forEach((pattern, index) => {
        const paramName = `wordPattern${index}`;
        queryParams[paramName] = pattern;
        queryTypes[paramName] = "STRING";
      });
    }

    // Execute combined query
    const [combinedResults] = await bigquery.query({
      query: combinedQuery,
      params: queryParams,
      types: queryTypes,
    }).catch(error => {
      console.error("Error executing combined query:", error);
      throw error;
    });

    console.log('Combined query results count:', combinedResults?.length || 0);

    // Separate results by type
    const userRows = combinedResults.filter(row => row.page_type === 'user') || [];
    const groupRows = groupIds.length > 0 ? combinedResults.filter(row => row.page_type === 'group') || [] : [];
    const publicRows = combinedResults.filter(row => row.page_type === 'public') || [];

    try {
      const pages = [];

      // Add user pages to results
      if (userRows && userRows.length > 0) {
        userRows.forEach(row => {
          pages.push({
            id: row.document_id,
            title: row.title,
            isOwned: true, // User owns this page
            isEditable: true, // User can edit this page since they own it
            userId: row.userId,
            lastModified: row.lastModified,
            type: 'user'
          });
        });
      }

      // Add group pages to results
      if (groupRows && groupRows.length > 0) {
        groupRows.forEach(row => {
          pages.push({
            id: row.document_id,
            title: row.title,
            groupId: row.groupId,
            isOwned: row.userId === userId, // If user is the creator of the page
            isEditable: true, // User can edit this page since they're in the group
            userId: row.userId,
            lastModified: row.lastModified,
            type: 'group'
          });
        });
      }

      // Add public pages to results
      if (publicRows && publicRows.length > 0) {
        publicRows.forEach(row => {
          pages.push({
            id: row.document_id,
            title: row.title,
            isOwned: row.userId === userId, // If user is the creator of the page
            isEditable: row.userId === userId, // Only the creator can edit public pages
            userId: row.userId,
            lastModified: row.lastModified,
            type: 'public'
          });
        });
      }

      // Also search for users if we have a search term
      let users = [];
      if (searchTerm && searchTerm.trim().length > 1) {
        try {
          // Search for users with the same search term
          users = await searchUsers(searchTerm, 5);
          console.log(`Found ${users.length} users matching query "${searchTerm}"`);

          // Format users for the response
          users = users.map(user => ({
            id: user.id,
            username: user.username || "Anonymous",
            photoURL: user.photoURL || null,
            type: 'user' // Add a type field to distinguish from pages
          }));
        } catch (userError) {
          console.error('Error searching for users:', userError);
        }
      }

      console.log('Final processed results:', {
        pagesCount: pages.length,
        usersCount: users.length,
        pages,
        users,
        searchTerm,
        searchTermFormatted
      });

      // Return formatted results including users
      return NextResponse.json({ pages, users }, { status: 200 });
    } catch (error) {
      console.error('Error processing query results:', error);
      return NextResponse.json({
        pages: [],
        users: [],
        error: {
          message: error.message,
          details: error.stack
        }
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error querying BigQuery:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: {
        message: error.message,
        details: error.stack
      }
    }, { status: 200 });
  }
}
