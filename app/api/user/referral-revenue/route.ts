/**
 * Referral Revenue API
 *
 * Calculates the revenue earned from referrals based on the 30% share
 * of the 10% payout fee that WeWrite takes from referred users' payouts.
 *
 * Revenue calculation:
 * - WeWrite takes a 10% payout fee on each payout
 * - Referrers earn 30% of that fee (3% of the referred user's payout)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { PLATFORM_FEE_CONFIG } from '../../../config/platformFee';

export const dynamic = 'force-dynamic';

// Referrer gets 30% of the payout fee
const REFERRAL_SHARE = 0.30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Get all users who were referred by this user
    const referredUsersSnapshot = await db.collection(getCollectionName('users'))
      .where('referredBy', '==', userId)
      .get();

    if (referredUsersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        totalReferrals: 0,
        totalPayoutsCents: 0,
        totalFeesEarnedCents: 0,
        referralDetails: [],
      });
    }

    const referredUserIds = referredUsersSnapshot.docs.map(doc => doc.id);

    // Get completed payouts for all referred users
    // Note: Firestore doesn't support 'in' queries with more than 30 items,
    // so we need to batch if there are many referred users
    let totalPayoutsCents = 0;
    let totalFeesEarnedCents = 0;
    const referralDetails: Array<{
      username: string;
      totalPayoutsCents: number;
      feesEarnedCents: number;
      payoutCount: number;
    }> = [];

    // Process in batches of 30 (Firestore 'in' query limit)
    const batchSize = 30;
    for (let i = 0; i < referredUserIds.length; i += batchSize) {
      const batch = referredUserIds.slice(i, i + batchSize);

      const payoutsSnapshot = await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', 'in', batch)
        .where('status', '==', 'completed')
        .get();

      // Group payouts by user
      const payoutsByUser = new Map<string, { totalCents: number; count: number }>();

      payoutsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const existing = payoutsByUser.get(data.userId) || { totalCents: 0, count: 0 };
        existing.totalCents += data.amountCents || 0;
        existing.count += 1;
        payoutsByUser.set(data.userId, existing);
      });

      // Calculate fees for each user in this batch
      for (const [referredUserId, payoutData] of payoutsByUser) {
        // Find the username for this referred user
        const userDoc = referredUsersSnapshot.docs.find(d => d.id === referredUserId);
        const username = userDoc?.data()?.username || 'Anonymous';

        // Calculate: 10% payout fee * 30% referral share = 3% of total payouts
        const platformFeeCents = Math.round(payoutData.totalCents * PLATFORM_FEE_CONFIG.PERCENTAGE);
        const referralFeeCents = Math.round(platformFeeCents * REFERRAL_SHARE);

        totalPayoutsCents += payoutData.totalCents;
        totalFeesEarnedCents += referralFeeCents;

        referralDetails.push({
          username,
          totalPayoutsCents: payoutData.totalCents,
          feesEarnedCents: referralFeeCents,
          payoutCount: payoutData.count,
        });
      }
    }

    // Sort by fees earned (highest first)
    referralDetails.sort((a, b) => b.feesEarnedCents - a.feesEarnedCents);

    return NextResponse.json({
      success: true,
      totalReferrals: referredUserIds.length,
      totalPayoutsCents,
      totalFeesEarnedCents,
      referralSharePercent: REFERRAL_SHARE * 100,
      platformFeePercent: PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY,
      referralDetails: referralDetails.slice(0, 20), // Limit to top 20
    });
  } catch (error) {
    console.error('[REFERRAL REVENUE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalReferrals: 0,
      totalPayoutsCents: 0,
      totalFeesEarnedCents: 0,
      referralDetails: [],
    });
  }
}
