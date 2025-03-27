import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

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

export async function GET(request) {
  try {
    if (!bigquery) {
      console.log('BigQuery client not initialized, returning empty results');
      return NextResponse.json({
        pages: [],
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
      console.log('BigQuery connection failed, returning empty results');
      return NextResponse.json({
        pages: [],
        error: {
          type: "bigquery_connection_failed",
          details: "Failed to connect to BigQuery"
        }
      }, { status: 200 });
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
          pages: [], 
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

      console.log('Final processed results:', {
        pagesCount: pages.length,
        pages,
        searchTerm,
        searchTermFormatted
      });

      // Return formatted results
      return NextResponse.json({ pages }, { status: 200 });
    } catch (error) {
      console.error('Error processing query results:', error);
      return NextResponse.json({
        pages: [],
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
      error: {
        message: error.message,
        details: error.stack
      }
    }, { status: 200 });
  }
}
