/**
 * Account Subscription API
 * 
 * Provides user subscription data using server-side Firebase functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getUserSubscriptionServer } from '../../firebase/subscription-server';
import { getDocumentOptimized, trackFirestoreRead } from '../../utils/firestoreOptimizer';
import { getEffectiveTier } from '../../utils/subscriptionTiers';

// EMERGENCY COST OPTIMIZATION: Aggressive subscription caching
const subscriptionCache = new Map<string, { data: any; timestamp: number }>();
const SUBSCRIPTION_CACHE_TTL = 2 * 60 * 1000; // Reduced to 2 minutes for faster updates

// Export cache for invalidation from other modules
export { subscriptionCache };

/**
 * Invalidate subscription cache for a specific user
 * Call this after subscription updates to ensure fresh data
 */
export const invalidateSubscriptionCache = (userId: string): void => {
  const cacheKey = `subscription:${userId}`;
  subscriptionCache.delete(cacheKey);
  console.log(`🔄 Invalidated subscription cache for user: ${userId}`);
};

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

    // EMERGENCY COST OPTIMIZATION: Check cache first
    const cacheKey = `subscription:${targetUserId}`;
    const cached = subscriptionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < SUBSCRIPTION_CACHE_TTL) {
      console.log(`🚀 EMERGENCY COST OPTIMIZATION: Returning cached subscription for ${targetUserId}`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // EMERGENCY FIX: Use admin SDK directly to avoid permission issues
    // Get the user's subscription using server-side method
    let subscription = await getUserSubscriptionServer(targetUserId, { verbose: true });

    // Track read operation for monitoring
    trackFirestoreRead(1);

    // Enable verbose logging only when SUBSCRIPTION_DEBUG is set
    const enableDebugLogging = process.env.SUBSCRIPTION_DEBUG === 'true';

    if (enableDebugLogging) {
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
          tier: 'inactive',  // Use 'inactive' string, not null, for consistent badge display
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
        fullData: {
          ...subscription,
          tier: 'inactive'  // Ensure tier is always 'inactive' for consistent badge display
        }
      };

      // EMERGENCY COST OPTIMIZATION: Cache inactive response too
      subscriptionCache.set(cacheKey, {
        data: inactiveResponse,
        timestamp: Date.now()
      });

      return NextResponse.json(inactiveResponse);
    }

    // Determine if subscription is truly active (not canceled, past_due, etc.)
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    // Compute the effective tier using centralized logic
    const effectiveTier = getEffectiveTier(
      subscription.amount ?? null,
      subscription.tier ?? null,
      subscription.status ?? null
    );

    // Return the subscription data in the expected format
    const activeResponse = {
      hasSubscription: isActive,
      status: subscription.status,
      amount: isActive ? subscription.amount : 0, // Only show amount if active
      tokens: (subscription as any).tokens,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      fullData: {
        ...subscription,
        tier: effectiveTier  // Always include computed tier for consistent badge display
      }
    };
    // Log full response for debugging
    if (enableDebugLogging) {
      console.log(`[ACCOUNT SUBSCRIPTION] ✅ Returning active subscription response:`, activeResponse);
    }

    // EMERGENCY COST OPTIMIZATION: Cache the response
    subscriptionCache.set(cacheKey, {
      data: activeResponse,
      timestamp: Date.now()
    });

    return NextResponse.json(activeResponse);
  } catch (error: unknown) {
    console.error('Error fetching user subscription data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred while fetching subscription data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, userId } = await request.json();

    if (action === 'invalidate-cache' && userId) {
      // Invalidate the cache for this user
      const cacheKey = `subscription:${userId}`;
      if (subscriptionCache.has(cacheKey)) {
        subscriptionCache.delete(cacheKey);
        console.log(`🗑️ Subscription cache invalidated for user: ${userId}`);
      }

      return NextResponse.json({
        success: true,
        message: `Cache invalidated for user ${userId}`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action or missing userId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }
}