import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

export async function GET(request) {
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
        const jsonString = process.env.GOOGLE_CLOUD_KEY_JSON.replace(/[\n\r\t]/g, '');
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
            stack: error.stack,
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
        stack: error.stack,
      }
    }, { status: 500 });
  }
} 