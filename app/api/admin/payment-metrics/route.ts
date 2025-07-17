/**
 * Admin API: Payment System Metrics
 * Provides real-time payment processing metrics for monitoring dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { checkAdminPermissions } from '../../admin-auth-helper';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';

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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get subscription metrics
    let activeSubscriptions = 0;
    let lastMonthActiveSubscriptions = 0;

    try {
      console.log('[Payment Metrics] Querying active subscriptions...');
      const subscriptionsSnapshot = await adminDb.collectionGroup('subscription')
        .where('status', '==', 'active')
        .get();

      activeSubscriptions = subscriptionsSnapshot.size;
      console.log(`[Payment Metrics] Found ${activeSubscriptions} active subscriptions`);
    } catch (error: any) {
      console.error('[Payment Metrics] Error querying active subscriptions:', {
        error: error.message,
        code: error.code,
        query: 'collectionGroup(subscription).where(status, ==, active)',
        stack: error.stack
      });
      // Continue with 0 value
    }

    try {
      console.log('[Payment Metrics] Querying last month active subscriptions...');
      const lastMonthSubscriptionsSnapshot = await adminDb.collectionGroup('subscription')
        .where('status', '==', 'active')
        .where('createdAt', '<=', lastMonthEnd)
        .get();

      lastMonthActiveSubscriptions = lastMonthSubscriptionsSnapshot.size;
      console.log(`[Payment Metrics] Found ${lastMonthActiveSubscriptions} last month active subscriptions`);
    } catch (error: any) {
      console.error('[Payment Metrics] Error querying last month subscriptions:', {
        error: error.message,
        code: error.code,
        query: 'collectionGroup(subscription).where(status, ==, active).where(createdAt, <=, lastMonthEnd)',
        requiredIndex: 'subscription collection: (status, createdAt)',
        lastMonthEnd: lastMonthEnd.toISOString(),
        stack: error.stack
      });
      // Continue with 0 value
    }
    const subscriptionGrowth = lastMonthActiveSubscriptions > 0 
      ? ((activeSubscriptions - lastMonthActiveSubscriptions) / lastMonthActiveSubscriptions) * 100 
      : 0;

    // Get transaction tracking data for success/failure rates
    const transactionsSnapshot = await adminDb.collection('financialTransactions')
      .where('createdAt', '>=', today)
      .get();

    let successfulTransactions = 0;
    let failedTransactions = 0;
    let totalRevenue = 0;
    let transactionValues: number[] = [];

    transactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      if (transaction.type === 'SUBSCRIPTION_PAYMENT') {
        if (transaction.status === 'COMPLETED') {
          successfulTransactions++;
          totalRevenue += transaction.amount || 0;
          transactionValues.push(transaction.amount || 0);
        } else if (transaction.status === 'FAILED') {
          failedTransactions++;
        }
      }
    });

    const totalTransactions = successfulTransactions + failedTransactions;
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 100;
    const errorRate = totalTransactions > 0 ? (failedTransactions / totalTransactions) * 100 : 0;
    const averageTransactionValue = transactionValues.length > 0 
      ? transactionValues.reduce((sum, val) => sum + val, 0) / transactionValues.length 
      : 0;

    // Get this month's revenue
    const thisMonthTransactionsSnapshot = await adminDb.collection('financialTransactions')
      .where('type', '==', 'SUBSCRIPTION_PAYMENT')
      .where('status', '==', 'COMPLETED')
      .where('createdAt', '>=', thisMonth)
      .get();

    let thisMonthRevenue = 0;
    thisMonthTransactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      thisMonthRevenue += transaction.amount || 0;
    });

    // Get last month's revenue for growth calculation
    const lastMonthTransactionsSnapshot = await adminDb.collection('financialTransactions')
      .where('type', '==', 'SUBSCRIPTION_PAYMENT')
      .where('status', '==', 'COMPLETED')
      .where('createdAt', '>=', lastMonth)
      .where('createdAt', '<', thisMonth)
      .get();

    let lastMonthRevenue = 0;
    lastMonthTransactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      lastMonthRevenue += transaction.amount || 0;
    });

    const revenueGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Get failed payment retry metrics
    let failedPayments = 0;

    try {
      console.log('[Payment Metrics] Querying failed payments...');
      const failedPaymentsSnapshot = await adminDb.collectionGroup('subscription')
        .where('status', 'in', ['past_due', 'unpaid'])
        .where('lastFailedPaymentAt', '>=', today.toISOString())
        .get();

      failedPayments = failedPaymentsSnapshot.size;
      console.log(`[Payment Metrics] Found ${failedPayments} failed payments`);
    } catch (error: any) {
      console.error('[Payment Metrics] Error querying failed payments:', {
        error: error.message,
        code: error.code,
        query: 'collectionGroup(subscription).where(status, in, [past_due, unpaid]).where(lastFailedPaymentAt, >=, today)',
        requiredIndex: 'subscription collection: (status, lastFailedPaymentAt)',
        today: today.toISOString(),
        stack: error.stack
      });
      // Continue with 0 value
    }

    // Calculate retry success rate (simplified - would need more detailed tracking)
    const retrySuccessRate = failedPayments > 0 ? Math.max(0, 100 - (failedPayments * 10)) : 100;

    // Webhook health calculation (simplified - would need webhook event tracking)
    const webhookHealth = successRate; // Using success rate as proxy for webhook health

    const metrics = {
      totalRevenue: thisMonthRevenue,
      revenueGrowth,
      activeSubscriptions,
      subscriptionGrowth,
      successRate,
      errorRate,
      averageTransactionValue,
      failedPayments,
      retrySuccessRate,
      webhookHealth
    };

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Payment Metrics] Critical error in payment metrics API:', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      endpoint: '/api/admin/payment-metrics'
    });

    return NextResponse.json({
      error: 'Failed to fetch payment metrics',
      details: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      debugInfo: {
        message: 'Check server logs for detailed error information',
        possibleCauses: [
          'Missing Firebase indexes for subscription queries',
          'Firestore permissions issue',
          'Invalid date range calculations',
          'Collection structure mismatch'
        ]
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}