import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers } from "../../firebase/database";
import { sortSearchResultsByScore } from "../../utils/searchUtils";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

let bigquery = null;

// Only try to initialize BigQuery if we have credentials
const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;
if (credentialsEnvVar) {
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

    // Check if the pages_indexes dataset exists
    const pagesIndexesDataset = datasets.find(d => d.id === 'pages_indexes');
    if (!pagesIndexesDataset) {
      console.warn('pages_indexes dataset not found in BigQuery');
    } else {
      // Check the schema of the pages table
      try {
        const [tables] = await bigquery.dataset('pages_indexes').getTables();
        console.log('Tables in pages_indexes:', tables.map(t => t.id));

        const pagesTable = tables.find(t => t.id === 'pages');
        if (pagesTable) {
          const [metadata] = await pagesTable.getMetadata();
          const schema = metadata.schema.fields;
          console.log('Pages table schema:', schema.map(f => f.name));

          // Check if isPublic field exists
          const hasIsPublicField = schema.some(f => f.name === 'isPublic');
          console.log('isPublic field exists in schema:', hasIsPublicField);
        } else {
          console.warn('pages table not found in pages_indexes dataset');
        }
      } catch (schemaError) {
        console.error('Error checking table schema:', schemaError);
      }
    }

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
    console.log('Using Firestore fallback for page search');

    // Import Firestore modules dynamically
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../firebase/database');

    // Format search term for case-insensitive search
    const searchTermLower = searchTerm.toLowerCase().trim();

    // Determine if we should filter by a specific user ID
    const isFilteringByUser = !!filterByUserId;

    // Get pages based on filtering criteria
    let pagesQuery;
    if (isFilteringByUser) {
      // If filtering by specific user, only get that user's pages
      pagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', filterByUserId),
        orderBy('lastModified', 'desc'),
        limit(20)
      );
    } else {
      // Otherwise get the current user's pages
      pagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        orderBy('lastModified', 'desc'),
        limit(10)
      );
    }

    const pagesSnapshot = await getDocs(pagesQuery);

    // Filter pages by title client-side (Firestore doesn't support LIKE queries)
    const userPages = [];
    pagesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!searchTermLower || data.title.toLowerCase().includes(searchTermLower)) {
        userPages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          isOwned: data.userId === userId,
          isEditable: data.userId === userId,
          userId: data.userId,
          lastModified: data.lastModified,
          type: 'user'
        });
      }
    });

    // Only get public pages if we're not filtering by a specific user
    let publicPages = [];
    if (!isFilteringByUser) {
      // Explicitly query only for public pages
      const publicPagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true), // Only get public pages
        orderBy('lastModified', 'desc'),
        limit(20)
      );

      const publicPagesSnapshot = await getDocs(publicPagesQuery);

      // Filter public pages by title and exclude user's own pages
      publicPagesSnapshot.forEach(doc => {
        const data = doc.data();
        // Double-check that the page is actually public
        if (data.isPublic === true &&
            data.userId !== userId &&
            (!searchTermLower || data.title.toLowerCase().includes(searchTermLower))) {
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
        }
      });
    }

    // Combine and return results
    return isFilteringByUser ? userPages : [...userPages, ...publicPages.slice(0, 10)];
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
    const useScoring = searchParams.get("useScoring") !== "false"; // Default to true

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

      // Apply scoring if enabled
      if (useScoring && searchTerm) {
        const sortedPages = sortSearchResultsByScore(pages, searchTerm);
        const sortedUsers = sortSearchResultsByScore(users, searchTerm);

        return NextResponse.json({
          pages: sortedPages,
          users: sortedUsers,
          source: "firestore_fallback"
        }, { status: 200 });
      } else {
        return NextResponse.json({
          pages,
          users,
          source: "firestore_fallback"
        }, { status: 200 });
      }
    }

    // Test BigQuery connection first
    const isConnected = await testBigQueryConnection();
    if (!isConnected) {
      console.log('BigQuery connection failed, returning empty results');
      return NextResponse.json({
        pages: [],
        users: [],
        error: {
          type: "bigquery_connection_failed",
          details: "Failed to connect to BigQuery"
        }
      }, { status: 200 });
    }

    // Ensure searchTerm is properly handled if not provided
    const searchTermFormatted = searchTerm
      ? `%${searchTerm.toLowerCase().trim()}%`
      : "%";

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
          AND LOWER(title) LIKE @searchTerm
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
          AND LOWER(title) LIKE @searchTerm
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
          -- Note: isPublic field doesn't exist in BigQuery schema
          -- We'll filter private pages after retrieving results
          AND LOWER(title) LIKE @searchTerm
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

    // Log the query for debugging
    console.log('Executing BigQuery query:', {
      query: combinedQuery,
      params: {
        userId: userId,
        ...(isFilteringByUser ? { filterByUserId: filterByUserId } : {}),
        ...(groupIds.length > 0 ? { groupIds: groupIds } : {}),
        searchTerm: searchTermFormatted
      }
    });

    // Execute combined query
    const [combinedResults] = await bigquery.query({
      query: combinedQuery,
      params: {
        userId: userId,
        ...(isFilteringByUser ? { filterByUserId: filterByUserId } : {}),
        ...(groupIds.length > 0 ? { groupIds: groupIds } : {}),
        searchTerm: searchTermFormatted
      },
      types: {
        userId: "STRING",
        ...(isFilteringByUser ? { filterByUserId: "STRING" } : {}),
        ...(groupIds.length > 0 ? { groupIds: ['STRING'] } : {}),
        searchTerm: "STRING"
      },
    }).catch(error => {
      console.error("Error executing combined query:", error);
      console.error("Query details:", {
        query: combinedQuery,
        params: {
          userId: userId,
          ...(isFilteringByUser ? { filterByUserId: filterByUserId } : {}),
          ...(groupIds.length > 0 ? { groupIds: groupIds } : {}),
          searchTerm: searchTermFormatted
        }
      });
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
        console.log(`Found ${publicRows.length} potential public pages in BigQuery, checking in Firestore...`);

        try {
          // We need to check if each page is actually public since we can't filter by isPublic in BigQuery
          // We'll use the Firestore fallback to check this
          const { getDoc, doc, getDocs, query, collection, where } = await import('firebase/firestore');
          const { db } = await import('../../firebase/database');

          // Get all document IDs from the public rows
          const docIds = publicRows.map(row => row.document_id);
          console.log('Document IDs to check:', docIds);

          // Create a lookup map for the BigQuery results
          const rowsMap = {};
          publicRows.forEach(row => {
            rowsMap[row.document_id] = row;
          });

          // Batch approach: Query Firestore for all public pages with these IDs
          // This is more efficient than individual document lookups
          const batchSize = 10; // Firestore 'in' query supports up to 10 values
          const publicPages = [];

          // Process in batches of 10 (Firestore limit for 'in' queries)
          for (let i = 0; i < docIds.length; i += batchSize) {
            const batchIds = docIds.slice(i, i + batchSize);

            try {
              // Query for public pages in this batch
              const publicPagesQuery = query(
                collection(db, 'pages'),
                where('isPublic', '==', true),
                where('__name__', 'in', batchIds)
              );

              const publicPagesSnapshot = await getDocs(publicPagesQuery);
              console.log(`Found ${publicPagesSnapshot.size} public pages in batch ${i/batchSize + 1}`);

              // Add each public page to the results
              publicPagesSnapshot.forEach(doc => {
                const data = doc.data();
                const row = rowsMap[doc.id];

                if (row) {
                  publicPages.push({
                    id: doc.id,
                    title: row.title || data.title || 'Untitled',
                    isOwned: row.userId === userId, // If user is the creator of the page
                    isEditable: row.userId === userId, // Only the creator can edit public pages
                    userId: row.userId,
                    lastModified: row.lastModified || data.lastModified,
                    type: 'public',
                    isPublic: true
                  });
                }
              });
            } catch (batchError) {
              console.error(`Error processing batch ${i/batchSize + 1}:`, batchError);
            }
          }

          // Add the public pages to the results
          pages.push(...publicPages);
          console.log(`Added ${publicPages.length} verified public pages to results`);
        } catch (error) {
          console.error('Error checking public pages in Firestore:', error);
          // If there's an error checking public pages, just add all the public rows
          // This ensures we don't completely break search if Firestore check fails
          console.log('Falling back to adding all potential public pages without verification');
          publicRows.forEach(row => {
            pages.push({
              id: row.document_id,
              title: row.title,
              isOwned: row.userId === userId,
              isEditable: row.userId === userId,
              userId: row.userId,
              lastModified: row.lastModified,
              type: 'public',
              // Mark as potentially public since we couldn't verify
              potentiallyPublic: true
            });
          });
        }
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

      // Apply scoring if enabled
      if (useScoring && searchTerm) {
        const sortedPages = sortSearchResultsByScore(pages, searchTerm);
        const sortedUsers = sortSearchResultsByScore(users, searchTerm);

        return NextResponse.json({
          pages: sortedPages,
          users: sortedUsers
        }, { status: 200 });
      } else {
        // Return formatted results including users without scoring
        return NextResponse.json({ pages, users }, { status: 200 });
      }
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

    // If BigQuery fails, try the Firestore fallback
    console.log('Attempting Firestore fallback after BigQuery error');
    try {
      // Check if this is specifically an isPublic field error
      const isPublicFieldError = error.message && error.message.includes('Unrecognized name: isPublic');

      if (isPublicFieldError) {
        console.log('Detected missing isPublic field error, using modified BigQuery query');

        try {
          // Try again with a modified query that doesn't use isPublic
          const modifiedQuery = `
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
                AND LOWER(title) LIKE @searchTerm
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
                AND LOWER(title) LIKE @searchTerm
              ORDER BY lastModified DESC
              LIMIT 5
            ),` : ''}
            other_pages AS (
              SELECT
                document_id,
                title,
                userId,
                lastModified,
                'other' as page_type,
                NULL as groupId
              FROM \`wewrite-ccd82.pages_indexes.pages\`
              WHERE userId != @userId
                AND LOWER(title) LIKE @searchTerm
                ${groupIds.length > 0 ? `AND document_id NOT IN (
                  SELECT document_id
                  FROM \`wewrite-ccd82.pages_indexes.pages\`
                  WHERE groupId IN UNNEST(@groupIds)
                )` : ''}
              ORDER BY lastModified DESC
              LIMIT 20
            )

            SELECT * FROM user_pages
            ${groupIds.length > 0 && !isFilteringByUser ? 'UNION ALL SELECT * FROM group_pages' : ''}
            ${!isFilteringByUser ? 'UNION ALL SELECT * FROM other_pages' : ''}
          `;

          console.log('Executing modified BigQuery query without isPublic field');

          // Execute modified query
          const [modifiedResults] = await bigquery.query({
            query: modifiedQuery,
            params: {
              userId: userId,
              ...(isFilteringByUser ? { filterByUserId: filterByUserId } : {}),
              ...(groupIds.length > 0 ? { groupIds: groupIds } : {}),
              searchTerm: searchTermFormatted
            },
            types: {
              userId: "STRING",
              ...(isFilteringByUser ? { filterByUserId: "STRING" } : {}),
              ...(groupIds.length > 0 ? { groupIds: ['STRING'] } : {}),
              searchTerm: "STRING"
            },
          });

          console.log('Modified query results count:', modifiedResults?.length || 0);

          // Separate results by type
          const userRows = modifiedResults.filter(row => row.page_type === 'user') || [];
          const groupRows = groupIds.length > 0 ? modifiedResults.filter(row => row.page_type === 'group') || [] : [];
          const otherRows = modifiedResults.filter(row => row.page_type === 'other') || [];

          // Process results
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

          // For other pages, we need to check in Firestore which ones are public
          if (otherRows && otherRows.length > 0) {
            console.log(`Found ${otherRows.length} potential public pages, checking in Firestore...`);

            try {
              // Import Firestore modules
              const { getDocs, query, collection, where } = await import('firebase/firestore');
              const { db } = await import('../../firebase/database');

              // Get all document IDs from the other rows
              const docIds = otherRows.map(row => row.document_id);

              // Create a lookup map for the BigQuery results
              const rowsMap = {};
              otherRows.forEach(row => {
                rowsMap[row.document_id] = row;
              });

              // Batch approach: Query Firestore for all public pages with these IDs
              const batchSize = 10; // Firestore 'in' query supports up to 10 values
              const publicPages = [];

              // Process in batches of 10 (Firestore limit for 'in' queries)
              for (let i = 0; i < docIds.length; i += batchSize) {
                const batchIds = docIds.slice(i, i + batchSize);

                try {
                  // Query for public pages in this batch
                  const publicPagesQuery = query(
                    collection(db, 'pages'),
                    where('isPublic', '==', true),
                    where('__name__', 'in', batchIds)
                  );

                  const publicPagesSnapshot = await getDocs(publicPagesQuery);
                  console.log(`Found ${publicPagesSnapshot.size} public pages in batch ${i/batchSize + 1}`);

                  // Add each public page to the results
                  publicPagesSnapshot.forEach(doc => {
                    const data = doc.data();
                    const row = rowsMap[doc.id];

                    if (row) {
                      publicPages.push({
                        id: doc.id,
                        title: row.title || data.title || 'Untitled',
                        isOwned: row.userId === userId, // If user is the creator of the page
                        isEditable: row.userId === userId, // Only the creator can edit public pages
                        userId: row.userId,
                        lastModified: row.lastModified || data.lastModified,
                        type: 'public',
                        isPublic: true
                      });
                    }
                  });
                } catch (batchError) {
                  console.error(`Error processing batch ${i/batchSize + 1}:`, batchError);
                }
              }

              // Add the public pages to the results
              pages.push(...publicPages);
              console.log(`Added ${publicPages.length} verified public pages to results`);
            } catch (firestoreError) {
              console.error('Error checking public pages in Firestore:', firestoreError);
              // If Firestore check fails, don't add any public pages
            }
          }

          // Search for users
          let users = [];
          if (searchTerm && searchTerm.trim().length > 1) {
            try {
              users = await searchUsers(searchTerm, 5);
              console.log(`Found ${users.length} users matching query "${searchTerm}"`);

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

          // Apply scoring if enabled
          if (useScoring && searchTerm) {
            const sortedPages = sortSearchResultsByScore(pages, searchTerm);
            const sortedUsers = sortSearchResultsByScore(users, searchTerm);

            return NextResponse.json({
              pages: sortedPages,
              users: sortedUsers,
              source: "bigquery_without_ispublic"
            }, { status: 200 });
          } else {
            return NextResponse.json({
              pages,
              users,
              source: "bigquery_without_ispublic"
            }, { status: 200 });
          }
        } catch (modifiedQueryError) {
          console.error('Error executing modified BigQuery query:', modifiedQueryError);
          // Fall through to Firestore fallback
        }
      }

      // If we get here, either it wasn't an isPublic field error or the modified query also failed
      // Search for pages in Firestore
      const pages = await searchPagesInFirestore(userId, searchTerm, groupIds, filterByUserId);

      // Search for users if we have a search term
      let users = [];
      if (searchTerm && searchTerm.trim().length > 1) {
        try {
          users = await searchUsers(searchTerm, 5);
          console.log(`Found ${users.length} users matching query "${searchTerm}" using Firestore fallback`);

          // Format users for the response
          users = users.map(user => ({
            id: user.id,
            username: user.username || "Anonymous",
            photoURL: user.photoURL || null,
            type: 'user'
          }));
        } catch (userError) {
          console.error('Error searching for users in fallback:', userError);
        }
      }

      // Apply scoring if enabled
      if (useScoring && searchTerm) {
        const sortedPages = sortSearchResultsByScore(pages, searchTerm);
        const sortedUsers = sortSearchResultsByScore(users, searchTerm);

        return NextResponse.json({
          pages: sortedPages,
          users: sortedUsers,
          source: "firestore_fallback_after_bigquery_error",
          originalError: {
            message: error.message
          }
        }, { status: 200 });
      } else {
        return NextResponse.json({
          pages,
          users,
          source: "firestore_fallback_after_bigquery_error",
          originalError: {
            message: error.message
          }
        }, { status: 200 });
      }
    } catch (fallbackError) {
      console.error('Error in Firestore fallback after BigQuery error:', fallbackError);

      // If both BigQuery and Firestore fallback fail, return the original error
      return NextResponse.json({
        pages: [],
        users: [],
        error: {
          message: error.message,
          details: error.stack,
          fallbackError: fallbackError.message
        }
      }, { status: 200 });
    }
  }
}
