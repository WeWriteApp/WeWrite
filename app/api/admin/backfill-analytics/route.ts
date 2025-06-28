import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirebaseAdmin } from '../../../firebase/admin';
import { isAdmin } from '../../../utils/feature-flags';

// Dynamic import to avoid module loading issues
async function getBackfillFunction() {
  const { backfillAnalytics } = await import('../../../scripts/backfillAnalytics.js');
  return backfillAnalytics;
}

// Get database connection
async function getDatabaseConnection() {
  const { db } = await import('../../../firebase/database/core');
  return db;
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    initializeFirebaseAdmin();
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and get user info
    const decodedToken = await getAuth().verifyIdToken(token);
    const userEmail = decodedToken.email;

    // Check if user is admin
    if (!userEmail || !isAdmin(userEmail)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body for options
    const body = await request.json();
    const { dryRun = false, batchSize = 100 } = body;

    console.log(`🚀 Analytics backfill initiated by admin: ${userEmail}`);
    console.log(`Options: dryRun=${dryRun}, batchSize=${batchSize}`);

    // Get database connection and backfill function
    const [db, backfillAnalytics] = await Promise.all([
      getDatabaseConnection(),
      getBackfillFunction()
    ]);

    // Run the backfill process
    const result = await backfillAnalytics(db, {
      dryRun,
      logProgress: true,
      batchSize
    });

    if (result.success) {
      console.log('✅ Analytics backfill completed successfully');
      return NextResponse.json({
        success: true,
        message: 'Analytics backfill completed successfully',
        stats: result.stats
      });
    } else {
      console.error('❌ Analytics backfill failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
        stats: result.stats
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in analytics backfill API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Analytics Backfill API',
    description: 'POST to this endpoint to trigger analytics data backfill',
    requiredAuth: 'Admin access required',
    parameters: {
      dryRun: 'boolean - if true, no data will be written (default: false)',
      batchSize: 'number - batch size for processing (default: 100)'
    }
  });
}
