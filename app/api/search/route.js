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

// Fallback function to search pages in Firestore when BigQuery is not available
async function searchPagesInFirestore(userId, searchTerm, groupIds = [], filterByUserId = null) {
  try {
    console.log(`Using Firestore fallback for page search with term: "${searchTerm}"`);

    // Get user's group memberships for access control
    const userGroupIds = userId ? await getUserGroupMemberships(userId) : [];
    const groupsData = userGroupIds.length > 0 ? await getGroupsData(userGroupIds) : {};

    console.log(`User ${userId} is member of ${userGroupIds.length} groups`);

    // IMPORTANT FIX: Handle empty search terms
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term provided to Firestore fallback, fetching recent accessible pages');

      // For empty search terms, return recent accessible pages instead of empty results
      try {
        // Import Firestore modules dynamically
        const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase/database');

        const recentPages = [];

        // Get user's own recent pages (always accessible)
        if (userId) {
          const userPagesQuery = query(
            collection(db, 'pages'),
            where('userId', '==', userId),
            orderBy('lastModified', 'desc'),
            limit(10)
          );

          const userPagesSnapshot = await getDocs(userPagesQuery);
          userPagesSnapshot.forEach(doc => {
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
        }

        // Get recent public pages (accessible to everyone)
        const publicPagesQuery = query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          where('groupId', '==', null), // Only standalone public pages
          orderBy('lastModified', 'desc'),
          limit(5)
        );

        const publicPagesSnapshot = await getDocs(publicPagesQuery);
        publicPagesSnapshot.forEach(doc => {
          const data = doc.data();
          // Skip user's own pages (already included above)
          if (data.userId !== userId) {
            recentPages.push({
              id: doc.id,
              title: data.title || 'Untitled',
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'public'
            });
          }
        });

        console.log(`Found ${recentPages.length} recent accessible pages for empty search term`);
        return recentPages;
      } catch (error) {
        console.error('Error fetching recent pages:', error);
        return [];
      }
    }

    // Import Firestore modules dynamically
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');
    const { containsAllSearchWords, sortSearchResultsByScore, extractTextFromSlateContent } = await import('../../utils/searchUtils');

    // Format search term for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase().trim();
    console.log(`Normalized search term: "${searchTermLower}"`);

    // IMPORTANT FIX: Log more details about the search
    console.log('Firestore search details:', {
      searchTermLower,
      searchTermLength: searchTermLower.length,
      userId,
      filterByUserId,
      groupIds: groupIds.length,
      userGroupIds: userGroupIds.length
    });

    // For multi-word searches, split into individual words
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const hasMultipleWords = searchWords.length > 1;
    console.log(`Search words: ${JSON.stringify(searchWords)}, hasMultipleWords: ${hasMultipleWords}`);

    // Log the search strategy
    if (hasMultipleWords) {
      console.log(`Using improved multi-word search strategy for "${searchTermLower}" with words: ${JSON.stringify(searchWords)}`);
    } else {
      console.log(`Using improved single-word search strategy for "${searchTermLower}"`);
    }

    // Determine if we should filter by a specific user ID
    const isFilteringByUser = !!filterByUserId;

    // Initialize results array
    const allResults = [];

    // Helper function to check if user has access to a page
    const hasPageAccess = (pageData) => {
      // User always has access to their own pages
      if (userId && pageData.userId === userId) {
        return true;
      }

      // If page belongs to a group, check group access
      if (pageData.groupId) {
        const groupData = groupsData[pageData.groupId];
        if (!groupData) {
          // Group doesn't exist, deny access
          return false;
        }

        // If group is public, everyone has access
        if (groupData.isPublic) {
          return true;
        }

        // If group is private, only members have access
        return userId && userGroupIds.includes(pageData.groupId);
      }

      // For pages not in groups, only public pages are accessible to non-owners
      return pageData.isPublic;
    };

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

    // Log some sample page titles to understand what's in the database
    if (userPagesSnapshot.size > 0) {
      console.log('Sample user page titles:');
      let sampleCount = 0;
      userPagesSnapshot.forEach(doc => {
        if (sampleCount < 5) {
          const data = doc.data();
          console.log(`  - "${data.title || 'Untitled'}" (ID: ${doc.id})`);
          sampleCount++;
        }
      });
    } else {
      console.log('No user pages found in database for user:', isFilteringByUser ? filterByUserId : userId);
    }

    // Process user's pages
    let userPagesProcessed = 0;
    userPagesSnapshot.forEach(doc => {
      userPagesProcessed++;
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

      // For multi-word searches, try both strict (all words) and flexible (any word) matching
      if (hasMultipleWords) {
        console.log(`Checking if user page "${pageTitle}" contains words from "${searchTermLower}"`);

        // First try strict matching (all words must be present)
        const titleMatchResult = containsAllSearchWords(pageTitle, searchTermLower);

        // Then check the content if available
        let contentMatchResult = { match: false, type: 'none' };
        if (data.content && Array.isArray(data.content)) {
          try {
            const contentText = extractTextFromSlateContent(data.content);
            contentMatchResult = containsAllSearchWords(contentText, searchTermLower);
          } catch (error) {
            console.error('Error extracting text from content:', error);
          }
        }

        // Check for strict match first (all words)
        if (titleMatchResult.match || contentMatchResult.match) {
          console.log(`✅ User page strict match: "${pageTitle}" contains all words in "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            matchType: titleMatchResult.match ? titleMatchResult.type : `content_${contentMatchResult.type}`,
            matchScore: 100, // Highest score for exact matches
            matchLocation: titleMatchResult.match ? 'title' : 'content'
          });
          return;
        }

        // If no strict match, try flexible matching (any word)
        const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
        let foundAnyWord = false;
        let matchScore = 0;

        for (const word of searchWords) {
          if (normalizedTitle.includes(word)) {
            foundAnyWord = true;
            matchScore += 50; // Points for each word found
            console.log(`✅ Found word "${word}" in title "${pageTitle}"`);
          }
        }

        if (foundAnyWord) {
          console.log(`✅ User page partial match: "${pageTitle}" contains some words from "${searchTermLower}"`);
          allResults.push({
            id: doc.id,
            title: pageTitle,
            isOwned: true,
            isEditable: true,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            matchType: 'partial_word_match',
            matchScore: matchScore,
            matchLocation: 'title'
          });
          return;
        }
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
          type: 'user',
          matchType: 'title_contains',
          matchScore: 90,
          matchLocation: 'title'
        });
        return;
      }

      // For single-word searches, also check content
      if (data.content && Array.isArray(data.content)) {
        try {
          const contentText = extractTextFromSlateContent(data.content);
          if (contentText.toLowerCase().includes(searchTermLower)) {
            console.log(`User page match (content): "${pageTitle}" content contains "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: true,
              isEditable: true,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'user',
              matchType: 'content_contains',
              matchScore: 80,
              matchLocation: 'content'
            });
            return;
          }
        } catch (error) {
          console.error('Error extracting text from content for single-word search:', error);
        }
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
            matchType: 'partial_word',
            matchScore: 75,
            matchLocation: 'title'
          });
          return;
        }
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
            matchType: 'word_start',
            matchScore: 85,
            matchLocation: 'title'
          });
          return;
        }
      }
    });

    console.log(`Processed ${userPagesProcessed} user pages, found ${allResults.filter(r => r.type === 'user').length} matching results`);

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

      // Log some sample public page titles
      if (publicPagesSnapshot.size > 0) {
        console.log('Sample public page titles:');
        let sampleCount = 0;
        publicPagesSnapshot.forEach(doc => {
          if (sampleCount < 5) {
            const data = doc.data();
            console.log(`  - "${data.title || 'Untitled'}" (ID: ${doc.id}, userId: ${data.userId})`);
            sampleCount++;
          }
        });
      } else {
        console.log('No public pages found in database');
      }

      // Process public pages with access control
      publicPagesSnapshot.forEach(doc => {
        const data = doc.data();

        // Skip user's own pages (already included above)
        if (data.userId === userId) {
          return;
        }

        // Apply access control filtering
        if (!hasPageAccess(data)) {
          console.log(`Access denied to page ${doc.id} for user ${userId}`);
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

        // For multi-word searches, try both strict (all words) and flexible (any word) matching
        if (hasMultipleWords) {
          console.log(`Checking if public page "${pageTitle}" contains words from "${searchTermLower}"`);

          // First try strict matching (all words must be present)
          const titleMatchResult = containsAllSearchWords(pageTitle, searchTermLower);

          // Then check the content if available
          let contentMatchResult = { match: false, type: 'none' };
          if (data.content && Array.isArray(data.content)) {
            try {
              const contentText = extractTextFromSlateContent(data.content);
              contentMatchResult = containsAllSearchWords(contentText, searchTermLower);
            } catch (error) {
              console.error('Error extracting text from content:', error);
            }
          }

          // Check for strict match first (all words)
          if (titleMatchResult.match || contentMatchResult.match) {
            console.log(`✅ Public page strict match: "${pageTitle}" contains all words in "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'public',
              matchType: titleMatchResult.match ? titleMatchResult.type : `content_${contentMatchResult.type}`,
              matchScore: 100, // Highest score for exact matches
              matchLocation: titleMatchResult.match ? 'title' : 'content'
            });
            return;
          }

          // If no strict match, try flexible matching (any word)
          const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
          let foundAnyWord = false;
          let matchScore = 0;

          for (const word of searchWords) {
            if (normalizedTitle.includes(word)) {
              foundAnyWord = true;
              matchScore += 50; // Points for each word found
              console.log(`✅ Found word "${word}" in title "${pageTitle}"`);
            }
          }

          if (foundAnyWord) {
            console.log(`✅ Public page partial match: "${pageTitle}" contains some words from "${searchTermLower}"`);
            allResults.push({
              id: doc.id,
              title: pageTitle,
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              type: 'public',
              matchType: 'partial_word_match',
              matchScore: matchScore,
              matchLocation: 'title'
            });
            return;
          }
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
            type: 'public',
            matchType: 'title_contains',
            matchScore: 90,
            matchLocation: 'title'
          });
          return;
        }

        // For single-word searches, also check content
        if (data.content && Array.isArray(data.content)) {
          try {
            const contentText = extractTextFromSlateContent(data.content);
            if (contentText.toLowerCase().includes(searchTermLower)) {
              console.log(`Public page match (content): "${pageTitle}" content contains "${searchTermLower}"`);
              allResults.push({
                id: doc.id,
                title: pageTitle,
                isOwned: false,
                isEditable: false,
                userId: data.userId,
                lastModified: data.lastModified,
                type: 'public',
                matchType: 'content_contains',
                matchScore: 80,
                matchLocation: 'content'
              });
              return;
            }
          } catch (error) {
            console.error('Error extracting text from content for single-word search:', error);
          }
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
              matchType: 'partial_word',
              matchScore: 75,
              matchLocation: 'title'
            });
            return;
          }
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
              matchType: 'word_start',
              matchScore: 85,
              matchLocation: 'title'
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

        // Process group pages with access control
        groupPagesSnapshot.forEach(doc => {
          const data = doc.data();

          // Apply access control filtering
          if (!hasPageAccess(data)) {
            console.log(`Access denied to group page ${doc.id} for user ${userId}`);
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
              isOwned: data.userId === userId,
              isEditable: true, // User can edit group pages
              userId: data.userId,
              groupId: data.groupId,
              lastModified: data.lastModified,
              type: 'group'
            });
            return;
          }

          // For multi-word searches, try both strict (all words) and flexible (any word) matching
          if (hasMultipleWords) {
            console.log(`Checking if group page "${pageTitle}" contains words from "${searchTermLower}"`);

            // First try strict matching (all words must be present)
            const titleMatchResult = containsAllSearchWords(pageTitle, searchTermLower);

            // Then check the content if available
            let contentMatchResult = { match: false, type: 'none' };
            if (data.content && Array.isArray(data.content)) {
              try {
                const contentText = extractTextFromSlateContent(data.content);
                contentMatchResult = containsAllSearchWords(contentText, searchTermLower);
              } catch (error) {
                console.error('Error extracting text from content:', error);
              }
            }

            // Check for strict match first (all words)
            if (titleMatchResult.match || contentMatchResult.match) {
              console.log(`✅ Group page strict match: "${pageTitle}" contains all words in "${searchTermLower}"`);
              allResults.push({
                id: doc.id,
                title: pageTitle,
                isOwned: data.userId === userId,
                isEditable: true,
                userId: data.userId,
                groupId: data.groupId,
                lastModified: data.lastModified,
                type: 'group',
                matchType: titleMatchResult.match ? titleMatchResult.type : `content_${contentMatchResult.type}`,
                matchScore: 100, // Highest score for exact matches
                matchLocation: titleMatchResult.match ? 'title' : 'content'
              });
              return;
            }

            // If no strict match, try flexible matching (any word)
            const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
            let foundAnyWord = false;
            let matchScore = 0;

            for (const word of searchWords) {
              if (normalizedTitle.includes(word)) {
                foundAnyWord = true;
                matchScore += 50; // Points for each word found
                console.log(`✅ Found word "${word}" in title "${pageTitle}"`);
              }
            }

            if (foundAnyWord) {
              console.log(`✅ Group page partial match: "${pageTitle}" contains some words from "${searchTermLower}"`);
              allResults.push({
                id: doc.id,
                title: pageTitle,
                isOwned: data.userId === userId,
                isEditable: true,
                userId: data.userId,
                groupId: data.groupId,
                lastModified: data.lastModified,
                type: 'group',
                matchType: 'partial_word_match',
                matchScore: matchScore,
                matchLocation: 'title'
              });
              return;
            }
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
              type: 'group',
              matchType: 'title_contains',
              matchScore: 90,
              matchLocation: 'title'
            });
            return;
          }

          // For single-word searches, also check content
          if (data.content && Array.isArray(data.content)) {
            try {
              const contentText = extractTextFromSlateContent(data.content);
              if (contentText.toLowerCase().includes(searchTermLower)) {
                console.log(`Group page match (content): "${pageTitle}" content contains "${searchTermLower}"`);
                allResults.push({
                  id: doc.id,
                  title: pageTitle,
                  isOwned: data.userId === userId,
                  isEditable: true,
                  userId: data.userId,
                  groupId: data.groupId,
                  lastModified: data.lastModified,
                  type: 'group',
                  matchType: 'content_contains',
                  matchScore: 80,
                  matchLocation: 'content'
                });
                return;
              }
            } catch (error) {
              console.error('Error extracting text from content for single-word search:', error);
            }
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
                matchType: 'partial_word',
                matchScore: 75,
                matchLocation: 'title'
              });
              return;
            }
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
                matchType: 'word_start',
                matchScore: 85,
                matchLocation: 'title'
              });
              return;
            }
          }
        });
      }
    }

    // Use our improved search scoring and sorting
    const scoredResults = sortSearchResultsByScore(allResults, searchTermLower);

    console.log(`Firestore search found ${scoredResults.length} total matches for "${searchTermLower}"`);

    // Log the top 5 results with their scores and match types
    if (scoredResults.length > 0) {
      console.log('Top 5 search results:');
      scoredResults.slice(0, 5).forEach((result, index) => {
        console.log(`  ${index + 1}. "${result.title}" - Score: ${result.matchScore}, Match Type: ${result.matchType}`);
      });
    }

    // Return all results (limit to reasonable number)
    return scoredResults.slice(0, 50);
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
