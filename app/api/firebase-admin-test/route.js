import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/adminConfig';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    
    // Get basic information about the Firebase Admin instance
    const projectId = admin.app().options.projectId;
    const hasFirestore = !!admin.firestore;
    const hasDatabase = !!admin.database;
    const hasAuth = !!admin.auth;
    
    // Return the status
    return NextResponse.json({
      success: true,
      projectId,
      services: {
        firestore: hasFirestore,
        database: hasDatabase,
        auth: hasAuth
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing Firebase Admin:', error);
    
    // Return error details
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      }
    }, { status: 500 });
  }
}
