import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

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
      stack: error.stack
    });
    return false;
  }
}

export async function GET(request) {
  try {
    // If BigQuery is not initialized, return empty results
    if (!bigquery) {
      console.warn('BigQuery not initialized - returning empty results');
      return NextResponse.json({ 
        userPages: [], 
        groupPages: [], 
        publicPages: [],
        message: "Search functionality temporarily unavailable. Please ensure GOOGLE_CLOUD_KEY_JSON is configured.",
        error: {
          type: "bigquery_not_initialized",
          details: {
            envVarPresent: !!process.env.GOOGLE_CLOUD_KEY_JSON,
          }
        }
      }, { status: 200 });
    }

    // Test BigQuery connection first
    const isConnected = await testBigQueryConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to BigQuery');
    }

    const { searchParams } = new URL(request.url);

    // Extract query parameters from the URL
    const userId = searchParams.get("userId");
    const groupIds = searchParams.get("groupIds")
      ? searchParams.get("groupIds").split(",").filter(id => id && id.trim().length > 0)
      : []; // Handle multiple groupIds or empty array, filter out empty strings
    const searchTerm = searchParams.get("searchTerm");

    if (!userId) {
      return NextResponse.json(
        { 
          userPages: [], 
          groupPages: [], 
          publicPages: [],
          message: "userId is required" 
        },
        { status: 400 }
      );
    }

    // Ensure searchTerm is properly handled if not provided
    const searchTermFormatted = searchTerm
      ? `%${searchTerm.toLowerCase().trim()}%`
      : "%";

    // Let's also verify the data exists with a simpler query
    const verifyQuery = `
      SELECT COUNT(*) as count, STRING_AGG(title) as titles
      FROM \`wewrite-ccd82.pages_indexes.pages\`
      WHERE LOWER(title) LIKE @searchTerm
    `;

    console.log('Executing verify query:', {
      query: verifyQuery,
      params: {
        searchTerm: searchTermFormatted
      }
    });

    const [verifyResult] = await bigquery.query({
      query: verifyQuery,
      params: {
        searchTerm: searchTermFormatted
      },
      types: {
        searchTerm: "STRING"
      }
    }).catch(error => {
      console.error("Error executing verify query:", {
        error,
        stack: error.stack,
        query: verifyQuery,
        params: { searchTerm: searchTermFormatted }
      });
      throw error;
    });

    console.log('Verify query results:', JSON.stringify(verifyResult, null, 2));

    // Query 1: Fetch all pages owned by the user that match the search term
    const userQuery = `
      SELECT DISTINCT p.document_id, p.title, p.userId, p.lastModified
      FROM \`wewrite-ccd82.pages_indexes.pages\` p
      WHERE p.userId = @userId
        AND LOWER(p.title) LIKE @searchTerm
      ORDER BY p.lastModified DESC
      LIMIT 10
    `;

    // Execute user query
    const [userRows] = await bigquery.query({
      query: userQuery,
      params: {
        userId: userId,
        searchTerm: searchTermFormatted
      },
      types: {
        userId: "STRING",
        searchTerm: "STRING"
      },
    }).catch(error => {
      console.error("Error executing user query:", error);
      throw error;
    });

    console.log('User pages query results:', JSON.stringify(userRows, null, 2));

    let groupRows = [];
    let publicRows = [];

    // Check if groupIds are provided and not empty
    if (groupIds && groupIds.length > 0) {
      // Query 2: Fetch all pages belonging to groups that match the search term
      const groupQuery = `
        SELECT DISTINCT p.document_id, p.title, p.groupId, p.userId, p.lastModified
        FROM \`wewrite-ccd82.pages_indexes.pages\` p
        WHERE p.groupId IN UNNEST(@groupIds)
          AND LOWER(p.title) LIKE @searchTerm
        ORDER BY p.lastModified DESC
        LIMIT 5
      `;

      // Execute group query
      const [groupRowsResult] = await bigquery.query({
        query: groupQuery,
        params: {
          groupIds: groupIds,
          searchTerm: searchTermFormatted
        },
        types: {
          groupIds: ['STRING'],
          searchTerm: "STRING"
        },
      }).catch(error => {
        console.error("Error executing group query:", error);
        throw error;
      });

      console.log('Group pages query results:', groupRowsResult);
      groupRows = groupRowsResult || [];
    }

    // Query 3: Fetch public pages from other users that match the search term
    const publicQuery = `
      SELECT DISTINCT p.document_id, p.title, p.userId, p.lastModified
      FROM \`wewrite-ccd82.pages_indexes.pages\` p
      WHERE p.userId != @userId
        AND LOWER(p.title) LIKE @searchTerm
        ${groupIds.length > 0 ? `AND p.document_id NOT IN (
          SELECT document_id 
          FROM \`wewrite-ccd82.pages_indexes.pages\` 
          WHERE groupId IN UNNEST(@groupIds)
        )` : ''}
      ORDER BY p.lastModified DESC
      LIMIT 10
    `;

    // Execute public pages query
    const [publicRowsResult] = await bigquery.query({
      query: publicQuery,
      params: {
        userId: userId,
        ...(groupIds.length > 0 ? { groupIds: groupIds } : {}),
        searchTerm: searchTermFormatted
      },
      types: {
        userId: "STRING",
        ...(groupIds.length > 0 ? { groupIds: ['STRING'] } : {}),
        searchTerm: "STRING"
      },
    }).catch(error => {
      console.error("Error executing public query:", error);
      throw error;
    });

    console.log('Public pages query results:', JSON.stringify(publicRowsResult, null, 2));
    publicRows = publicRowsResult || [];

    // Process user pages
    const userPages = (userRows || []).map((row) => ({
      id: row.document_id,
      title: row.title,
      username: 'NULL',
      isOwned: true
    }));

    // Process group pages
    const groupPages = (groupRows || []).map((row) => ({
      id: row.document_id,
      title: row.title,
      groupId: row.groupId,
      username: 'NULL',
      isOwned: false
    }));

    // Process public pages
    const publicPages = (publicRows || []).map((row) => ({
      id: row.document_id,
      title: row.title,
      userId: row.userId,
      username: 'NULL',
      isOwned: false,
      isPublic: true
    }));

    console.log('Final processed results:', {
      userPagesCount: userPages.length,
      groupPagesCount: groupPages.length,
      publicPagesCount: publicPages.length,
      userPages,
      groupPages,
      publicPages,
      searchTerm,
      searchTermFormatted
    });

    // Return formatted results
    return NextResponse.json({ userPages, groupPages, publicPages }, { status: 200 });
  } catch (error) {
    console.error("Error querying BigQuery:", error);
    return NextResponse.json(
      { 
        message: "Error querying data", 
        error: error.message,
        userPages: [],
        groupPages: [],
        publicPages: []
      },
      { status: 500 }
    );
  }
}
