import { NextRequest, NextResponse } from 'next/server';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { DEFAULT_ALLOCATION_INTERVAL_CENTS } from '../../../contexts/AllocationIntervalContext';
import { getAdminFirestore } from '../../../firebase/firebaseAdmin';

let _db: ReturnType<typeof getAdminFirestore> | null = null;
function getDb() {
  if (!_db) _db = getAdminFirestore();
  return _db;
}

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
    const preferencesRef = getDb().collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    const preferencesDoc = await preferencesRef.get();

    if (!preferencesDoc.exists) {
      // Return default interval if no preferences exist
      return NextResponse.json({
        allocationIntervalCents: DEFAULT_ALLOCATION_INTERVAL_CENTS
      });
    }

    const data = preferencesDoc.data();
    
    return NextResponse.json({
      allocationIntervalCents: data?.allocationIntervalCents || DEFAULT_ALLOCATION_INTERVAL_CENTS
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
    const preferencesRef = getDb().collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);

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
