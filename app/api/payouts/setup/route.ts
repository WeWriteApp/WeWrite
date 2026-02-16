/**
 * API endpoint for setting up creator payouts
 * Creates payout recipient and default revenue splits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { payoutService, PayoutService } from '../../../services/payoutService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

function getAdmin() { return getFirebaseAdmin(); }

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stripeConnectedAccountId, country, forceCreate = false } = body;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({
        error: 'Stripe connected account ID is required'
      }, { status: 400 });
    }

    // Verify the connected account belongs to this user
    const db = getAdmin().firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    const userData = userDoc.data();

    // Require verified email before proceeding with payouts
    // Check emailVerified from Firestore (synced from Firebase Auth) instead of calling admin.auth()
    // This avoids jose dependency issues in Vercel production
    const emailVerified = userData?.emailVerified === true;
    if (!emailVerified) {
      return NextResponse.json({
        error: 'Email not verified. Please verify your email before setting up payouts.',
        emailVerified: false
      }, { status: 403 });
    }

    if (userData?.stripeConnectedAccountId !== stripeConnectedAccountId) {
      return NextResponse.json({
        error: 'Invalid connected account'
      }, { status: 400 });
    }

    // Check if recipient already exists
    const existingRecipient = await payoutService.getPayoutRecipient(userId);
    if (existingRecipient) {
      // Verify Stripe account status for existing recipient
      const accountStatus = await PayoutService.verifyStripeAccount(stripeConnectedAccountId);

      return NextResponse.json({
        success: true,
        data: {
          recipient: existingRecipient,
          accountStatus
        },
        message: 'Payout recipient already exists'
      });
    }

    // Only create payout recipient if explicitly requested (when user has earnings)
    // or if forceCreate is true
    if (!forceCreate) {
      // Just verify account status without creating recipient
      const accountStatus = await PayoutService.verifyStripeAccount(stripeConnectedAccountId);

      return NextResponse.json({
        success: true,
        data: {
          recipient: null,
          accountStatus,
          message: 'Bank account verified. Payout recipient will be created when you have earnings to withdraw.'
        },
        message: 'Account verified successfully'
      });
    }

    // Verify Stripe account status
    const accountStatus = await PayoutService.verifyStripeAccount(stripeConnectedAccountId);

    // Create payout recipient
    const recipientResult = await payoutService.createPayoutRecipient(userId, stripeConnectedAccountId);

    if (!recipientResult.success) {
      return NextResponse.json({
        error: recipientResult.error
      }, { status: 500 });
    }

    // Get international payout info if country provided
    let internationalInfo = null;
    if (country) {
      internationalInfo = await PayoutService.getInternationalPayoutInfo(country);
    }

    // Create default revenue splits for user's existing pages
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('userId', '==', userId)
      .get();

    const splitPromises = pagesSnapshot.docs.map(pageDoc =>
      payoutService.createDefaultRevenueSplit('page', pageDoc.id, userId)
    );

    await Promise.all(splitPromises);

    // Create default revenue splits for user's groups
    const groupsSnapshot = await db.collection(getCollectionName('groups'))
      .where('createdBy', '==', userId)
      .get();

    const groupSplitPromises = groupsSnapshot.docs.map(groupDoc =>
      payoutService.createDefaultRevenueSplit('group', groupDoc.id, userId)
    );

    await Promise.all(groupSplitPromises);

    return NextResponse.json({
      success: true,
      data: {
        recipient: recipientResult.data,
        accountStatus,
        internationalInfo,
        pagesConfigured: pagesSnapshot.size,
        groupsConfigured: groupsSnapshot.size
      },
      message: 'Payout setup completed successfully'
    });

  } catch (error) {
    console.error('Error setting up payouts:', error);
    return NextResponse.json({
      error: 'Failed to setup payouts'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payout recipient info
    const recipient = await payoutService.getPayoutRecipient(userId);
    
    if (!recipient) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No payout setup found'
      });
    }

    // Verify Stripe account status
    const accountStatus = await PayoutService.verifyStripeAccount(
      recipient.stripeConnectedAccountId
    );

    // Get earnings breakdown
    const earningsBreakdown = await payoutService.getEarningsBreakdown(userId);

    return NextResponse.json({
      success: true,
      data: {
        recipient,
        accountStatus,
        earnings: earningsBreakdown
      }
    });

  } catch (error) {
    console.error('Error getting payout setup:', error);
    return NextResponse.json({
      error: 'Failed to get payout setup'
    }, { status: 500 });
  }
}
