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
    const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;
    if (credentialsEnvVar) {
      try {
        let jsonString = credentialsEnvVar.replace(/[\n\r\t]/g, '');
        
        // Check if it might be HTML content
        if (jsonString.includes('<!DOCTYPE') || jsonString.includes('<html')) {
          bigqueryStatus.error = {
            message: "Credentials contain HTML content instead of JSON",
            containsHTML: true
          };
          return NextResponse.json({
            success: false,
            bigqueryStatus,
            message: "BigQuery not initialized: Credentials contain HTML"
          });
        }
        
        // Check if it might be Base64 encoded
        const mightBeBase64 = credentialsEnvVar.startsWith('eyJ') || 
                            process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true';
        
        if (mightBeBase64) {
          try {
            const buffer = Buffer.from(credentialsEnvVar, 'base64');
            jsonString = buffer.toString('utf-8');
          } catch (decodeError) {
            // Continue with original string if decoding fails
          }
        }
        
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