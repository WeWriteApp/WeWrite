import { NextResponse } from 'next/server';

// This will be set at build time
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

export async function GET() {
  try {
    // Return build information that changes when the app is redeployed
    const buildInfo = {
      buildTime: BUILD_TIME,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      // Include git commit hash if available (Vercel provides this)
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'unknown'
    };

    const response = NextResponse.json(buildInfo);
    
    // Ensure this endpoint is never cached
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error getting build info:', error);
    return NextResponse.json(
      { error: 'Failed to get build info' },
      { status: 500 }
    );
  }
}
