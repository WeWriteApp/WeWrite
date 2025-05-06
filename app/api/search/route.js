import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers } from "../../firebase/database";
import { sortSearchResultsByScore } from "../../utils/searchUtils";
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/database';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

// Initialize BigQuery client
let bigquery = null;
try {
  const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;
  if (credentialsEnvVar) {
    console.log('Initializing BigQuery client');

    // Handle potential Base64 encoding
    let jsonString = credentialsEnvVar;
    if (credentialsEnvVar.startsWith('eyJ') || process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true') {
      try {
        const buffer = Buffer.from(credentialsEnvVar, 'base64');
        jsonString = buffer.toString('utf-8');
      } catch (e) {
        console.error('Failed to decode Base64 credentials:', e.message);
      }
    }

    const credentials = JSON.parse(jsonString);
    bigquery = new BigQuery({
      projectId: credentials.project_id,
      credentials,
    });
  }
} catch (error) {
  console.error('Failed to initialize BigQuery:', error.message);
}

// Search pages in Firestore (fallback method)
async function searchPagesInFirestore(userId, searchTerm, groupIds = [], filterByUserId = null) {
  try {
    console.log('Searching pages in Firestore');
    const searchTermLower = searchTerm.toLowerCase().trim();
    const isFilteringByUser = !!filterByUserId;

    // For multi-word searches, split into individual words
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const hasMultipleWords = searchWords.length > 1;

    console.log('Firestore search parameters:', {
      searchTermLower,
      searchWords,
      hasMultipleWords,
      isFilteringByUser
    });

    // Get user's own pages
    const userPagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', isFilteringByUser ? filterByUserId : userId),
      orderBy('lastModified', 'desc'),
      limit(isFilteringByUser ? 30 : 15)
    );

    const userPagesSnapshot = await getDocs(userPagesQuery);
    const userPages = [];

    userPagesSnapshot.forEach(doc => {
      const data = doc.data();
      const title = (data.title || 'Untitled').toLowerCase();

      // For empty search term, include all pages
      if (!searchTermLower) {
        userPages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          isOwned: data.userId === userId,
          isEditable: data.userId === userId,
          userId: data.userId,
          lastModified: data.lastModified,
          type: 'user'
        });
        return;
      }

      // For multi-word searches, check if title contains all words
      if (hasMultipleWords) {
        const containsAllWords = searchWords.every(word => title.includes(word));
        if (containsAllWords) {
          userPages.push({
            id: doc.id,
            title: data.title || 'Untitled',
            isOwned: data.userId === userId,
            isEditable: data.userId === userId,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            containsAllSearchWords: true
          });
        }
      }
      // For single-word searches, check if title includes the search term
      else if (title.includes(searchTermLower)) {
        // Calculate how well the title matches the search term
        const exactMatch = title === searchTermLower;
        const startsWithMatch = title.startsWith(searchTermLower);
        const wordStartsWithMatch = title.split(/\s+/).some(word => word.startsWith(searchTermLower));

        userPages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          isOwned: data.userId === userId,
          isEditable: data.userId === userId,
          userId: data.userId,
          lastModified: data.lastModified,
          type: 'user',
          matchQuality: exactMatch ? 'exact' :
                        startsWithMatch ? 'startsWith' :
                        wordStartsWithMatch ? 'wordStartsWith' : 'contains'
        });
      }
      // Also check if any word in the title starts with the search term
      else {
        const titleWords = title.split(/\s+/);

        // Check if any word in the title starts with the search term
        const anyWordStartsWith = titleWords.some(word => word.startsWith(searchTermLower));

        // Check if search term is a substring of any word in the title (e.g., "road" in "roadmap")
        const isSubstringOfWord = titleWords.some(word => word.includes(searchTermLower));

        // Check if any word in the title is a substring of the search term (e.g., "map" in "roadmap")
        const wordIsSubstring = titleWords.some(word =>
          word.length > 2 && searchTermLower.includes(word)
        );

        if (anyWordStartsWith || isSubstringOfWord || wordIsSubstring) {
          userPages.push({
            id: doc.id,
            title: data.title || 'Untitled',
            isOwned: data.userId === userId,
            isEditable: data.userId === userId,
            userId: data.userId,
            lastModified: data.lastModified,
            type: 'user',
            matchQuality: anyWordStartsWith ? 'wordStartsWith' :
                          isSubstringOfWord ? 'substringMatch' : 'partialMatch'
          });
        }
      }
    });

    // Only get public pages if not filtering by user
    let publicPages = [];
    if (!isFilteringByUser) {
      const publicPagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(30)
      );

      const publicPagesSnapshot = await getDocs(publicPagesQuery);

      publicPagesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId !== userId) {
          const title = (data.title || 'Untitled').toLowerCase();

          // For empty search term, include all pages
          if (!searchTermLower) {
            publicPages.push({
              id: doc.id,
              title: data.title || 'Untitled',
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              isPublic: true,
              type: 'public'
            });
            return;
          }

          // For multi-word searches, check if title contains all words
          if (hasMultipleWords) {
            const containsAllWords = searchWords.every(word => title.includes(word));
            if (containsAllWords) {
              publicPages.push({
                id: doc.id,
                title: data.title || 'Untitled',
                isOwned: false,
                isEditable: false,
                userId: data.userId,
                lastModified: data.lastModified,
                isPublic: true,
                type: 'public',
                containsAllSearchWords: true
              });
            }
          }
          // For single-word searches, check if title includes the search term
          else if (title.includes(searchTermLower)) {
            // Calculate how well the title matches the search term
            const exactMatch = title === searchTermLower;
            const startsWithMatch = title.startsWith(searchTermLower);
            const wordStartsWithMatch = title.split(/\s+/).some(word => word.startsWith(searchTermLower));

            publicPages.push({
              id: doc.id,
              title: data.title || 'Untitled',
              isOwned: false,
              isEditable: false,
              userId: data.userId,
              lastModified: data.lastModified,
              isPublic: true,
              type: 'public',
              matchQuality: exactMatch ? 'exact' :
                           startsWithMatch ? 'startsWith' :
                           wordStartsWithMatch ? 'wordStartsWith' : 'contains'
            });
          }
          // Also check if any word in the title starts with the search term
          else {
            const titleWords = title.split(/\s+/);

            // Check if any word in the title starts with the search term
            const anyWordStartsWith = titleWords.some(word => word.startsWith(searchTermLower));

            // Check if search term is a substring of any word in the title (e.g., "road" in "roadmap")
            const isSubstringOfWord = titleWords.some(word => word.includes(searchTermLower));

            // Check if any word in the title is a substring of the search term (e.g., "map" in "roadmap")
            const wordIsSubstring = titleWords.some(word =>
              word.length > 2 && searchTermLower.includes(word)
            );

            if (anyWordStartsWith || isSubstringOfWord || wordIsSubstring) {
              publicPages.push({
                id: doc.id,
                title: data.title || 'Untitled',
                isOwned: false,
                isEditable: false,
                userId: data.userId,
                lastModified: data.lastModified,
                isPublic: true,
                type: 'public',
                matchQuality: anyWordStartsWith ? 'wordStartsWith' :
                              isSubstringOfWord ? 'substringMatch' : 'partialMatch'
              });
            }
          }
        }
      });
    }

    // Return combined results
    return isFilteringByUser ? userPages : [...userPages, ...publicPages.slice(0, 10)];
  } catch (error) {
    console.error('Error searching in Firestore:', error);
    return [];
  }
}

// Check which pages are public in Firestore
async function checkPublicPagesInFirestore(pageIds) {
  try {
    const publicPages = [];

    // Process in batches of 10 (Firestore limit for 'in' queries)
    const batchSize = 10;
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batchIds = pageIds.slice(i, i + batchSize);

      try {
        const publicPagesQuery = query(
          collection(db, 'pages'),
          where('isPublic', '==', true),
          where('__name__', 'in', batchIds)
        );

        const snapshot = await getDocs(publicPagesQuery);
        snapshot.forEach(doc => {
          publicPages.push(doc.id);
        });
      } catch (error) {
        console.error(`Error checking batch ${i/batchSize + 1}:`, error);
      }
    }

    return publicPages;
  } catch (error) {
    console.error('Error checking public pages:', error);
    return [];
  }
}

// Main search function
export async function GET(request) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const filterByUserId = searchParams.get("filterByUserId");
    const groupIds = searchParams.get("groupIds")
      ? searchParams.get("groupIds").split(",").filter(id => id && id.trim().length > 0)
      : [];
    const searchTerm = searchParams.get("searchTerm") || "";
    const useScoring = searchParams.get("useScoring") !== "false";

    // Validate userId
    if (!userId) {
      return NextResponse.json(
        { pages: [], users: [], message: "userId is required" },
        { status: 400 }
      );
    }

    // Format search term for BigQuery - use a more flexible pattern to catch more matches
    const searchTermLower = searchTerm.toLowerCase().trim();
    // Use a more flexible pattern that will match anywhere in the title
    // The double % makes it match anywhere in the string, improving results for partial matches
    const searchTermFormatted = searchTerm
      ? `%${searchTermLower}%`
      : "%";

    // For better matching of terms like "road" in "roadmap", also create a pattern with just the first part
    const partialSearchTerm = searchTermLower.length > 2
      ? `%${searchTermLower.substring(0, Math.ceil(searchTermLower.length * 0.7))}%`
      : searchTermFormatted;

    // For multi-word search terms, create individual word patterns
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
    const hasMultipleWords = searchWords.length > 1;

    // Create more flexible patterns for each word to improve matching
    const searchWordPatterns = searchWords.map(word => {
      // Always use a flexible pattern to match anywhere in the title
      return `%${word}%`;
    });

    console.log('Search parameters:', {
      searchTerm,
      searchTermLower,
      searchTermFormatted,
      searchWords,
      hasMultipleWords
    });

    // Check if we're filtering by a specific user
    const isFilteringByUser = !!filterByUserId;

    let pages = [];
    let source = "";

    // Try BigQuery first if available
    if (bigquery) {
      try {
        console.log('Attempting to search with BigQuery');

        // Use a query that includes the isPublic field for proper filtering
        // For multi-word searches, we'll use a more complex query that checks for all words
        const simplifiedQuery = `
          WITH user_pages AS (
            SELECT
              document_id,
              title,
              userId,
              lastModified,
              'user' as page_type,
              NULL as groupId,
              isPublic
            FROM \`wewrite-ccd82.pages_indexes.pages\`
            WHERE userId = ${isFilteringByUser ? '@filterByUserId' : '@userId'}
              ${hasMultipleWords ?
                // For multi-word searches, check that title contains all words
                searchWords.map((_, i) => `AND LOWER(title) LIKE @searchWord${i}`).join('\n              ')
                :
                // For single-word searches, use both the original pattern and partial pattern
                'AND (LOWER(title) LIKE @searchTerm OR LOWER(title) LIKE @partialSearchTerm)'
              }
            ORDER BY lastModified DESC
            LIMIT ${isFilteringByUser ? '30' : '15'}
          ),
          ${groupIds.length > 0 ? `
          group_pages AS (
            SELECT
              document_id,
              title,
              userId,
              lastModified,
              'group' as page_type,
              groupId,
              isPublic
            FROM \`wewrite-ccd82.pages_indexes.pages\`
            WHERE groupId IN UNNEST(@groupIds)
              ${hasMultipleWords ?
                // For multi-word searches, check that title contains all words
                searchWords.map((_, i) => `AND LOWER(title) LIKE @searchWord${i}`).join('\n              ')
                :
                // For single-word searches, use both the original pattern and partial pattern
                'AND (LOWER(title) LIKE @searchTerm OR LOWER(title) LIKE @partialSearchTerm)'
              }
            ORDER BY lastModified DESC
            LIMIT 10
          ),` : ''}
          other_pages AS (
            SELECT
              document_id,
              title,
              userId,
              lastModified,
              'other' as page_type,
              NULL as groupId,
              isPublic
            FROM \`wewrite-ccd82.pages_indexes.pages\`
            WHERE userId != @userId
              ${hasMultipleWords ?
                // For multi-word searches, check that title contains all words
                searchWords.map((_, i) => `AND LOWER(title) LIKE @searchWord${i}`).join('\n              ')
                :
                // For single-word searches, use both the original pattern and partial pattern
                'AND (LOWER(title) LIKE @searchTerm OR LOWER(title) LIKE @partialSearchTerm)'
              }
              AND isPublic = true
              ${groupIds.length > 0 ? `AND document_id NOT IN (
                SELECT document_id
                FROM \`wewrite-ccd82.pages_indexes.pages\`
                WHERE groupId IN UNNEST(@groupIds)
              )` : ''}
            ORDER BY lastModified DESC
            LIMIT 30
          )

          SELECT * FROM user_pages
          ${groupIds.length > 0 && !isFilteringByUser ? 'UNION ALL SELECT * FROM group_pages' : ''}
          ${!isFilteringByUser ? 'UNION ALL SELECT * FROM other_pages' : ''}
        `;

        // Build query parameters
        const queryParams = {
          userId: userId,
          ...(isFilteringByUser ? { filterByUserId: filterByUserId } : {}),
          ...(groupIds.length > 0 ? { groupIds: groupIds } : {})
        };

        // Add search term parameters
        if (hasMultipleWords) {
          // Add individual word patterns for multi-word searches
          searchWordPatterns.forEach((pattern, index) => {
            queryParams[`searchWord${index}`] = pattern;
          });
        } else {
          // Use both the original pattern and partial pattern for single-word searches
          queryParams.searchTerm = searchTermFormatted;
          queryParams.partialSearchTerm = partialSearchTerm;
        }

        // Build parameter types
        const paramTypes = {
          userId: "STRING",
          ...(isFilteringByUser ? { filterByUserId: "STRING" } : {}),
          ...(groupIds.length > 0 ? { groupIds: ['STRING'] } : {})
        };

        // Add search term parameter types
        if (hasMultipleWords) {
          // Add types for individual word patterns
          searchWordPatterns.forEach((_, index) => {
            paramTypes[`searchWord${index}`] = "STRING";
          });
        } else {
          // Use types for both the original and partial search terms
          paramTypes.searchTerm = "STRING";
          paramTypes.partialSearchTerm = "STRING";
        }

        console.log('BigQuery parameters:', queryParams);

        // Execute query
        const [results] = await bigquery.query({
          query: simplifiedQuery,
          params: queryParams,
          types: paramTypes
        });

        console.log(`BigQuery returned ${results.length} results`);

        // Process user pages
        const userRows = results.filter(row => row.page_type === 'user') || [];
        const groupRows = groupIds.length > 0 ? results.filter(row => row.page_type === 'group') || [] : [];
        const otherRows = results.filter(row => row.page_type === 'other') || [];

        // Add user pages to results
        userRows.forEach(row => {
          pages.push({
            id: row.document_id,
            title: row.title,
            isOwned: true,
            isEditable: true,
            userId: row.userId,
            lastModified: row.lastModified,
            type: 'user',
            isPublic: row.isPublic === true
          });
        });

        // Add group pages to results
        groupRows.forEach(row => {
          pages.push({
            id: row.document_id,
            title: row.title,
            groupId: row.groupId,
            isOwned: row.userId === userId,
            isEditable: true,
            userId: row.userId,
            lastModified: row.lastModified,
            type: 'group',
            isPublic: row.isPublic === true
          });
        });

        // Add other pages that are public directly from BigQuery results
        if (otherRows.length > 0) {
          console.log(`Processing ${otherRows.length} other pages from BigQuery`);

          // Add all public pages from the results
          otherRows.forEach(row => {
            if (row.isPublic === true) {
              pages.push({
                id: row.document_id,
                title: row.title,
                isOwned: row.userId === userId,
                isEditable: row.userId === userId,
                userId: row.userId,
                lastModified: row.lastModified,
                type: 'public',
                isPublic: true
              });
            }
          });

          console.log(`Added ${pages.filter(p => p.type === 'public').length} public pages to results`);
        }

        source = "bigquery";
      } catch (error) {
        console.error('BigQuery search failed:', error);
        // Fall back to Firestore
        pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);
        source = "firestore_fallback";
      }
    } else {
      // BigQuery not available, use Firestore
      pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);
      source = "firestore_only";
    }

    // Search for users if we have a search term
    let users = [];
    if (searchTerm && searchTerm.trim().length > 1) {
      try {
        users = await searchUsers(searchTerm, 5);
        users = users.map(user => ({
          id: user.id,
          username: user.username || "Anonymous",
          photoURL: user.photoURL || null,
          type: 'user'
        }));
      } catch (error) {
        console.error('Error searching for users:', error);
      }
    }

    // Apply scoring if enabled
    if (useScoring && searchTerm) {
      const sortedPages = sortSearchResultsByScore(pages, searchTerm);
      const sortedUsers = sortSearchResultsByScore(users, searchTerm);

      return NextResponse.json({
        pages: sortedPages,
        users: sortedUsers,
        source
      }, { status: 200 });
    } else {
      return NextResponse.json({
        pages,
        users,
        source
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Search error:', error);
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
