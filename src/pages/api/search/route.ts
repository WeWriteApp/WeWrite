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
} catch (error: any) {
  throw new Error("Failed to parse GOOGLE_CLOUD_KEY_JSON: " + error.message);
}

// Create a new BigQuery client using the credentials
const bigquery = new BigQuery({
  projectId: credentials.project_id,
  credentials,
});

export async function GET(request: any) {
  const { searchParams }: any = new URL(request.url);

  // Extract query parameters from the URL
  const userId = searchParams.get("userId");
  const groupIds = searchParams.get("groupIds")
    ? searchParams.get("groupIds").split(",")
    : []; // Handle multiple groupIds or empty array
  const searchTerm = searchParams.get("searchTerm");

  if (!userId) {
    return NextResponse.json(
      { message: "userId is required" },
      { status: 400 }
    );
  }

  // Ensure searchTerm is properly handled if not provided
  const searchTermFormatted = searchTerm
    ? `%${searchTerm.toLowerCase()}%`
    : "%"; // Use '%' to match any if no searchTerm

  try {
    // Query 1: Fetch all pages owned by the user that match the search term
    const userQuery = `
    SELECT document_id, title, lastModified
    FROM (
      SELECT document_id, title, lastModified,
             ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY lastModified DESC) AS row_num
      FROM \`wewrite-ccd82.pages_indexes.pages\`
      WHERE userId = @userId
        AND LOWER(title) LIKE @searchTerm
    )
    WHERE row_num = 1
    ORDER BY lastModified DESC
    LIMIT 10
  `;

    // Execute user query
    const [userRows] = await bigquery.query({
      query: userQuery,
      params: {
        userId: userId,
        searchTerm: searchTermFormatted,
      },
      types: {
        userId: "STRING",
        searchTerm: "STRING",
      },
    });

    let groupRows = <any>[];

    // Check if groupIds are provided and not empty
    if (groupIds.length > 0) {
      // Query 2: Fetch all pages belonging to groups that match the search term
      const groupQuery = `
        SELECT document_id, title, lastModified, groupId
        FROM (
          SELECT document_id, title, lastModified, groupId,
                 ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY lastModified DESC) AS row_num
          FROM \`wewrite-ccd82.pages_indexes.pages\`
          WHERE groupId IN UNNEST(@groupIds)
            AND LOWER(title) LIKE @searchTerm
        )
        WHERE row_num = 1
        ORDER BY lastModified DESC
        LIMIT 5
      `;
      // Execute group query
      const [groupRowsResult] = await bigquery.query({
        query: groupQuery,
        params: {
          groupIds: groupIds,
          searchTerm: searchTermFormatted,
        },
        types: {
          groupIds: ['STRING'],
          searchTerm: "STRING",
        },
      });

      groupRows = groupRowsResult;
    }

    // Process user pages
    const userPages = userRows.map((row) => ({
      id: row.document_id,
      title: row.title,
      updated_at: (row.lastModified) ? row.lastModified.value : null,
    }));

    // Process group pages
    const groupPages = groupRows.map((row: any) => ({
      id: row.document_id,
      title: row.title,
      updated_at: (row.lastModified) ? row.lastModified.value : null,
      groupId: row.groupId,
    }));

    // Return formatted results
    return NextResponse.json({ userPages, groupPages }, { status: 200 });
  } catch (error: any) {
    console.error("Error querying BigQuery:", error);
    return NextResponse.json(
      { message: "Error querying data", error: error.message },
      { status: 500 }
    );
  }
}
