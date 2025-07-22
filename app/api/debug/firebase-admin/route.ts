import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

/**
 * Debug endpoint to check Firebase Admin configuration and status
 * This helps debug Firebase Admin initialization issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Firebase Admin Debug] Debug endpoint called');
    
    // Try to get Firebase Admin
    const admin = getFirebaseAdmin();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON,
        hasLoggingCloudKey: !!process.env.LOGGING_CLOUD_KEY_JSON,
        hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasNextPublicFirebasePid: !!process.env.NEXT_PUBLIC_FIREBASE_PID
      },
      firebaseAdmin: {
        initialized: !!admin,
        hasAuth: admin ? !!admin.auth : false,
        hasFirestore: admin ? !!admin.firestore : false,
        appsCount: admin ? admin.apps.length : 0
      },
      troubleshooting: {
        commonIssues: {
          'admin is null': 'Firebase Admin failed to initialize - check service account credentials',
          'ID token verification fails': 'Mismatch between client Firebase config and server Firebase Admin config',
          'Invalid credentials': 'Service account JSON is malformed or missing required fields'
        },
        requiredEnvVars: [
          'GOOGLE_CLOUD_KEY_JSON or LOGGING_CLOUD_KEY_JSON (service account JSON)',
          'NEXT_PUBLIC_FIREBASE_PID (project ID)',
          'NEXT_PUBLIC_FIREBASE_DATABASE_URL (database URL)'
        ]
      }
    };
    
    // If admin is available, try to get more details
    if (admin) {
      try {
        const app = admin.apps[0];
        if (app) {
          debugInfo.firebaseAdmin.projectId = app.options.projectId;
          debugInfo.firebaseAdmin.databaseURL = app.options.databaseURL;
        }
      } catch (error) {
        debugInfo.firebaseAdmin.error = error.message;
      }
    }
    
    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Firebase Admin Debug] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to get Firebase Admin debug info',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
