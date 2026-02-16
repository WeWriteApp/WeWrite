import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../utils/apiHelpers';

/**
 * GET /api/visitor-tracking/stats
 * 
 * Get visitor statistics for the current session timeout period.
 * Environment-aware API replacement for VisitorTrackingService direct Firebase calls.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();


    // Use environment-aware collection naming
    const visitorsRef = db.collection(getCollectionName('siteVisitors'));
    
    // Session timeout: 30 minutes
    const sessionTimeout = new Date(Date.now() - (30 * 60 * 1000));

    // Query for active sessions
    const activeSessionsQuery = visitorsRef
      .where('lastSeen', '>=', sessionTimeout);

    const snapshot = await activeSessionsQuery.get();

    let total = 0;
    let authenticated = 0;
    let anonymous = 0;
    let bots = 0;
    let legitimateVisitors = 0;

    snapshot.forEach(doc => {
      const data = doc.data();

      // Filter out high-confidence bots (except search engines for SEO)
      const isHighConfidenceBot = data.isBot &&
                                 data.botConfidence > 0.7 &&
                                 data.botCategory !== 'search_engine';

      if (isHighConfidenceBot) {
        bots++;
        return; // Skip counting bots in main metrics
      }

      // Count legitimate visitors
      legitimateVisitors++;
      total++;

      if (data.isAuthenticated) {
        authenticated++;
      } else {
        anonymous++;
      }
    });

    const stats = {
      total,
      authenticated,
      anonymous,
      bots,
      legitimateVisitors,
      sessionTimeout: 30, // minutes
      timestamp: new Date().toISOString()
    };


    return createSuccessResponse(stats);

  } catch (error) {
    console.error('❌ [VISITOR STATS] Error fetching statistics:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch visitor statistics');
  }
}

/**
 * POST /api/visitor-tracking/stats
 * 
 * Update visitor session with new activity.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const body = await request.json();
    const { sessionId, updates } = body;

    if (!sessionId) {
      return createErrorResponse('BAD_REQUEST', 'Session ID is required');
    }


    // Use environment-aware collection naming
    const sessionRef = db.collection(getCollectionName('siteVisitors')).doc(sessionId);
    
    const updateData = {
      lastSeen: new Date(),
      ...updates
    };

    await sessionRef.update(updateData);


    return createSuccessResponse({
      sessionId,
      updated: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [VISITOR STATS] Error updating session:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update visitor session');
  }
}
