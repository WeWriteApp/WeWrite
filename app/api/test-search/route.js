import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get("q") || "test";
    
    // Check BigQuery initialization first
    let bigqueryStatus = {
      initialized: false,
      error: null
    };
    
    let bigquery = null;
    
    // Try to initialize BigQuery
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      try {
        const jsonString = process.env.GOOGLE_CLOUD_KEY_JSON.replace(/[\n\r\t]/g, '');
        const credentials = JSON.parse(jsonString);
        bigquery = new BigQuery({
          projectId: credentials.project_id,
          credentials,
        });
        bigqueryStatus.initialized = true;
      } catch (error) {
        bigqueryStatus.error = {
          message: error.message,
          type: error.constructor.name
        };
      }
    }
    
    // If BigQuery is not initialized, return status
    if (!bigqueryStatus.initialized) {
      return NextResponse.json({
        success: false,
        bigqueryStatus,
        message: "BigQuery not initialized"
      });
    }
    
    // Test a simple query
    try {
      const searchTermFormatted = `%${searchTerm.toLowerCase().trim()}%`;
      
      const testQuery = `
        SELECT COUNT(*) as count
        FROM \`wewrite-ccd82.pages_indexes.pages\`
        WHERE LOWER(title) LIKE @searchTerm
      `;
      
      const [result] = await bigquery.query({
        query: testQuery,
        params: {
          searchTerm: searchTermFormatted
        },
        types: {
          searchTerm: "STRING"
        }
      });
      
      return NextResponse.json({
        success: true,
        bigqueryStatus,
        queryResult: result[0],
        message: "Query executed successfully"
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        bigqueryStatus,
        error: {
          message: error.message,
          type: error.constructor.name
        },
        message: "Query execution failed"
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