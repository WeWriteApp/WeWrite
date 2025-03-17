import { NextResponse } from "next/server";

// This is a special route to check environment variables
export async function GET() {
  try {
    // Check if any credential environment variables exist
    const hasGoogleCloudKeyJson = !!process.env.GOOGLE_CLOUD_KEY_JSON;
    const hasGoogleCloudCredentials = !!process.env.GOOGLE_CLOUD_CREDENTIALS;
    const hasBase64Flag = process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true';
    
    // Get first 20 chars of the credentials to check format (for debugging)
    let googleCloudKeyJsonPreview = '';
    let googleCloudCredentialsPreview = '';
    
    if (hasGoogleCloudKeyJson) {
      googleCloudKeyJsonPreview = process.env.GOOGLE_CLOUD_KEY_JSON.substring(0, 20) + '...';
    }
    
    if (hasGoogleCloudCredentials) {
      googleCloudCredentialsPreview = process.env.GOOGLE_CLOUD_CREDENTIALS.substring(0, 20) + '...';
    }
    
    // Return the status of environment variables
    return NextResponse.json({
      hasGoogleCloudKeyJson,
      hasGoogleCloudCredentials,
      hasBase64Flag,
      googleCloudKeyJsonPreview,
      googleCloudCredentialsPreview,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
} 