/**
 * Payout Request API Endpoint
 * 
 * Allows users to request a payout of their available balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { PayoutService } from '../../../services/payoutService';
import { PLATFORM_FEE_CONFIG } from '../../../config/platformFee';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user's email is verified before allowing payout
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const admin = getFirebaseAdmin();
    if (admin) {
      try {
        const userRecord = await admin.auth().getUser(userId);
        if (!userRecord.emailVerified) {
          return NextResponse.json({
            success: false,
            error: 'Please verify your email address before requesting a payout'
          }, { status: 403 });
        }
      } catch (authError) {
        console.error('[PAYOUT REQUEST] Error checking email verification:', authError);
        // Allow to continue if we can't check - Stripe will handle verification
      }
    }

    // Optional: Get requested amount from body (defaults to full available balance)
    let requestedAmountCents: number | undefined;
    try {
      const body = await request.json();
      if (body.amountCents) {
        requestedAmountCents = body.amountCents;
      }
    } catch {
      // No body or invalid JSON - use full available balance
    }

    console.log(`[PAYOUT REQUEST] User ${userId} requesting payout${requestedAmountCents ? ` of ${requestedAmountCents} cents` : ''}`);

    // Use the unified payout service
    const result = await PayoutService.requestPayout(userId, requestedAmountCents);

    if (!result.success) {
      console.warn(`[PAYOUT REQUEST] Failed for user ${userId}: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    console.log(`[PAYOUT REQUEST] Success for user ${userId}: payoutId=${result.payoutId}`);

    return NextResponse.json({
      success: true,
      payoutId: result.payoutId,
      transferId: result.transferId,
      message: 'Payout request submitted successfully'
    });

  } catch (error: any) {
    console.error('[PAYOUT REQUEST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to request payout'
    }, { status: 500 });
  }
}

/**
 * GET - Check payout eligibility
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's available balance using calculated balance (Phase 2)
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../utils/environmentConfig');
    const { UsdEarningsService } = await import('../../../services/usdEarningsService');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    const db = admin.firestore();

    // Get balance calculated from earnings (Phase 2 - single source of truth)
    const balance = await UsdEarningsService.getWriterUsdBalance(userId);
    const availableCents = balance?.availableUsdCents || 0;
    const availableDollars = availableCents / 100;

    // Get user's Stripe account status
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data() || {};
    const hasStripeAccount = !!userData.stripeConnectedAccountId;

    // Check eligibility
    const minimumDollars = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS;
    const meetsThreshold = availableDollars >= minimumDollars;
    const progressPercent = Math.min(100, (availableDollars / minimumDollars) * 100);
    const amountToThreshold = Math.max(0, minimumDollars - availableDollars);

    return NextResponse.json({
      eligible: meetsThreshold && hasStripeAccount,
      availableBalance: availableDollars,
      availableCents,
      minimumPayout: minimumDollars,
      minimumPayoutCents: PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS,
      meetsThreshold,
      progressPercent: Math.round(progressPercent * 10) / 10, // Round to 1 decimal
      amountToThreshold,
      hasStripeAccount,
      platformFeePercent: PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY,
      estimatedPayout: meetsThreshold ? availableDollars * (1 - PLATFORM_FEE_CONFIG.PERCENTAGE) : 0,
      message: !hasStripeAccount 
        ? 'Connect your bank account to receive payouts'
        : !meetsThreshold
          ? `You need $${amountToThreshold.toFixed(2)} more to reach the $${minimumDollars} minimum`
          : 'You are eligible to request a payout'
    });

  } catch (error: any) {
    console.error('[PAYOUT ELIGIBILITY] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to check eligibility'
    }, { status: 500 });
  }
}
