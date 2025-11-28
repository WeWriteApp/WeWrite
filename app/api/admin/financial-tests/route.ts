/**
 * Admin Financial Test - Cleanup
 *
 * DELETE: clear all test ledger and batch records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { detectEnvironmentType } from '../../../utils/environmentDetection';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

const TEST_COLLECTION = 'adminFinancialTestLedger';
const TEST_BATCH_COLLECTION = 'adminFinancialTestPayoutBatches';

export async function DELETE(request: NextRequest) {
  try {
    const envType = detectEnvironmentType();
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    const userId = await getUserIdFromRequest(request);
    const isAdmin = userId ? await isAdminUser(userId) : false;
    const devBypass = envType === 'development' && isLocalhost;

    if (!userId && !devBypass) {
      return NextResponse.json({ error: 'Unauthorized', debug: { envType, host } }, { status: 401 });
    }
    if (!isAdmin && !devBypass) {
      return NextResponse.json({ error: 'Admin access required', debug: { envType, host, userId } }, { status: 403 });
    }
    if (envType === 'production' && !isLocalhost) {
      return NextResponse.json({ error: 'Test cleanup is blocked in production', debug: { envType, host } }, { status: 403 });
    }

    const adminSdk = getFirebaseAdmin();
    if (!adminSdk) {
      return NextResponse.json({ error: 'Firebase Admin not initialized', debug: { envType, host } }, { status: 500 });
    }
    const adminDb = adminSdk.firestore();

    const collectionsToClear = [TEST_COLLECTION, TEST_BATCH_COLLECTION];
    let deletedCount = 0;

    for (const colName of collectionsToClear) {
      const snapshot = await adminDb.collection(colName).get();
      const deletions = snapshot.docs.map((doc) => doc.ref.delete());
      await Promise.all(deletions);
      deletedCount += snapshot.docs.length;
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: 'Test ledger and batch records cleared.'
    });
  } catch (error) {
    console.error('❌ [ADMIN] financial-tests cleanup error', error);
    return NextResponse.json({ error: 'Failed to clear test records' }, { status: 500 });
  }
}
