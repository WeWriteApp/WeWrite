/**
 * Admin Financial Test - Simulate Earnings
 *
 * Creates a test ledger entry flagged with test=true. Does NOT touch real balances.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { isAdminUser } from '../../../../utils/adminUtils';
import { detectEnvironmentType } from '../../../../utils/environmentDetection';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';

const TEST_COLLECTION = 'adminFinancialTestLedger';

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
      return NextResponse.json({ error: 'Test earnings is blocked in production', debug: { envType, host } }, { status: 403 });
    }

    const { amount = 25, payerUserId, pageId, connectedAccountId, fee = 0, note } = await request.json();

    const gross = Number(amount) || 0;
    const feeAmount = Number(fee) || 0;
    const net = Math.max(0, gross - feeAmount);

    const adminSdk = getFirebaseAdmin();
    if (!adminSdk) {
      return NextResponse.json({ error: 'Firebase Admin not initialized', debug: { envType, host } }, { status: 500 });
    }
    const adminDb = adminSdk.firestore();
    const ts = adminSdk.firestore.FieldValue.serverTimestamp();

    const payload = {
      type: 'test_earning',
      test: true,
      createdAt: ts,
      createdBy: userId || 'dev-bypass',
      gross,
      fee: feeAmount,
      net,
      payerUserId: payerUserId || null,
      pageId: pageId || null,
      connectedAccountId: connectedAccountId || null,
      note: note || null,
      status: 'pending'
    };

    const docRef = await adminDb.collection(TEST_COLLECTION).add(payload);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      gross,
      net,
      message: 'Test earning simulated (test ledger only).'
    });
  } catch (error) {
    console.error('❌ [ADMIN] financial-tests/earnings error', error);
    return NextResponse.json({
      error: 'Failed to simulate earnings',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
