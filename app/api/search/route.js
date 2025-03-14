import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

let bigquery = null;

// Only try to initialize BigQuery if we have credentials
if (process.env.GOOGLE_CLOUD_KEY_JSON) {
  try {
    // Try to parse the JSON string, handling any special characters
    const jsonString = process.env.GOOGLE_CLOUD_KEY_JSON.replace(/[\n\r\t]/g, '');
    const credentials = JSON.parse(jsonString);
    bigquery = new BigQuery({
      projectId: credentials.project_id,
      credentials,
    });
  } catch (error) {
    console.error("Failed to initialize BigQuery:", error);
  }
}

// Test BigQuery connection
async function testBigQueryConnection() {
  if (!bigquery) {
    console.error('BigQuery client not initialized');
    return false;
  }

  try {
    const [datasets] = await bigquery.getDatasets();
    console.log('BigQuery connection successful. Found datasets:', datasets.map(d => d.id));
    return true;
  } catch (error) {
    console.error('BigQuery connection test failed:', error);
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
        message: "Search functionality temporarily unavailable" 
      }, { status: 503 });
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
