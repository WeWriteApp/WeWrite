import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  try {
    const hasGoogleCloudKeyJson = !!process.env.GOOGLE_CLOUD_KEY_JSON;
    const hasGoogleCloudCredentials = !!process.env.GOOGLE_CLOUD_CREDENTIALS;
    const hasBase64Flag = process.env.GOOGLE_CLOUD_KEY_BASE64 === 'true';

    let googleCloudKeyJsonPreview = '';
    let googleCloudCredentialsPreview = '';

    if (hasGoogleCloudKeyJson && process.env.GOOGLE_CLOUD_KEY_JSON) {
      googleCloudKeyJsonPreview = process.env.GOOGLE_CLOUD_KEY_JSON.substring(0, 20) + '...';
    }

    if (hasGoogleCloudCredentials && process.env.GOOGLE_CLOUD_CREDENTIALS) {
      googleCloudCredentialsPreview = process.env.GOOGLE_CLOUD_CREDENTIALS.substring(0, 20) + '...';
    }

    return NextResponse.json({
      hasGoogleCloudKeyJson,
      hasGoogleCloudCredentials,
      hasBase64Flag,
      googleCloudKeyJsonPreview,
      googleCloudCredentialsPreview,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
