/**
 * Admin API: Payment System Metrics
 * Provides real-time payment processing metrics for monitoring dashboard
 *
 * SOURCE OF TRUTH: Stripe API for all payment/subscription data
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import Stripe from 'stripe';
import { getStripe } from '../../../lib/stripe';

const stripe = getStripe();

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
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Convert to Unix timestamps for Stripe
    const todayTimestamp = Math.floor(today.getTime() / 1000);
    const thisMonthTimestamp = Math.floor(thisMonth.getTime() / 1000);
    const lastMonthTimestamp = Math.floor(lastMonth.getTime() / 1000);
    const lastMonthEndTimestamp = Math.floor(lastMonthEnd.getTime() / 1000);

    console.log('[Payment Metrics] Fetching metrics from Stripe (source of truth)...');

    // ========================================
    // 1. Get active subscriptions from Stripe
    // ========================================
    let activeSubscriptions = 0;
    let subscriptionMRR = 0;

    try {
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100
      });

      activeSubscriptions = subscriptions.data.length;

      // Calculate MRR from active subscriptions
      for (const sub of subscriptions.data) {
        const item = sub.items.data[0];
        if (item?.price?.unit_amount) {
          subscriptionMRR += item.price.unit_amount;
        }
      }

      console.log(`[Payment Metrics] Active subscriptions: ${activeSubscriptions}, MRR: ${subscriptionMRR}`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching subscriptions from Stripe:', error);
    }

    // ========================================
    // 2. Get subscriptions created last month for growth calculation
    // ========================================
    let lastMonthActiveSubscriptions = 0;

    try {
      // Get subscriptions that existed at the end of last month
      const lastMonthSubs = await stripe.subscriptions.list({
        created: { lte: lastMonthEndTimestamp },
        limit: 100
      });

      // Count only those that were active at month end
      lastMonthActiveSubscriptions = lastMonthSubs.data.filter(
        sub => sub.status === 'active' || sub.status === 'trialing'
      ).length;

      console.log(`[Payment Metrics] Last month subscriptions: ${lastMonthActiveSubscriptions}`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching last month subscriptions:', error);
    }

    const subscriptionGrowth = lastMonthActiveSubscriptions > 0
      ? ((activeSubscriptions - lastMonthActiveSubscriptions) / lastMonthActiveSubscriptions) * 100
      : (activeSubscriptions > 0 ? 100 : 0);

    // ========================================
    // 3. Get today's charges for success/failure rates
    // ========================================
    let successfulTransactions = 0;
    let failedTransactions = 0;
    let todayRevenue = 0;
    const transactionValues: number[] = [];

    try {
      const todayCharges = await stripe.charges.list({
        created: { gte: todayTimestamp },
        limit: 100
      });

      for (const charge of todayCharges.data) {
        if (charge.status === 'succeeded' && charge.paid) {
          successfulTransactions++;
          todayRevenue += charge.amount / 100; // Convert cents to dollars
          transactionValues.push(charge.amount / 100);
        } else if (charge.status === 'failed') {
          failedTransactions++;
        }
      }

      console.log(`[Payment Metrics] Today's charges - success: ${successfulTransactions}, failed: ${failedTransactions}`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching today charges:', error);
    }

    const totalTransactions = successfulTransactions + failedTransactions;
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 100;
    const errorRate = totalTransactions > 0 ? (failedTransactions / totalTransactions) * 100 : 0;
    const averageTransactionValue = transactionValues.length > 0
      ? transactionValues.reduce((sum, val) => sum + val, 0) / transactionValues.length
      : 0;

    // ========================================
    // 4. Get this month's revenue from Stripe charges
    // ========================================
    let thisMonthRevenue = 0;

    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const params: Stripe.ChargeListParams = {
          created: { gte: thisMonthTimestamp },
          limit: 100
        };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const charges = await stripe.charges.list(params);

        for (const charge of charges.data) {
          if (charge.status === 'succeeded' && charge.paid) {
            // Account for refunds
            const netAmount = (charge.amount - charge.amount_refunded) / 100;
            thisMonthRevenue += netAmount;
          }
        }

        hasMore = charges.has_more;
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }
      }

      console.log(`[Payment Metrics] This month revenue: $${thisMonthRevenue.toFixed(2)}`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching this month revenue:', error);
    }

    // ========================================
    // 5. Get last month's revenue for growth calculation
    // ========================================
    let lastMonthRevenue = 0;

    try {
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const params: Stripe.ChargeListParams = {
          created: {
            gte: lastMonthTimestamp,
            lt: thisMonthTimestamp
          },
          limit: 100
        };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const charges = await stripe.charges.list(params);

        for (const charge of charges.data) {
          if (charge.status === 'succeeded' && charge.paid) {
            const netAmount = (charge.amount - charge.amount_refunded) / 100;
            lastMonthRevenue += netAmount;
          }
        }

        hasMore = charges.has_more;
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }
      }

      console.log(`[Payment Metrics] Last month revenue: $${lastMonthRevenue.toFixed(2)}`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching last month revenue:', error);
    }

    const revenueGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : (thisMonthRevenue > 0 ? 100 : 0);

    // ========================================
    // 6. Get failed/past_due subscriptions from Stripe
    // ========================================
    let failedPayments = 0;

    try {
      const pastDueSubs = await stripe.subscriptions.list({
        status: 'past_due',
        limit: 100
      });

      const unpaidSubs = await stripe.subscriptions.list({
        status: 'unpaid',
        limit: 100
      });

      failedPayments = pastDueSubs.data.length + unpaidSubs.data.length;
      console.log(`[Payment Metrics] Failed/past_due subscriptions: ${failedPayments}`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching failed subscriptions:', error);
    }

    // ========================================
    // 7. Get webhook health from Stripe events
    // ========================================
    let webhookHealth = 100;

    try {
      // Check recent webhook events for failures
      const recentEvents = await stripe.events.list({
        created: { gte: todayTimestamp },
        limit: 100
      });

      // Count pending deliveries (indicates webhook issues)
      const pendingEvents = recentEvents.data.filter(
        event => event.pending_webhooks > 0
      ).length;

      const totalEvents = recentEvents.data.length;
      webhookHealth = totalEvents > 0
        ? Math.round(((totalEvents - pendingEvents) / totalEvents) * 100)
        : 100;

      console.log(`[Payment Metrics] Webhook health: ${webhookHealth}%`);
    } catch (error) {
      console.error('[Payment Metrics] Error fetching webhook health:', error);
    }

    // ========================================
    // 8. Calculate retry success rate from payment intents
    // ========================================
    let retrySuccessRate = 100;

    try {
      // Look at payment intents that required action or failed initially
      const recentIntents = await stripe.paymentIntents.list({
        created: { gte: thisMonthTimestamp },
        limit: 100
      });

      const retriedIntents = recentIntents.data.filter(
        intent => intent.status === 'succeeded' &&
        (intent.last_payment_error || (intent.charges?.data?.length ?? 0) > 1)
      ).length;

      const failedIntents = recentIntents.data.filter(
        intent => intent.status === 'requires_payment_method' ||
        intent.status === 'canceled'
      ).length;

      const totalRetries = retriedIntents + failedIntents;
      retrySuccessRate = totalRetries > 0
        ? Math.round((retriedIntents / totalRetries) * 100)
        : 100;

      console.log(`[Payment Metrics] Retry success rate: ${retrySuccessRate}%`);
    } catch (error) {
      console.error('[Payment Metrics] Error calculating retry success rate:', error);
    }

    const metrics = {
      totalRevenue: thisMonthRevenue,
      revenueGrowth,
      activeSubscriptions,
      subscriptionGrowth,
      subscriptionMRR: subscriptionMRR / 100, // Convert cents to dollars
      successRate,
      errorRate,
      averageTransactionValue,
      failedPayments,
      retrySuccessRate,
      webhookHealth,
      dataSource: 'Stripe API (source of truth)'
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
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}