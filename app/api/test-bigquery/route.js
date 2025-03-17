import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = 'force-dynamic'; // This ensures the route isn't statically optimized

export async function GET() {
  try {
    // Check if the environment variable exists
    const hasCredentials = !!process.env.GOOGLE_CLOUD_KEY_JSON;
    
    let bigquery = null;
    let isInitialized = false;
    let credentialsValid = false;
    let projectId = null;
    let datasetsFound = [];
    let connectionTested = false;
    let connectionSuccess = false;
    
    // Only try to initialize if we have credentials
    if (hasCredentials) {
      try {
        // Try to parse the JSON string
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON.replace(/[\n\r\t]/g, '');
        
        // Check if it might be Base64 encoded
        const mightBeBase64 = process.env.GOOGLE_CLOUD_KEY_JSON.startsWith('eyJ') || 
                              process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true';
        
        if (mightBeBase64) {
          try {
            const buffer = Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64');
            jsonString = buffer.toString('utf-8');
          } catch (decodeError) {
            // Continue with original string if decoding fails
          }
        }
        
        // Now try to parse the JSON
        const credentials = JSON.parse(jsonString);
        projectId = credentials.project_id;
        credentialsValid = true;
        
        // Initialize BigQuery client
        bigquery = new BigQuery({
          projectId: credentials.project_id,
          credentials,
        });
        isInitialized = true;
        
        // Test connection
        connectionTested = true;
        const [datasets] = await bigquery.getDatasets();
        datasetsFound = datasets.map(d => d.id);
        connectionSuccess = true;
      } catch (error) {
        return NextResponse.json({
          status: "error",
          hasCredentials,
          credentialsValid,
          isInitialized,
          connectionTested,
          connectionSuccess,
          error: {
            message: error.message,
            type: error.constructor.name
          }
        });
      }
    }
    
    return NextResponse.json({
      status: "success",
      hasCredentials,
      credentialsValid,
      projectId,
      isInitialized,
      connectionTested,
      connectionSuccess,
      datasetsFound,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: {
        message: error.message,
        type: error.constructor.name
      }
    }, { status: 500 });
  }
} 