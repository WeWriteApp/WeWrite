/**
 * Debug endpoint to check allocation data
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerTokenService } from '../../../services/tokenService.server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'dev_test_user_1';

    console.log('Checking allocations for:', userId);

    // Get allocations from old system
    const oldSystemAllocations = await ServerTokenService.getAllocationsToUser(userId);

    // Also get testuser2's balance to see the structure
    const testuser2Balance = await ServerTokenService.getUserTokenBalance('dev_test_user_2');

    // Get raw document to see full structure
    const admin = getFirebaseAdmin();
    const db = admin?.firestore();
    let rawTestuser2Doc = null;

    if (db) {
      const docRef = db.collection(getCollectionName('tokenBalances')).doc('dev_test_user_2');
      const doc = await docRef.get();
      if (doc.exists) {
        rawTestuser2Doc = doc.data();
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      oldSystemAllocations,
      testuser2Balance,
      rawTestuser2Doc
    });

  } catch (error) {
    console.error('Error checking allocations:', error);
    return NextResponse.json({
      error: 'Failed to check allocations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
