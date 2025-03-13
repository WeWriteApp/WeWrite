import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

// Validate and parse the JSON string from the environment variable
if (!process.env.GOOGLE_CLOUD_KEY_JSON) {
  throw new Error(
    "Environment variable GOOGLE_CLOUD_KEY_JSON is not set or is invalid."
  );
}

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);
} catch (error) {
  throw new Error("Failed to parse GOOGLE_CLOUD_KEY_JSON: " + error.message);
}

// Create a new BigQuery client using the credentials
const bigquery = new BigQuery({
  projectId: credentials.project_id,
  credentials,
});

export async function GET(request) {
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

  console.log('Search parameters:', {
    userId,
    searchTerm,
    searchTermFormatted,
    groupIds,
    rawSearchTerm: searchTerm,
    searchTermLength: searchTerm?.length,
    searchTermTrimmedLength: searchTerm?.trim()?.length,
    searchTermWords: searchTerm?.trim().split(/\s+/),
    searchTermLower: searchTerm?.toLowerCase(),
    searchTermTrimmedLower: searchTerm?.toLowerCase().trim()
  });

  try {
    // Query 1: Fetch all pages owned by the user that match the search term
    const userQuery = `
    SELECT DISTINCT p.document_id, p.title,
           COALESCE(u.username, 'NULL') as username
    FROM \`wewrite-ccd82.pages_indexes.pages\` p
    LEFT JOIN \`wewrite-ccd82.users.users\` u ON p.userId = u.userId
    WHERE p.userId = @userId
      AND LOWER(p.title) LIKE @searchTerm
    ORDER BY p.lastModified DESC
    LIMIT 10
  `;

    // Log the exact parameters being sent
    console.log('Search debug info:', {
      searchTerm,
      searchTermFormatted,
      userId,
      groupIds,
      fullUserQuery: userQuery
        .replace('@userId', `'${userId}'`)
        .replace('@searchTerm', `'${searchTermFormatted}'`),
      fullPublicQuery: publicQuery
        .replace('@userId', `'${userId}'`)
        .replace('@searchTerm', `'${searchTermFormatted}'`)
        .replace('UNNEST(@groupIds)', groupIds.length ? `UNNEST(['${groupIds.join("','")}'])` : '[]')
    });

    // Let's also verify the data exists with a simpler query
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM \`wewrite-ccd82.pages_indexes.pages\`
      WHERE LOWER(title) LIKE @searchTerm
    `;

    const [verifyResult] = await bigquery.query({
      query: verifyQuery,
      params: {
        searchTerm: searchTermFormatted
      },
      types: {
        searchTerm: "STRING"
      }
    }).catch(error => {
      console.error("Error executing verify query:", error);
      return [[]];
    });

    console.log('Verify query results:', verifyResult);

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
      return [[]];
    });

    console.log('User pages query results:', JSON.stringify(userRows, null, 2));

    let groupRows = [];
    let publicRows = [];

    // Check if groupIds are provided and not empty
    if (groupIds && groupIds.length > 0) {
      // Query 2: Fetch all pages belonging to groups that match the search term
      const groupQuery = `
        SELECT DISTINCT p.document_id, p.title, p.groupId,
               COALESCE(u.username, 'NULL') as username
        FROM \`wewrite-ccd82.pages_indexes.pages\` p
        LEFT JOIN \`wewrite-ccd82.users.users\` u ON p.userId = u.userId
        WHERE p.groupId IN UNNEST(@groupIds)
          AND LOWER(p.title) LIKE @searchTerm
        ORDER BY p.lastModified DESC
        LIMIT 5
      `;

      console.log('Executing group query:', {
        query: groupQuery,
        params: {
          groupIds,
          searchTerm: searchTermFormatted,
          rawSearchTerm: searchTerm
        }
      });

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
        return [[]];
      });

      console.log('Group pages query results:', groupRowsResult);
      groupRows = groupRowsResult || [];
    }

    // Query 3: Fetch public pages from other users that match the search term
    const publicQuery = `
      SELECT DISTINCT p.document_id, p.title, p.userId,
             COALESCE(u.username, 'NULL') as username
      FROM \`wewrite-ccd82.pages_indexes.pages\` p
      LEFT JOIN \`wewrite-ccd82.users.users\` u ON p.userId = u.userId
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
    console.log('Public query debug info:', {
      query: publicQuery,
      params: {
        userId,
        groupIds,
        searchTerm: searchTermFormatted,
        rawSearchTerm: searchTerm
      },
      fullQuery: publicQuery
        .replace('@userId', `'${userId}'`)
        .replace('@searchTerm', `'${searchTermFormatted}'`)
        .replace('UNNEST(@groupIds)', groupIds.length ? `UNNEST(['${groupIds.join("','")}'])` : '[]')
    });

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
      return [[]];
    });

    console.log('Public pages query results:', JSON.stringify(publicRowsResult, null, 2));
    publicRows = publicRowsResult || [];

    // Let's also log the raw data from BigQuery
    console.log('Raw data from BigQuery:', {
      userRows,
      groupRows,
      publicRows,
      searchTerm,
      searchTermFormatted,
      userId
    });

    // Process user pages
    const userPages = (userRows || []).map((row) => ({
      id: row.document_id,
      title: row.title,
      username: row.username,
      isOwned: true
    }));

    // Process group pages
    const groupPages = (groupRows || []).map((row) => ({
      id: row.document_id,
      title: row.title,
      groupId: row.groupId,
      username: row.username,
      isOwned: false
    }));

    // Process public pages
    const publicPages = (publicRows || []).map((row) => ({
      id: row.document_id,
      title: row.title,
      userId: row.userId,
      username: row.username,
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
