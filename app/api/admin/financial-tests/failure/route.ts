/**
 * Admin Financial Test - Simulate Payout Failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { isAdminUser } from '../../../../utils/adminUtils';
import { detectEnvironmentType } from '../../../../utils/environmentDetection';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';

const TEST_BATCH_COLLECTION = 'adminFinancialTestPayoutBatches';

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Test failures are blocked in production', debug: { envType, host } }, { status: 403 });
    }

    const { failureCode = 'test_failure', note } = await request.json();
    console.log('🧪 [ADMIN] Simulate test payout failure request', { envType, host, devBypass, failureCode, note, userId });

    const adminSdk = getFirebaseAdmin();
    if (!adminSdk) {
      return NextResponse.json({ error: 'Firebase Admin not initialized', debug: { envType, host } }, { status: 500 });
    }
    const adminDb = adminSdk.firestore();
    const ts = adminSdk.firestore.FieldValue.serverTimestamp();

    const payload = {
      type: 'test_payout_failure',
      test: true,
      createdAt: ts,
      createdBy: userId || 'dev-bypass',
      status: 'failed',
      failureCode,
      note: note || null
    };

    const batchRef = await adminDb.collection(TEST_BATCH_COLLECTION).add(payload);
    console.log('🧪 [ADMIN] Test payout failure recorded', { id: batchRef.id, ...payload });

    return NextResponse.json({
      success: true,
      batchId: batchRef.id,
      failureCode,
      message: 'Test payout failure recorded (no live transfer executed).'
    });
  } catch (error) {
    console.error('❌ [ADMIN] financial-tests/failure error', error);
    return NextResponse.json({ error: 'Failed to simulate payout failure' }, { status: 500 });
  }
}
