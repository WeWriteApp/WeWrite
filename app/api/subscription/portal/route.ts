/**
 * Stripe Customer Portal API
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
  apiVersion: '2024-06-20'});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if payments feature is enabled for this user
    const { checkPaymentsFeatureFlag } = await import('../../feature-flag-helper');
    const featureCheckResponse = await checkPaymentsFeatureFlag(userId);
    if (featureCheckResponse) {
      return featureCheckResponse;
    }

    // Get user's Stripe customer ID
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists || !userDoc.data()?.stripeCustomerId) {
      return NextResponse.json({
        error: 'No Stripe customer found for this user'
      }, { status: 404 });
    }

    const stripeCustomerId = userDoc.data()!.stripeCustomerId;

    // Before creating portal session, clean up any non-active subscriptions to improve UX
    await cleanupInactiveSubscriptionsForPortal(stripeCustomerId, userId);

    // Create customer portal session with configuration to minimize historical data
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
      configuration: await getOrCreatePortalConfiguration()});

    console.log(`Created portal session for user ${userId}`);

    return NextResponse.json({
      url: session.url});

  } catch (error) {
    console.error('Error creating portal session:', error);

    // Check if it's a Stripe configuration error
    if (error instanceof Error && error.message.includes('configuration')) {
      return NextResponse.json(
        {
          error: 'Customer Portal not configured',
          message: 'The Stripe Customer Portal needs to be configured in your Stripe Dashboard. Please visit https://dashboard.stripe.com/test/settings/billing/portal to set it up.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create portal session',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Clean up inactive subscriptions before showing portal to improve UX
 */
async function cleanupInactiveSubscriptionsForPortal(stripeCustomerId: string, userId: string) {
  try {
    console.log(`[PORTAL CLEANUP] Cleaning up inactive subscriptions for customer ${stripeCustomerId}`);

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 100});

    // Only proceed if there are multiple subscriptions
    if (subscriptions.data.length <= 1) {
      return;
    }

    // Sort by creation date (newest first)
    const sortedSubscriptions = subscriptions.data.sort((a, b) => b.created - a.created);

    // Keep the newest active subscription, cancel others that are in problematic states
    let keptActiveSubscription = false;
    const statusesToCleanup = ['incomplete', 'past_due', 'unpaid'];

    for (const subscription of sortedSubscriptions) {
      if (subscription.status === 'active') {
        if (!keptActiveSubscription) {
          keptActiveSubscription = true;
          console.log(`[PORTAL CLEANUP] Keeping active subscription ${subscription.id}`);
        } else {
          // Cancel duplicate active subscriptions
          console.log(`[PORTAL CLEANUP] Cancelling duplicate active subscription ${subscription.id}`);
          await stripe.subscriptions.cancel(subscription.id);
        }
      } else if (statusesToCleanup.includes(subscription.status)) {
        // Cancel problematic subscriptions that would confuse users in the portal
        console.log(`[PORTAL CLEANUP] Cancelling ${subscription.status} subscription ${subscription.id}`);
        await stripe.subscriptions.cancel(subscription.id);
      }
    }
  } catch (error) {
    console.error(`[PORTAL CLEANUP] Error cleaning up subscriptions for customer ${stripeCustomerId}:`, error);
    // Don't throw - portal should still work even if cleanup fails
  }
}

/**
 * Get or create a portal configuration that minimizes historical data display
 */
async function getOrCreatePortalConfiguration(): Promise<string | undefined> {
  try {
    // List existing configurations
    const configurations = await stripe.billingPortal.configurations.list({ limit: 10 });

    // Look for our custom configuration
    const existingConfig = configurations.data.find(config =>
      config.metadata?.purpose === 'wewrite_clean_portal'
    );

    if (existingConfig) {
      return existingConfig.id;
    }

    // Create a new configuration optimized for clean UX
    const newConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your WeWrite subscription'},
      features: {
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          proration_behavior: 'none'
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'none'
        },
        invoice_history: { enabled: true },
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'address']
        }
      },
      metadata: {
        purpose: 'wewrite_clean_portal',
        created_by: 'wewrite_api'
      }
    });

    console.log(`[PORTAL CONFIG] Created new portal configuration: ${newConfig.id}`);
    return newConfig.id;

  } catch (error) {
    console.error('[PORTAL CONFIG] Error managing portal configuration:', error);
    // Return undefined to use default configuration
    return undefined;
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}