import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Extract query parameters from the URL
    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get("dataset") || "pages_indexes";
    const table = searchParams.get("table") || "pages";

    // Initialize BigQuery client
    let bigquery = null;
    const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;
    
    if (!credentialsEnvVar) {
      return NextResponse.json({
        success: false,
        error: "No Google Cloud credentials found in environment variables"
      }, { status: 400 });
    }
    
    try {
      console.log('Attempting to initialize BigQuery with credentials');
      
      // First try to handle it as regular JSON
      let jsonString = credentialsEnvVar.replace(/[\n\r\t]/g, '');
      
      // Check if it might be HTML content (bad response)
      if (jsonString.includes('<!DOCTYPE') || jsonString.includes('<html')) {
        return NextResponse.json({
          success: false,
          error: "Invalid credentials format: Contains HTML content"
        }, { status: 400 });
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
          return NextResponse.json({
            success: false,
            error: "Failed to decode Base64 credentials"
          }, { status: 400 });
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
      return NextResponse.json({
        success: false,
        error: "Failed to initialize BigQuery client",
        details: error.message
      }, { status: 500 });
    }
    
    // Get all datasets
    const [datasets] = await bigquery.getDatasets();
    const datasetIds = datasets.map(d => d.id);
    
    // Check if the requested dataset exists
    if (!datasetIds.includes(dataset)) {
      return NextResponse.json({
        success: false,
        error: `Dataset '${dataset}' not found`,
        availableDatasets: datasetIds
      }, { status: 404 });
    }
    
    // Get all tables in the dataset
    const [tables] = await bigquery.dataset(dataset).getTables();
    const tableIds = tables.map(t => t.id);
    
    // Check if the requested table exists
    if (!tableIds.includes(table)) {
      return NextResponse.json({
        success: false,
        error: `Table '${table}' not found in dataset '${dataset}'`,
        availableTables: tableIds
      }, { status: 404 });
    }
    
    // Get the table schema
    const [metadata] = await bigquery.dataset(dataset).table(table).getMetadata();
    const schema = metadata.schema.fields;
    
    // Return the schema information
    return NextResponse.json({
      success: true,
      dataset,
      table,
      schema: schema.map(field => ({
        name: field.name,
        type: field.type,
        mode: field.mode
      })),
      hasIsPublicField: schema.some(field => field.name === 'isPublic')
    }, { status: 200 });
  } catch (error) {
    console.error('Error in BigQuery schema debug endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
