// app/api/getPages/route.js

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
      SELECT document_id, JSON_EXTRACT_SCALAR(data, '$.title') AS title, JSON_EXTRACT_SCALAR(data, '$.lastModified') AS lastModified
      FROM (
        SELECT document_id, data,
          ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY JSON_EXTRACT_SCALAR(data, '$.lastModified') DESC) AS row_num
        FROM \`wewrite-ccd82.firestore_export.pages_raw_latest\`
        WHERE JSON_EXTRACT_SCALAR(data, '$.userId') = ?
        AND LOWER(JSON_EXTRACT_SCALAR(data, '$.title')) LIKE ?
      ) sub
      WHERE row_num = 1
      LIMIT 10
    `;

    // Execute user query
    const [userRows] = await bigquery.query({
      query: userQuery,
      params: [userId, searchTermFormatted],
    });

    // Query 2: Fetch all pages belonging to groups that match the search term
    const groupQuery = `
      SELECT document_id, JSON_EXTRACT_SCALAR(data, '$.title') AS title, JSON_EXTRACT_SCALAR(data, '$.lastModified') AS lastModified, JSON_EXTRACT_SCALAR(data, '$.groupId') AS groupId
      FROM (
        SELECT document_id, data,
          ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY JSON_EXTRACT_SCALAR(data, '$.lastModified') DESC) AS row_num
        FROM \`wewrite-ccd82.firestore_export.pages_raw_latest\`
        WHERE JSON_EXTRACT_SCALAR(data, '$.groupId') IN UNNEST(?)
        AND LOWER(JSON_EXTRACT_SCALAR(data, '$.title')) LIKE ?
      ) sub
      WHERE row_num = 1
      LIMIT 5
    `;

    // Execute group query
    const [groupRows] = await bigquery.query({
      query: groupQuery,
      params: [groupIds, searchTermFormatted],
    });

    // Process user pages
    const userPages = userRows.map((row) => ({
      id: row.document_id,
      title: row.title,
      updated_at: row.lastModified,
    }));

    // Process group pages
    const groupPages = groupRows.map((row) => ({
      id: row.document_id,
      title: row.title,
      updated_at: row.lastModified,
      groupId: row.groupId,
    }));

    // Return formatted results
    return NextResponse.json({ userPages, groupPages }, { status: 200 });
  } catch (error) {
    console.error("Error querying BigQuery:", error);
    return NextResponse.json(
      { message: "Error querying data", error: error.message },
      { status: 500 }
    );
  }
}
