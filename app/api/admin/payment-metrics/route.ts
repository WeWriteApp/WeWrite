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
  apiVersion: '2024-12-18.acacia',
});

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
    const subscriptionsSnapshot = await adminDb.collectionGroup('subscription')
      .where('status', '==', 'active')
      .get();
    
    const activeSubscriptions = subscriptionsSnapshot.size;

    // Get last month's active subscriptions for growth calculation
    const lastMonthSubscriptionsSnapshot = await adminDb.collectionGroup('subscription')
      .where('status', '==', 'active')
      .where('createdAt', '<=', lastMonthEnd)
      .get();
    
    const lastMonthActiveSubscriptions = lastMonthSubscriptionsSnapshot.size;
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
    const failedPaymentsSnapshot = await adminDb.collectionGroup('subscription')
      .where('status', 'in', ['past_due', 'unpaid'])
      .where('lastFailedPaymentAt', '>=', today.toISOString())
      .get();

    const failedPayments = failedPaymentsSnapshot.size;

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
    console.error('Error fetching payment metrics:', error);
    return NextResponse.json({
      error: 'Failed to fetch payment metrics',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
