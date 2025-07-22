import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check what environment variables are actually available
 * This helps debug environment variable issues in Vercel
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Env Check] Environment variables debug endpoint called');
    
    const envCheck = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
      },
      googleCloudVars: {
        hasGoogleCloudKeyBase64: !!process.env.GOOGLE_CLOUD_KEY_BASE64,
        hasGoogleCloudKeyJson: !!process.env.GOOGLE_CLOUD_KEY_JSON,
        hasGoogleCloudCredentials: !!process.env.GOOGLE_CLOUD_CREDENTIALS,
        hasLoggingCloudKeyJson: !!process.env.LOGGING_CLOUD_KEY_JSON,
        googleCloudKeyJsonLength: process.env.GOOGLE_CLOUD_KEY_JSON?.length || 0,
        loggingCloudKeyJsonLength: process.env.LOGGING_CLOUD_KEY_JSON?.length || 0,
        googleCloudKeyJsonPreview: process.env.GOOGLE_CLOUD_KEY_JSON?.substring(0, 50) + '...',
        loggingCloudKeyJsonPreview: process.env.LOGGING_CLOUD_KEY_JSON?.substring(0, 50) + '...'
      },
      firebaseVars: {
        hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasNextPublicFirebasePid: !!process.env.NEXT_PUBLIC_FIREBASE_PID,
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
        nextPublicFirebasePid: process.env.NEXT_PUBLIC_FIREBASE_PID,
        hasFirebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
      },
      allEnvVarsStartingWithGoogle: Object.keys(process.env)
        .filter(key => key.toLowerCase().includes('google') || key.toLowerCase().includes('cloud'))
        .map(key => ({
          key,
          hasValue: !!process.env[key],
          length: process.env[key]?.length || 0
        })),
      allEnvVarsStartingWithFirebase: Object.keys(process.env)
        .filter(key => key.toLowerCase().includes('firebase'))
        .map(key => ({
          key,
          hasValue: !!process.env[key],
          length: process.env[key]?.length || 0
        }))
    };
    
    // Try to parse the Google Cloud JSON to see if it's valid
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      try {
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
        
        // Check if it's base64 encoded
        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          try {
            jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
            envCheck.googleCloudVars.isBase64Encoded = true;
          } catch (e) {
            envCheck.googleCloudVars.base64DecodeError = e.message;
          }
        }
        
        const parsed = JSON.parse(jsonString);
        envCheck.googleCloudVars.jsonParseSuccess = true;
        envCheck.googleCloudVars.parsedFields = {
          hasProjectId: !!parsed.project_id,
          hasPrivateKey: !!parsed.private_key,
          hasClientEmail: !!parsed.client_email,
          projectId: parsed.project_id,
          clientEmail: parsed.client_email
        };
      } catch (parseError) {
        envCheck.googleCloudVars.jsonParseError = parseError.message;
      }
    }
    
    return NextResponse.json(envCheck, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Env Check] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to check environment variables',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
