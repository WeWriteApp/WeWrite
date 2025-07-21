/**
 * Account Subscription API
 * 
 * Provides user subscription data using server-side Firebase functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getUserSubscriptionServer } from '../../firebase/subscription-server';

export async function GET(request: NextRequest) {
  try {
    // Log environment info for debugging
    console.log('[ACCOUNT SUBSCRIPTION] Environment info:', {
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      url: request.url
    });

    // Get authenticated user
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      console.log('[ACCOUNT SUBSCRIPTION] No authenticated user found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if a specific userId is requested via query parameter
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get('userId');
    const targetUserId = requestedUserId || authenticatedUserId;

    console.log('[ACCOUNT SUBSCRIPTION] Authenticated user:', authenticatedUserId);
    console.log('[ACCOUNT SUBSCRIPTION] Target user:', targetUserId);

    // Get the user's subscription from Firestore using server-side function
    const subscription = await getUserSubscriptionServer(targetUserId, { verbose: true });

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
      console.log(`[ACCOUNT SUBSCRIPTION] 🟡 Returning inactive response for corrupted/missing data:`, inactiveResponse);
      return NextResponse.json(inactiveResponse);
    }

    // Handle inactive state (no subscription) - this is normal for users without subscriptions
    if (subscription.status === 'inactive') {
      console.log(`[ACCOUNT SUBSCRIPTION] 🟡 User ${targetUserId} has no active subscription (inactive state)`);
      const inactiveResponse = {
        hasSubscription: false,
        status: 'inactive',
        fullData: subscription
      };
      console.log(`[ACCOUNT SUBSCRIPTION] 🟡 Returning inactive response:`, inactiveResponse);
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