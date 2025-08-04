import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { getUserIdFromRequest } from '../../auth-helper';

// Initialize Firebase Admin SDK
let allocationIntervalApp;
try {
  allocationIntervalApp = getApps().find(app => app.name === 'allocation-interval-app');

  if (!allocationIntervalApp) {
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);

    allocationIntervalApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
      })
    }, 'allocation-interval-app');
  }
} catch (error) {
  console.error('[Allocation Interval Admin SDK] Initialization failed:', error);
  throw error;
}

const db = getFirestore(allocationIntervalApp);

/**
 * GET /api/user-preferences/allocation-interval
 * Get user's allocation interval preference
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user preferences document
    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    const preferencesDoc = await preferencesRef.get();

    if (!preferencesDoc.exists) {
      // Return default interval if no preferences exist
      return NextResponse.json({
        allocationIntervalCents: 10 // Default $0.10
      });
    }

    const data = preferencesDoc.data();
    
    return NextResponse.json({
      allocationIntervalCents: data?.allocationIntervalCents || 10
    });

  } catch (error) {
    console.error('[Allocation Interval GET] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to get allocation interval',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/user-preferences/allocation-interval
 * Set user's allocation interval preference
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allocationIntervalCents } = await request.json();

    // Validate the interval
    if (typeof allocationIntervalCents !== 'number' || allocationIntervalCents < 1 || allocationIntervalCents > 10000) {
      return NextResponse.json({ 
        error: 'Invalid allocation interval. Must be between $0.01 and $100.00' 
      }, { status: 400 });
    }

    // Update user preferences
    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    
    await preferencesRef.set({
      allocationIntervalCents,
      updatedAt: new Date()
    }, { merge: true });

    return NextResponse.json({
      success: true,
      allocationIntervalCents
    });

  } catch (error) {
    console.error('[Allocation Interval POST] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to save allocation interval',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
