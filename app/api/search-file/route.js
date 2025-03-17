import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

// Hardcode credentials directly in this file for testing.
// WARNING: This is not secure for production use.
// In a real application, you should use environment variables or a secure vault.
const CREDENTIALS = {
  "type": "service_account",
  "project_id": "wewrite-ccd82",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "YOUR_PRIVATE_KEY",
  "client_email": "YOUR_CLIENT_EMAIL",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR_CERT_URL",
  "universe_domain": "googleapis.com"
};

// Initialize the BigQuery client
let bigquery = null;
try {
  bigquery = new BigQuery({
    projectId: CREDENTIALS.project_id,
    credentials: CREDENTIALS
  });
  console.log('BigQuery initialized with hardcoded credentials');
} catch (error) {
  console.error('Failed to initialize BigQuery with hardcoded credentials:', error);
}

export async function GET(request) {
  try {
    if (!bigquery) {
      return NextResponse.json({
        success: false,
        message: "BigQuery not initialized with hardcoded credentials"
      });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get("q") || "test";
    const userId = searchParams.get("userId") || "anonymous";
    
    // Format search term for LIKE query
    const searchTermFormatted = `%${searchTerm.toLowerCase().trim()}%`;
    
    // Simple test query
    const testQuery = `
      SELECT COUNT(*) as count
      FROM \`wewrite-ccd82.pages_indexes.pages\`
      WHERE LOWER(title) LIKE @searchTerm
    `;
    
    try {
      const [result] = await bigquery.query({
        query: testQuery,
        params: {
          searchTerm: searchTermFormatted
        },
        types: {
          searchTerm: "STRING"
        }
      });
      
      // Full search query for user pages
      const userQuery = `
        SELECT DISTINCT document_id, title, userId, lastModified
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE userId = @userId
          AND LOWER(title) LIKE @searchTerm
        ORDER BY lastModified DESC
        LIMIT 10
      `;
      
      const [userPages] = await bigquery.query({
        query: userQuery,
        params: {
          userId: userId,
          searchTerm: searchTermFormatted
        },
        types: {
          userId: "STRING",
          searchTerm: "STRING"
        }
      });
      
      // Full search query for public pages
      const publicQuery = `
        SELECT DISTINCT document_id, title, userId, lastModified
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE userId != @userId
          AND LOWER(title) LIKE @searchTerm
        ORDER BY lastModified DESC
        LIMIT 10
      `;
      
      const [publicPages] = await bigquery.query({
        query: publicQuery,
        params: {
          userId: userId,
          searchTerm: searchTermFormatted
        },
        types: {
          userId: "STRING",
          searchTerm: "STRING"
        }
      });
      
      // Process the results
      const formattedUserPages = userPages.map(page => ({
        id: page.document_id,
        title: page.title,
        isOwned: true
      }));
      
      const formattedPublicPages = publicPages.map(page => ({
        id: page.document_id,
        title: page.title,
        userId: page.userId,
        isOwned: false,
        isPublic: true
      }));
      
      return NextResponse.json({
        success: true,
        testCount: result[0].count,
        userPages: formattedUserPages,
        publicPages: formattedPublicPages
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name
        }
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name
      }
    }, { status: 500 });
  }
} 