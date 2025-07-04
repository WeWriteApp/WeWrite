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
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's subscription from Firestore using server-side function
    const subscription = await getUserSubscriptionServer(userId, { verbose: false });

    console.log(`[ACCOUNT SUBSCRIPTION] Subscription data for user ${userId}:`, {
      hasSubscription: !!subscription,
      status: subscription?.status,
      amount: subscription?.amount,
      tokens: subscription?.tokens,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      fullData: subscription
    });

    if (!subscription) {
      return NextResponse.json({ status: null });
    }

    // Return the subscription data
    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error fetching user subscription data:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching subscription data' },
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