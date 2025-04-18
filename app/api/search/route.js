import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers } from "../../firebase/database";

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
      const publicPagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(20)
      );

      const publicPagesSnapshot = await getDocs(publicPagesQuery);

      // Filter public pages by title and exclude user's own pages
      publicPagesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId !== userId &&
            (!searchTermLower || data.title.toLowerCase().includes(searchTermLower))) {
          publicPages.push({
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

      return NextResponse.json({
        pages,
        users,
        source: "firestore_fallback"
      }, { status: 200 });
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
