/**
 * Admin API: Payout System Metrics
 * Provides real-time payout processing metrics for monitoring dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { checkAdminPermissions } from '../../admin-auth-helper';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2025-06-30.basil'});

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Calculate date ranges
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get payout metrics
    const payoutsSnapshot = await adminDb.collection(getCollectionName(COLLECTIONS.PAYOUTS))
      .where('createdAt', '>=', thisMonth)
      .get();

    let totalPayouts = 0;
    let successfulPayouts = 0;
    let failedPayouts = 0;
    let pendingPayouts = 0;
    let totalEarningsDistributed = 0;
    let payoutAmounts: number[] = [];

    payoutsSnapshot.forEach(doc => {
      const payout = doc.data();
      totalPayouts++;
      
      switch (payout.status) {
        case 'completed':
          successfulPayouts++;
          totalEarningsDistributed += payout.amount || 0;
          payoutAmounts.push(payout.amount || 0);
          break;
        case 'failed':
          failedPayouts++;
          break;
        case 'pending':
        case 'processing':
          pendingPayouts++;
          break;
      }
    });

    const successRate = totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 100;
    const errorRate = totalPayouts > 0 ? (failedPayouts / totalPayouts) * 100 : 0;
    const averagePayoutAmount = payoutAmounts.length > 0 
      ? payoutAmounts.reduce((sum, amount) => sum + amount, 0) / payoutAmounts.length 
      : 0;

    // Get last month's payouts for growth calculation
    const lastMonthPayoutsSnapshot = await adminDb.collection(getCollectionName(COLLECTIONS.PAYOUTS))
      .where('createdAt', '>=', lastMonth)
      .where('createdAt', '<', thisMonth)
      .get();

    let lastMonthEarnings = 0;
    lastMonthPayoutsSnapshot.forEach(doc => {
      const payout = doc.data();
      if (payout.status === 'completed') {
        lastMonthEarnings += payout.amount || 0;
      }
    });

    const payoutGrowth = lastMonthEarnings > 0 
      ? ((totalEarningsDistributed - lastMonthEarnings) / lastMonthEarnings) * 100 
      : 0;

    // Get active creators count
    const creatorsSnapshot = await adminDb.collection(getCollectionName('users'))
      .where('isCreator', '==', true)
      .where('lastActiveAt', '>=', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) // Active in last 30 days
      .get();

    const activeCreators = creatorsSnapshot.size;

    // Get last month's active creators for growth calculation
    const lastMonthCreatorsSnapshot = await adminDb.collection(getCollectionName('users'))
      .where('isCreator', '==', true)
      .where('lastActiveAt', '>=', lastMonth)
      .where('lastActiveAt', '<', thisMonth)
      .get();

    const lastMonthActiveCreators = lastMonthCreatorsSnapshot.size;
    const creatorGrowth = lastMonthActiveCreators > 0 
      ? ((activeCreators - lastMonthActiveCreators) / lastMonthActiveCreators) * 100 
      : 0;

    // Calculate next payout date (typically end of month)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextPayoutDate = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000); // Last day of current month

    // Stripe Connect health (simplified check)
    let stripeConnectHealth = 100;
    try {
      const account = await stripe.accounts.retrieve();
      if (!account.payouts_enabled) {
        stripeConnectHealth = 0;
      }
    } catch (error) {
      stripeConnectHealth = 0;
    }

    const metrics = {
      totalPayouts: totalEarningsDistributed,
      payoutGrowth,
      activeCreators,
      creatorGrowth,
      successRate,
      errorRate,
      averagePayoutAmount,
      pendingPayouts,
      failedPayouts,
      stripeConnectHealth,
      totalEarningsDistributed,
      nextPayoutDate: nextPayoutDate.toISOString()
    };

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching payout metrics:', error);
    return NextResponse.json({
      error: 'Failed to fetch payout metrics',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}