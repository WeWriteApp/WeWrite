import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../utils/apiHelpers';

/**
 * POST /api/visitor-tracking/session
 * 
 * Create or update a visitor session.
 * Environment-aware API replacement for VisitorTrackingService direct Firebase calls.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const body = await request.json();
    const { 
      fingerprintId, 
      userId, 
      isAuthenticated, 
      fingerprint, 
      pageId, 
      sessionData 
    } = body;

    if (!fingerprintId) {
      return createErrorResponse('BAD_REQUEST', 'Fingerprint ID is required');
    }

    console.log('👤 [VISITOR TRACKING] Creating/updating session', {
      fingerprintId,
      userId: userId || 'anonymous',
      isAuthenticated: !!isAuthenticated,
      pageId
    });

    // Use environment-aware collection naming
    const visitorsRef = db.collection(getCollectionName('siteVisitors'));
    
    // Session timeout: 30 minutes
    const sessionTimeout = new Date(Date.now() - (30 * 60 * 1000));
    const now = new Date();

    // Find existing session
    let existingSessionQuery;
    if (userId && isAuthenticated) {
      existingSessionQuery = visitorsRef
        .where('userId', '==', userId)
        .where('lastSeen', '>=', sessionTimeout)
        .limit(1);
    } else {
      existingSessionQuery = visitorsRef
        .where('fingerprint.id', '==', fingerprintId)
        .where('lastSeen', '>=', sessionTimeout)
        .limit(1);
    }

    const existingSnapshot = await existingSessionQuery.get();
    
    if (!existingSnapshot.empty) {
      // Update existing session
      const existingDoc = existingSnapshot.docs[0];
      const updateData = {
        lastSeen: now,
        pageId: pageId || existingDoc.data().pageId,
        isAuthenticated: !!isAuthenticated,
        ...(userId && { userId }),
        ...(sessionData && sessionData)
      };

      await existingDoc.ref.update(updateData);
      
      console.log('✅ [VISITOR TRACKING] Updated existing session', {
        sessionId: existingDoc.id,
        fingerprintId
      });

      return createSuccessResponse({
        sessionId: existingDoc.id,
        action: 'updated',
        data: { ...existingDoc.data(), ...updateData }
      });
    } else {
      // Create new session
      const newSessionData = {
        fingerprintId,
        fingerprint: fingerprint || { id: fingerprintId },
        userId: userId || null,
        isAuthenticated: !!isAuthenticated,
        pageId: pageId || null,
        firstSeen: now,
        lastSeen: now,
        sessionCount: 1,
        isBot: false, // Default, can be updated by bot detection
        botConfidence: 0,
        botCategory: null,
        ...sessionData
      };

      const newDocRef = await visitorsRef.add(newSessionData);
      
      console.log('✅ [VISITOR TRACKING] Created new session', {
        sessionId: newDocRef.id,
        fingerprintId
      });

      return createSuccessResponse({
        sessionId: newDocRef.id,
        action: 'created',
        data: newSessionData
      });
    }

  } catch (error) {
    console.error('❌ [VISITOR TRACKING] Error managing session:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to manage visitor session');
  }
}

/**
 * GET /api/visitor-tracking/session?fingerprintId=xxx&userId=xxx
 * 
 * Get existing visitor session.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const fingerprintId = searchParams.get('fingerprintId');
    const userId = searchParams.get('userId');

    if (!fingerprintId) {
      return createErrorResponse('BAD_REQUEST', 'Fingerprint ID is required');
    }

    // Use environment-aware collection naming
    const visitorsRef = db.collection(getCollectionName('siteVisitors'));
    
    // Session timeout: 30 minutes
    const sessionTimeout = new Date(Date.now() - (30 * 60 * 1000));

    // Find existing session
    let query;
    if (userId) {
      query = visitorsRef
        .where('userId', '==', userId)
        .where('lastSeen', '>=', sessionTimeout)
        .limit(1);
    } else {
      query = visitorsRef
        .where('fingerprint.id', '==', fingerprintId)
        .where('lastSeen', '>=', sessionTimeout)
        .limit(1);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return createSuccessResponse({
        session: null,
        found: false
      });
    }

    const doc = snapshot.docs[0];
    const sessionData = {
      id: doc.id,
      ...doc.data()
    };

    return createSuccessResponse({
      session: sessionData,
      found: true
    });

  } catch (error) {
    console.error('❌ [VISITOR TRACKING] Error fetching session:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch visitor session');
  }
}
