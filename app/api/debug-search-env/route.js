import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "basic";
    
    // Basic environment info
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      hasFirebaseConfig: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      hasBigQueryCredentials: !!(process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON),
      isBase64Encoded: process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true',
      timestamp: new Date().toISOString()
    };
    
    // If detailed mode is requested, include more information
    if (mode === "detailed") {
      // Add Firebase config info (without exposing actual keys)
      envInfo.firebase = {
        apiKeyLength: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.length || 0,
        appIdLength: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.length || 0,
        projectIdLength: process.env.NEXT_PUBLIC_FIREBASE_PID?.length || 0,
        domainLength: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN?.length || 0,
        hasAllRequiredFields: !!(
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
          process.env.NEXT_PUBLIC_FIREBASE_APP_ID &&
          process.env.NEXT_PUBLIC_FIREBASE_PID &&
          process.env.NEXT_PUBLIC_FIREBASE_DOMAIN
        )
      };
      
      // Add BigQuery credential info (without exposing actual keys)
      const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;
      envInfo.bigQuery = {
        credentialsLength: credentials?.length || 0,
        credentialsFirstChars: credentials ? `${credentials.substring(0, 10)}...` : null,
        credentialsLastChars: credentials ? `...${credentials.substring(credentials.length - 10)}` : null,
        containsHTML: credentials?.includes('<!DOCTYPE') || credentials?.includes('<html') || false,
        looksLikeJSON: credentials?.startsWith('{') || false,
        looksLikeBase64: credentials?.match(/^[A-Za-z0-9+/=]+$/) !== null
      };
      
      // Check for common environment variable issues
      envInfo.potentialIssues = [];
      
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        envInfo.potentialIssues.push("Missing Firebase API key");
      }
      
      if (!process.env.GOOGLE_CLOUD_CREDENTIALS && !process.env.GOOGLE_CLOUD_KEY_JSON) {
        envInfo.potentialIssues.push("Missing BigQuery credentials");
      } else if (envInfo.bigQuery.containsHTML) {
        envInfo.potentialIssues.push("BigQuery credentials contain HTML (likely an error page)");
      }
      
      if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true' && !envInfo.bigQuery.looksLikeBase64) {
        envInfo.potentialIssues.push("GOOGLE_CLOUD_KEY_BASE64 is true but credentials don't look like Base64");
      }
    }
    
    // Test BigQuery connection
    let bigQueryTest = { success: false, error: null };
    
    if (envInfo.hasBigQueryCredentials) {
      try {
        // Initialize BigQuery client
        let bigquery = null;
        const credentialsEnvVar = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_KEY_JSON;
        
        // First try to handle it as regular JSON
        let jsonString = credentialsEnvVar.replace(/[\n\r\t]/g, '');
        
        // Check if it might be Base64 encoded
        if (credentialsEnvVar.startsWith('eyJ') || process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true') {
          try {
            const buffer = Buffer.from(credentialsEnvVar, 'base64');
            jsonString = buffer.toString('utf-8');
          } catch (decodeError) {
            bigQueryTest.error = {
              message: "Failed to decode Base64 credentials",
              details: decodeError.message
            };
            return NextResponse.json({ envInfo, bigQueryTest });
          }
        }
        
        const credentials = JSON.parse(jsonString);
        bigquery = new BigQuery({
          projectId: credentials.project_id,
          credentials,
        });
        
        // Test a simple query
        const testQuery = `
          SELECT 1 as test
        `;
        
        const [result] = await bigquery.query({ query: testQuery });
        
        bigQueryTest.success = true;
        bigQueryTest.result = result;
      } catch (error) {
        bigQueryTest.error = {
          message: error.message,
          stack: error.stack
        };
      }
    }
    
    return NextResponse.json({ envInfo, bigQueryTest });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
