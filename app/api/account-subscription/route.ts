/**
 * Account Subscription API
 * 
 * Provides user subscription data using server-side Firebase functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getUserSubscriptionServer } from '../../firebase/subscription-server';
import { getDocumentOptimized, trackFirestoreRead } from '../../utils/firestoreOptimizer';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if a specific userId is requested via query parameter
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get('userId');
    const targetUserId = requestedUserId || authenticatedUserId;

    // Get the user's subscription with optimized caching (1 hour cache for subscriptions)
    let subscription = await getDocumentOptimized(
      `users/${targetUserId}/subscriptions`,
      'current',
      'subscriptions'
    );

    // Track read operation for monitoring
    trackFirestoreRead(1);

    // Fallback to original method if cache miss or no data
    if (!subscription) {
      subscription = await getUserSubscriptionServer(targetUserId, { verbose: true });
    }

    // Only log verbose subscription data when explicitly debugging
    if (process.env.SUBSCRIPTION_DEBUG === 'true') {
      console.log(`[ACCOUNT SUBSCRIPTION] 🔍 VERBOSE: Subscription data for user ${targetUserId}:`, {
        hasSubscription: !!subscription,
        status: subscription?.status,
        amount: subscription?.amount,
        tokens: (subscription as any)?.tokens,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
        subscriptionExists: subscription !== null,
        subscriptionType: typeof subscription,
        subscriptionKeys: subscription ? Object.keys(subscription) : null,
        fullData: subscription
      });
    } else {
      // Minimal logging for normal operation
      console.log(`[ACCOUNT SUBSCRIPTION] User ${targetUserId}: ${subscription?.status || 'no subscription'} (${subscription?.amount || 0} tokens)`);
    }

    if (!subscription) {
      console.log(`[ACCOUNT SUBSCRIPTION] 🔴 No subscription data found for user ${targetUserId} - treating as inactive user`);
      // Instead of returning an error, treat this as an inactive user
      // This handles cases where subscription data is corrupted or missing
      const inactiveResponse = {
        hasSubscription: false,
        status: 'inactive',
        fullData: {
          id: 'inactive',
          status: 'inactive',
          amount: 0,
          tier: null,
          stripeSubscriptionId: null
        }
      };
      // Inactive subscription - no logging needed
      return NextResponse.json(inactiveResponse);
    }

    // Handle inactive state (no subscription) - this is normal for users without subscriptions
    if (subscription.status === 'inactive') {
      const inactiveResponse = {
        hasSubscription: false,
        status: 'inactive',
        fullData: subscription
      };
      return NextResponse.json(inactiveResponse);
    }

    // Return the subscription data in the expected format
    const activeResponse = {
      hasSubscription: true,
      status: subscription.status,
      amount: subscription.amount,
      tokens: (subscription as any).tokens,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      fullData: subscription
    };
    // Only log full response when debugging
    if (process.env.SUBSCRIPTION_DEBUG === 'true') {
      console.log(`[ACCOUNT SUBSCRIPTION] ✅ Returning active subscription response:`, activeResponse);
    }
    return NextResponse.json(activeResponse);
  } catch (error: unknown) {
    console.error('Error fetching user subscription data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while fetching subscription data' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}