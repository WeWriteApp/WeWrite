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

    console.log(`[ACCOUNT SUBSCRIPTION] Subscription data for user ${targetUserId}:`, {
      hasSubscription: !!subscription,
      status: subscription?.status,
      amount: subscription?.amount,
      tokens: (subscription as any)?.tokens,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      fullData: subscription
    });

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        status: null,
        fullData: null
      });
    }

    // Return the subscription data in the expected format
    return NextResponse.json({
      hasSubscription: true,
      status: subscription.status,
      amount: subscription.amount,
      tokens: (subscription as any).tokens,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      fullData: subscription
    });
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