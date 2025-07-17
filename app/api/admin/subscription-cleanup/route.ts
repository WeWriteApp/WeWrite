/**
 * Administrative Subscription Cleanup API
 * 
 * This endpoint provides utilities to clean up multiple subscriptions for customers,
 * ensuring a clean billing experience in the Stripe Customer Portal.
 * 
 * SECURITY: This endpoint should only be accessible to administrators.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';

// Initialize Firebase Admin and Stripe
const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'});

interface CleanupResult {
  customerId: string;
  userId?: string;
  totalSubscriptions: number;
  cancelledSubscriptions: number;
  activeSubscriptions: number;
  errors: string[];
}

interface CleanupSummary {
  totalCustomersProcessed: number;
  totalSubscriptionsCancelled: number;
  customersWithMultipleSubscriptions: number;
  errors: string[];
  results: CleanupResult[];
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user and verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin - only jamiegray2234@gmail.com has admin access
    const userRecord = await adminApp.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || userEmail !== 'jamiegray2234@gmail.com') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      dryRun = true, 
      customerId = null, 
      maxCustomers = 50,
      includeStatuses = ['canceled', 'incomplete', 'past_due', 'unpaid']
    } = body;

    console.log(`[SUBSCRIPTION CLEANUP] Starting cleanup - DryRun: ${dryRun}, CustomerId: ${customerId}, MaxCustomers: ${maxCustomers}`);

    const summary: CleanupSummary = {
      totalCustomersProcessed: 0,
      totalSubscriptionsCancelled: 0,
      customersWithMultipleSubscriptions: 0,
      errors: [],
      results: []
    };

    if (customerId) {
      // Clean up specific customer
      const result = await cleanupCustomerSubscriptions(customerId, includeStatuses, dryRun);
      summary.results.push(result);
      summary.totalCustomersProcessed = 1;
      summary.totalSubscriptionsCancelled = result.cancelledSubscriptions;
      if (result.totalSubscriptions > 1) {
        summary.customersWithMultipleSubscriptions = 1;
      }
    } else {
      // Clean up all customers with multiple subscriptions
      const customers = await findCustomersWithMultipleSubscriptions(maxCustomers);
      
      for (const customer of customers) {
        try {
          const result = await cleanupCustomerSubscriptions(customer.id, includeStatuses, dryRun);
          summary.results.push(result);
          summary.totalCustomersProcessed++;
          summary.totalSubscriptionsCancelled += result.cancelledSubscriptions;
          if (result.totalSubscriptions > 1) {
            summary.customersWithMultipleSubscriptions++;
          }
        } catch (error) {
          const errorMsg = `Failed to process customer ${customer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          summary.errors.push(errorMsg);
          console.error(`[SUBSCRIPTION CLEANUP] ${errorMsg}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary,
      message: dryRun 
        ? 'Dry run completed - no actual changes made' 
        : 'Cleanup completed successfully'
    });

  } catch (error) {
    console.error('[SUBSCRIPTION CLEANUP] Error:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

async function findCustomersWithMultipleSubscriptions(maxCustomers: number): Promise<Stripe.Customer[]> {
  const customersWithMultiple: Stripe.Customer[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore && customersWithMultiple.length < maxCustomers) {
    const customers = await stripe.customers.list({
      limit: 100,
      starting_after: startingAfter});

    for (const customer of customers.data) {
      if (customersWithMultiple.length >= maxCustomers) break;

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 100});

      if (subscriptions.data.length > 1) {
        customersWithMultiple.push(customer);
      }
    }

    hasMore = customers.has_more;
    if (customers.data.length > 0) {
      startingAfter = customers.data[customers.data.length - 1].id;
    }
  }

  return customersWithMultiple;
}

async function cleanupCustomerSubscriptions(
  customerId: string, 
  includeStatuses: string[], 
  dryRun: boolean
): Promise<CleanupResult> {
  const result: CleanupResult = {
    customerId,
    totalSubscriptions: 0,
    cancelledSubscriptions: 0,
    activeSubscriptions: 0,
    errors: []
  };

  try {
    // Get Firebase user ID for this customer
    const usersSnapshot = await adminDb.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      result.userId = usersSnapshot.docs[0].id;
    }

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100});

    result.totalSubscriptions = subscriptions.data.length;

    if (subscriptions.data.length <= 1) {
      return result; // No cleanup needed
    }

    // Sort subscriptions by creation date (newest first)
    const sortedSubscriptions = subscriptions.data.sort((a, b) => b.created - a.created);
    
    // Keep the newest active subscription, cancel others
    let keptActiveSubscription = false;

    for (const subscription of sortedSubscriptions) {
      if (subscription.status === 'active') {
        if (!keptActiveSubscription) {
          // Keep the first (newest) active subscription
          keptActiveSubscription = true;
          result.activeSubscriptions++;
          console.log(`[CLEANUP] Keeping active subscription ${subscription.id} for customer ${customerId}`);
        } else {
          // Cancel additional active subscriptions
          if (!dryRun) {
            await stripe.subscriptions.cancel(subscription.id);
          }
          result.cancelledSubscriptions++;
          console.log(`[CLEANUP] ${dryRun ? 'Would cancel' : 'Cancelled'} duplicate active subscription ${subscription.id} for customer ${customerId}`);
        }
      } else if (includeStatuses.includes(subscription.status)) {
        // Cancel subscriptions with specified statuses
        if (!dryRun && subscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(subscription.id);
        }
        result.cancelledSubscriptions++;
        console.log(`[CLEANUP] ${dryRun ? 'Would cancel' : 'Cancelled'} ${subscription.status} subscription ${subscription.id} for customer ${customerId}`);
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMsg);
    console.error(`[CLEANUP] Error processing customer ${customerId}:`, error);
  }

  return result;
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to run cleanup.' },
    { status: 405 }
  );
}