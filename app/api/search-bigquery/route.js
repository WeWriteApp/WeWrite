import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import { searchUsers } from "../../firebase/database";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

let bigquery = null;

// Enhanced BigQuery initialization with better error handling
const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;

if (credentialsEnvVar && process.env.NODE_ENV !== 'development') {
  try {
    console.log('Attempting to initialize BigQuery for production...');

    // Clean up the JSON string
    let jsonString = credentialsEnvVar.replace(/[\n\r\t]/g, '');

    // Check if it might be Base64 encoded
    const mightBeBase64 = credentialsEnvVar.startsWith('eyJ') ||
                          process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true';

    if (mightBeBase64) {
      console.log('Attempting to decode Base64 credentials...');
      try {
        const buffer = Buffer.from(credentialsEnvVar, 'base64');
        jsonString = buffer.toString('utf-8');
        console.log('Successfully decoded Base64 credentials');
      } catch (decodeError) {
        console.log('Base64 decode failed, using original string');
        jsonString = credentialsEnvVar;
      }
    }

    // Check for HTML content (common error)
    if (jsonString.includes('<!DOCTYPE') || jsonString.includes('<html')) {
      throw new Error('Credentials appear to contain HTML content instead of JSON');
    }

    // Try to parse the JSON
    console.log('Attempting to parse credentials JSON...');
    const credentials = JSON.parse(jsonString);

    // Validate required fields
    if (!credentials.project_id || !credentials.private_key || !credentials.client_email) {
      throw new Error('Missing required credential fields (project_id, private_key, client_email)');
    }

    // Fix potential private key formatting issues
    if (credentials.private_key && !credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\n/g, '\\n');
    }

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
      type: error.constructor.name,
      credentialsProvided: !!credentialsEnvVar,
      credentialsLength: credentialsEnvVar?.length,
      credentialsStart: credentialsEnvVar?.substring(0, 20) + '...',
      containsHTML: credentialsEnvVar?.includes('<!DOCTYPE') || credentialsEnvVar?.includes('<html')
    });
    bigquery = null; // Ensure it's null on failure
  }
} else {
  console.log('Running in development mode - skipping BigQuery initialization');
}

// BigQuery search function with unlimited page coverage
async function searchPagesInBigQuery(userId, searchTerm, filterByUserId = null) {
  try {
    if (!bigquery) {
      throw new Error('BigQuery not initialized');
    }

    console.log(`🔍 BIGQUERY UNLIMITED SEARCH: "${searchTerm}" for user: ${userId}`);

    const searchTermFormatted = `%${searchTerm.toLowerCase().trim()}%`;

    // Query for user's own pages (unlimited)
    let userPages = [];
    if (userId) {
      const userQuery = `
        SELECT DISTINCT document_id, title, userId, lastModified, isPublic, username
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE userId = @userId
          AND LOWER(title) LIKE @searchTerm
        ORDER BY lastModified DESC
      `;

      const [userResults] = await bigquery.query({
        query: userQuery,
        params: {
          userId: filterByUserId || userId,
          searchTerm: searchTermFormatted
        },
        types: {
          userId: "STRING",
          searchTerm: "STRING"
        }
      });

      userPages = userResults.map(page => ({
        id: page.document_id,
        title: page.title,
        userId: page.userId,
        username: page.username || 'Anonymous',
        isOwned: true,
        isEditable: true,
        isPublic: page.isPublic,
        lastModified: page.lastModified,
        type: 'user'
      }));

      console.log(`📄 BigQuery found ${userPages.length} user page matches (unlimited)`);
    }

    // Query for public pages (unlimited, excluding user's own pages)
    let publicPages = [];
    if (!filterByUserId) {
      const publicQuery = `
        SELECT DISTINCT document_id, title, userId, lastModified, isPublic, username
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE isPublic = true
          AND userId != @userId
          AND LOWER(title) LIKE @searchTerm
        ORDER BY lastModified DESC
      `;

      const [publicResults] = await bigquery.query({
        query: publicQuery,
        params: {
          userId: userId || '',
          searchTerm: searchTermFormatted
        },
        types: {
          userId: "STRING",
          searchTerm: "STRING"
        }
      });

      publicPages = publicResults.map(page => ({
        id: page.document_id,
        title: page.title,
        userId: page.userId,
        username: page.username || 'Anonymous',
        isOwned: false,
        isEditable: false,
        isPublic: page.isPublic,
        lastModified: page.lastModified,
        type: 'public'
      }));

      console.log(`🌐 BigQuery found ${publicPages.length} public page matches (unlimited)`);
    }

    // Combine results
    const allResults = [...userPages, ...publicPages];
    console.log(`🎯 BigQuery total matches found: ${allResults.length}`);

    // Apply enhanced ranking to prioritize title matches
    const { sortSearchResultsByScore } = await import('../../utils/searchUtils');
    const rankedResults = sortSearchResultsByScore(allResults, searchTerm);

    console.log(`🎯 BigQuery results after ranking: ${rankedResults.length}`);
    return rankedResults;

  } catch (error) {
    console.error('❌ Error in BigQuery unlimited search:', error);
    throw error; // Re-throw to allow fallback to Firestore
  }
}

// Fallback to unlimited Firestore search
async function fallbackToFirestoreUnlimited(userId, searchTerm, groupIds = [], filterByUserId = null) {
  console.log('🔄 Falling back to unlimited Firestore search...');

  // Import the unlimited Firestore search function
  const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/search-unlimited?userId=${userId}&searchTerm=${encodeURIComponent(searchTerm)}&filterByUserId=${filterByUserId || ''}&groupIds=${groupIds.join(',')}`);

  if (!response.ok) {
    throw new Error('Firestore fallback failed');
  }

  const data = await response.json();
  return data.pages || [];
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
    const forceBigQuery = searchParams.get("forceBigQuery") === 'true';

    console.log(`BigQuery Search API called with searchTerm: "${searchTerm}", userId: ${userId}, filterByUserId: ${filterByUserId}, forceBigQuery: ${forceBigQuery}`);

    // Additional validation
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('Empty search term provided, returning empty results');
      return NextResponse.json({
        pages: [],
        users: [],
        source: "empty_search_term",
        bigquery: true
      }, { status: 200 });
    }

    let pages = [];
    let searchSource = "bigquery_primary";

    // Try BigQuery first (if available and not in development)
    if (bigquery && (process.env.NODE_ENV !== 'development' || forceBigQuery)) {
      try {
        console.log('🚀 Attempting BigQuery unlimited search...');
        pages = await searchPagesInBigQuery(userId, searchTerm, filterByUserId);
        searchSource = "bigquery_unlimited";
        console.log(`✅ BigQuery search successful: ${pages.length} results`);
      } catch (bigQueryError) {
        console.error('❌ BigQuery search failed, falling back to Firestore:', bigQueryError);
        try {
          pages = await fallbackToFirestoreUnlimited(userId, searchTerm, groupIds, filterByUserId);
          searchSource = "firestore_unlimited_fallback";
          console.log(`✅ Firestore fallback successful: ${pages.length} results`);
        } catch (firestoreError) {
          console.error('❌ Both BigQuery and Firestore unlimited search failed:', firestoreError);
          pages = [];
          searchSource = "both_failed";
        }
      }
    } else {
      // Use Firestore unlimited search directly
      console.log('🔄 BigQuery not available, using Firestore unlimited search...');
      try {
        pages = await fallbackToFirestoreUnlimited(userId, searchTerm, groupIds, filterByUserId);
        searchSource = "firestore_unlimited_direct";
        console.log(`✅ Firestore unlimited search successful: ${pages.length} results`);
      } catch (firestoreError) {
        console.error('❌ Firestore unlimited search failed:', firestoreError);
        pages = [];
        searchSource = "firestore_unlimited_failed";
      }
    }

    // Search for users if we have a search term
    let users = [];
    if (searchTerm && searchTerm.trim().length > 1) {
      try {
        console.log(`Starting user search for term "${searchTerm}"`);
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
        users = [];
      }
    }

    const response = {
      pages: pages || [],
      users: users || [],
      source: searchSource,
      searchTerm: searchTerm,
      userId: userId,
      bigquery: true,
      unlimited: true,
      timestamp: new Date().toISOString()
    };

    console.log(`BigQuery Search API returning response:`, {
      pagesCount: response.pages.length,
      usersCount: response.users.length,
      source: response.source,
      searchTerm: response.searchTerm,
      bigquery: response.bigquery,
      unlimited: response.unlimited
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in BigQuery search API:', error);
    return NextResponse.json({
      pages: [],
      users: [],
      error: 'Search temporarily unavailable',
      source: "unexpected_bigquery_error",
      bigquery: true,
      unlimited: true,
      errorMessage: error.message
    }, { status: 200 });
  }
}
