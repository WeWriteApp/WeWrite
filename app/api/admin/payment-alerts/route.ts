/**
 * Admin API: Payment System Alerts
 * Provides real-time payment system alerts and error notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { checkAdminPermissions } from '../../admin-auth-helper';

const adminApp = initAdmin();
const adminDb = adminApp.firestore();

interface PaymentAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    userId?: string;
    subscriptionId?: string;
    transactionId?: string;
    errorCode?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const alerts: PaymentAlert[] = [];
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check for high error rates
    const recentTransactionsSnapshot = await adminDb.collection('financialTransactions')
      .where('createdAt', '>=', last24Hours)
      .where('type', '==', 'SUBSCRIPTION_PAYMENT')
      .get();

    let failedCount = 0;
    let totalCount = 0;

    recentTransactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      totalCount++;
      if (transaction.status === 'FAILED') {
        failedCount++;
      }
    });

    const errorRate = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;

    if (errorRate > 10) {
      alerts.push({
        id: `error_rate_${Date.now()}`,
        type: 'error',
        title: 'High Payment Error Rate',
        message: `Payment error rate is ${errorRate.toFixed(1)}% (${failedCount}/${totalCount} transactions failed in last 24h)`,
        timestamp: now,
        resolved: false,
        severity: errorRate > 25 ? 'critical' : errorRate > 15 ? 'high' : 'medium'
      });
    }

    // Check for failed subscriptions
    const failedSubscriptionsSnapshot = await adminDb.collectionGroup('subscription')
      .where('status', '==', 'past_due')
      .where('failureCount', '>=', 2)
      .get();

    if (failedSubscriptionsSnapshot.size > 0) {
      alerts.push({
        id: `failed_subs_${Date.now()}`,
        type: 'warning',
        title: 'Multiple Failed Subscriptions',
        message: `${failedSubscriptionsSnapshot.size} subscriptions have failed payment 2+ times`,
        timestamp: now,
        resolved: false,
        severity: failedSubscriptionsSnapshot.size > 10 ? 'high' : 'medium'
      });
    }

    // Check for webhook processing issues
    const recentWebhookErrorsSnapshot = await adminDb.collection('webhookErrors')
      .where('timestamp', '>=', last24Hours)
      .get();

    if (recentWebhookErrorsSnapshot.size > 5) {
      alerts.push({
        id: `webhook_errors_${Date.now()}`,
        type: 'error',
        title: 'Webhook Processing Issues',
        message: `${recentWebhookErrorsSnapshot.size} webhook errors in last 24 hours`,
        timestamp: now,
        resolved: false,
        severity: recentWebhookErrorsSnapshot.size > 20 ? 'critical' : 'high'
      });
    }

    // Check for Stripe API issues (simplified check)
    const recentStripeErrorsSnapshot = await adminDb.collection('financialTransactions')
      .where('createdAt', '>=', last24Hours)
      .where('status', '==', 'FAILED')
      .where('metadata.errorType', '==', 'stripe_error')
      .get();

    if (recentStripeErrorsSnapshot.size > 3) {
      alerts.push({
        id: `stripe_errors_${Date.now()}`,
        type: 'error',
        title: 'Stripe API Issues',
        message: `${recentStripeErrorsSnapshot.size} Stripe API errors detected`,
        timestamp: now,
        resolved: false,
        severity: recentStripeErrorsSnapshot.size > 10 ? 'critical' : 'high'
      });
    }

    // Check for subscription synchronization issues
    const unsyncedSubscriptionsSnapshot = await adminDb.collectionGroup('subscription')
      .where('lastSyncAt', '<', new Date(now.getTime() - 6 * 60 * 60 * 1000)) // 6 hours ago
      .where('status', '==', 'active')
      .get();

    if (unsyncedSubscriptionsSnapshot.size > 0) {
      alerts.push({
        id: `sync_issues_${Date.now()}`,
        type: 'warning',
        title: 'Subscription Sync Issues',
        message: `${unsyncedSubscriptionsSnapshot.size} subscriptions haven't synced with Stripe in 6+ hours`,
        timestamp: now,
        resolved: false,
        severity: unsyncedSubscriptionsSnapshot.size > 5 ? 'high' : 'medium'
      });
    }

    // Check for revenue anomalies
    const todayRevenue = await calculateDailyRevenue(now);
    const yesterdayRevenue = await calculateDailyRevenue(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    
    if (yesterdayRevenue > 0 && todayRevenue < yesterdayRevenue * 0.5) {
      alerts.push({
        id: `revenue_drop_${Date.now()}`,
        type: 'warning',
        title: 'Significant Revenue Drop',
        message: `Today's revenue is ${((1 - todayRevenue / yesterdayRevenue) * 100).toFixed(1)}% lower than yesterday`,
        timestamp: now,
        resolved: false,
        severity: todayRevenue < yesterdayRevenue * 0.3 ? 'high' : 'medium'
      });
    }

    // Sort alerts by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return NextResponse.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching payment alerts:', error);
    return NextResponse.json({
      error: 'Failed to fetch payment alerts',
      details: error.message
    }, { status: 500 });
  }
}

async function calculateDailyRevenue(date: Date): Promise<number> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const transactionsSnapshot = await adminDb.collection('financialTransactions')
    .where('type', '==', 'SUBSCRIPTION_PAYMENT')
    .where('status', '==', 'COMPLETED')
    .where('createdAt', '>=', startOfDay)
    .where('createdAt', '<', endOfDay)
    .get();

  let revenue = 0;
  transactionsSnapshot.forEach(doc => {
    const transaction = doc.data();
    revenue += transaction.amount || 0;
  });

  return revenue;
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
