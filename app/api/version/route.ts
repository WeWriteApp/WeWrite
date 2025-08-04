import { NextRequest, NextResponse } from 'next/server';

/**
 * Version API Endpoint
 * 
 * Returns the current build version/timestamp for update detection.
 * This helps the client detect when a new version is deployed.
 */
export async function GET(request: NextRequest) {
  try {
    // Get build time from environment or use current time
    const buildTime = process.env.BUILD_TIME || Date.now().toString();
    const buildId = process.env.BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || buildTime;
    const version = process.env.npm_package_version || '1.0.0';

    const versionInfo = {
      version,
      buildId,
      buildTime,
      // REMOVED: timestamp that changes on every request - this was causing false updates!
      // timestamp: Date.now(),
      // Include git commit if available (Vercel provides this)
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),
      // Include deployment URL if available
      deploymentUrl: process.env.VERCEL_URL,
    };

    return NextResponse.json(versionInfo, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error in version API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get version info',
        timestamp: Date.now()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}
