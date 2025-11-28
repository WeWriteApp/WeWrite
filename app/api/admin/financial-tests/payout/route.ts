/**
 * Admin Financial Test - Simulate Payout
 *
 * Creates a test payout batch record for the provided test ledger entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { isAdminUser } from '../../../../utils/adminUtils';
import { detectEnvironmentType } from '../../../../utils/environmentDetection';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { stripeStorageBalanceService } from '../../../../services/stripeStorageBalanceService';

const TEST_BATCH_COLLECTION = 'adminFinancialTestPayoutBatches';

export async function POST(request: NextRequest) {
  const envType = detectEnvironmentType();
  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const userId = await getUserIdFromRequest(request);
  const isAdmin = userId ? await isAdminUser(userId) : false;
  const devBypass = envType === 'development' && isLocalhost;

  try {
    if (!userId && !devBypass) {
      return NextResponse.json({ error: 'Unauthorized', debug: { envType, host } }, { status: 401 });
    }
    if (!isAdmin && !devBypass) {
      return NextResponse.json({ error: 'Admin access required', debug: { envType, host, userId } }, { status: 403 });
    }
    if (envType === 'production' && !isLocalhost) {
      return NextResponse.json({ error: 'Test payouts are blocked in production', debug: { envType, host } }, { status: 403 });
    }

    const requestBody = await request.json();
    const { amount = 25, connectedAccountId, note } = requestBody;
    console.log('🧪 [ADMIN] Simulate test payout request', { envType, host, devBypass, amount, connectedAccountId, note, userId });
    const total = Number(amount) || 0;
    const createdBy = userId || 'dev-bypass';

    const adminSdk = getFirebaseAdmin();
    if (!adminSdk) {
      return NextResponse.json({ error: 'Firebase Admin not initialized', debug: { envType, host } }, { status: 500 });
    }
    const adminDb = adminSdk.firestore();
    const ts = adminSdk.firestore.FieldValue.serverTimestamp();

    const batchPayload = {
      type: 'test_payout',
      test: true,
      createdAt: ts,
      createdBy,
      total,
      connectedAccountId: connectedAccountId || null,
      note: note || null,
      status: 'queued',
      results: []
    };

    const batchRef = await adminDb.collection(TEST_BATCH_COLLECTION).add(batchPayload);
    console.log('🧪 [ADMIN] Test payout batch recorded', { id: batchRef.id, ...batchPayload });

    // If we have a connected account, run a real test-mode transfer to Stripe
    const payoutDestination = connectedAccountId || process.env.TEST_STRIPE_CONNECTED_ACCOUNT_ID;
    let stripeResult: any = null;
    if (payoutDestination && total > 0) {
      const description = `Test payout batch ${batchRef.id}`;
      stripeResult = await stripeStorageBalanceService.processPayoutFromStorage(
        total,
        payoutDestination,
        createdBy,
        description
      );

      // Persist Stripe result
      const status = stripeResult?.success ? 'completed' : 'failed';
      await batchRef.update({
        status,
        stripeTransferId: stripeResult?.transferId || null,
        stripeError: stripeResult?.error || null,
        updatedAt: ts
      });

      console.log('🧪 [ADMIN] Stripe test payout result', { batchId: batchRef.id, status, stripeResult });
    } else {
      console.log('🧪 [ADMIN] No connectedAccountId provided; recorded batch only (no Stripe call).');
    }

    return NextResponse.json({
      success: true,
      batchId: batchRef.id,
      total,
      message: payoutDestination
        ? 'Test payout recorded and Stripe test transfer attempted.'
        : 'Test payout batch recorded (no Stripe transfer because no destination provided).',
      stripeResult,
      debug: { envType, host, devBypass, userId, isAdmin }
    });
  } catch (error) {
    console.error('❌ [ADMIN] financial-tests/payout error', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      envType,
      host,
      devBypass,
      userId,
      isAdmin
    });
    return NextResponse.json({
      error: 'Failed to simulate payout',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      debug: { envType, host, devBypass, userId, isAdmin }
    }, { status: 500 });
  }
}
