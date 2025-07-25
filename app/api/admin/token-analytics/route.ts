import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { createApiResponse, createErrorResponse } from '../../auth-helper';

interface TokenAnalyticsData {
  unfundedLoggedOut: {
    totalTokens: number;
    totalUsdValue: number;
    allocations: number;
  };
  unfundedLoggedIn: {
    totalTokens: number;
    totalUsdValue: number;
    allocations: number;
  };
  funded: {
    totalTokens: number;
    totalUsdValue: number;
    allocations: number;
  };
  totalSubscriptionRevenue: number;
  totalWriterPayouts: number;
  platformFeeRevenue: number;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return createErrorResponse('BAD_REQUEST', 'startDate and endDate are required');
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    console.log('🔍 [Token Analytics] Fetching token analytics data...', dateRange);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const analytics = await getTokenAnalytics(db, dateRange);

    return createApiResponse({
      success: true,
      data: analytics,
      dateRange: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching token analytics:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch token analytics');
  }
}

async function getTokenAnalytics(db: any, dateRange: DateRange): Promise<TokenAnalyticsData> {
  console.log('🔍 [Token Analytics] Starting comprehensive token analytics calculation...');

  // Initialize analytics data
  const analytics: TokenAnalyticsData = {
    unfundedLoggedOut: { totalTokens: 0, totalUsdValue: 0, allocations: 0 },
    unfundedLoggedIn: { totalTokens: 0, totalUsdValue: 0, allocations: 0 },
    funded: { totalTokens: 0, totalUsdValue: 0, allocations: 0 },
    totalSubscriptionRevenue: 0,
    totalWriterPayouts: 0,
    platformFeeRevenue: 0
  };

  try {
    // 1. Get unfunded tokens from logged-out users (simulated tokens)
    // Note: This data is stored in localStorage, so we can't query it directly
    // We'll need to estimate based on analytics events or provide a separate endpoint
    console.log('📊 [Token Analytics] Calculating unfunded logged-out tokens...');
    // For now, we'll set this to 0 and add a TODO to implement proper tracking
    analytics.unfundedLoggedOut = { totalTokens: 0, totalUsdValue: 0, allocations: 0 };

    // 2. Get unfunded tokens from logged-in users without subscriptions
    console.log('📊 [Token Analytics] Calculating unfunded logged-in tokens...');
    const unfundedLoggedIn = await getUnfundedLoggedInTokens(db, dateRange);
    analytics.unfundedLoggedIn = unfundedLoggedIn;

    // 3. Get funded token allocations
    console.log('📊 [Token Analytics] Calculating funded token allocations...');
    const fundedTokens = await getFundedTokenAllocations(db, dateRange);
    analytics.funded = fundedTokens;

    // 4. Get total subscription revenue
    console.log('📊 [Token Analytics] Calculating subscription revenue...');
    const subscriptionRevenue = await getSubscriptionRevenue(db, dateRange);
    analytics.totalSubscriptionRevenue = subscriptionRevenue;

    // 5. Get total writer payouts
    console.log('📊 [Token Analytics] Calculating writer payouts...');
    const writerPayouts = await getWriterPayouts(db, dateRange);
    analytics.totalWriterPayouts = writerPayouts;

    // 6. Calculate platform fee revenue (7% of writer payouts)
    console.log('📊 [Token Analytics] Calculating platform fee revenue...');
    analytics.platformFeeRevenue = writerPayouts * 0.07;

    console.log('✅ [Token Analytics] Analytics calculation completed:', analytics);
    return analytics;

  } catch (error) {
    console.error('❌ [Token Analytics] Error calculating analytics:', error);
    throw error;
  }
}

async function getUnfundedLoggedInTokens(db: any, dateRange: DateRange) {
  try {
    // Query token allocations and cross-reference with user subscription status
    const tokenAllocationsRef = db.collection(getCollectionName('tokenAllocations'));
    const allocationsSnapshot = await tokenAllocationsRef
      .where('createdAt', '>=', dateRange.startDate)
      .where('createdAt', '<=', dateRange.endDate)
      .get();

    let totalTokens = 0;
    let allocations = 0;

    // Process each allocation and check if the user had an active subscription
    for (const doc of allocationsSnapshot.docs) {
      const allocation = doc.data();
      const userId = allocation.userId;
      const allocationDate = allocation.createdAt?.toDate() || new Date();

      // Check if user had active subscription at time of allocation
      const subscriptionsRef = db.collection(getCollectionName('subscriptions'));
      const userSubscriptionsSnapshot = await subscriptionsRef
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'past_due'])
        .where('currentPeriodStart', '<=', allocationDate)
        .where('currentPeriodEnd', '>=', allocationDate)
        .get();

      // If no active subscription at time of allocation, it's unfunded
      if (userSubscriptionsSnapshot.empty) {
        totalTokens += allocation.tokens || 0;
        allocations++;
      }
    }

    return {
      totalTokens,
      totalUsdValue: totalTokens * 0.1, // 10 tokens = $1
      allocations
    };
  } catch (error) {
    console.error('Error calculating unfunded logged-in tokens:', error);
    return { totalTokens: 0, totalUsdValue: 0, allocations: 0 };
  }
}

async function getFundedTokenAllocations(db: any, dateRange: DateRange) {
  try {
    const tokenAllocationsRef = db.collection(getCollectionName('tokenAllocations'));
    const allocationsSnapshot = await tokenAllocationsRef
      .where('createdAt', '>=', dateRange.startDate)
      .where('createdAt', '<=', dateRange.endDate)
      .where('status', '==', 'active')
      .get();

    let totalTokens = 0;
    let allocations = 0;

    // Process each allocation and check if the user had an active subscription
    for (const doc of allocationsSnapshot.docs) {
      const allocation = doc.data();
      const userId = allocation.userId;
      const allocationDate = allocation.createdAt?.toDate() || new Date();

      // Check if user had active subscription at time of allocation
      const subscriptionsRef = db.collection(getCollectionName('subscriptions'));
      const userSubscriptionsSnapshot = await subscriptionsRef
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'past_due'])
        .where('currentPeriodStart', '<=', allocationDate)
        .where('currentPeriodEnd', '>=', allocationDate)
        .get();

      // If user had active subscription at time of allocation, it's funded
      if (!userSubscriptionsSnapshot.empty) {
        totalTokens += allocation.tokens || 0;
        allocations++;
      }
    }

    return {
      totalTokens,
      totalUsdValue: totalTokens * 0.1, // 10 tokens = $1
      allocations
    };
  } catch (error) {
    console.error('Error calculating funded token allocations:', error);
    return { totalTokens: 0, totalUsdValue: 0, allocations: 0 };
  }
}

async function getSubscriptionRevenue(db: any, dateRange: DateRange): Promise<number> {
  try {
    // Get all subscription payments/charges within the date range
    // This should look at actual payment events, not just subscription creation

    // For now, we'll calculate based on active subscriptions and their billing cycles
    const subscriptionsRef = db.collection(getCollectionName('subscriptions'));
    const subscriptionsSnapshot = await subscriptionsRef
      .where('status', 'in', ['active', 'past_due'])
      .get();

    let totalRevenue = 0;

    subscriptionsSnapshot.forEach(doc => {
      const subscription = doc.data();
      const amount = subscription.amount || 0;
      const currentPeriodStart = subscription.currentPeriodStart?.toDate();
      const currentPeriodEnd = subscription.currentPeriodEnd?.toDate();

      // Check if the billing period overlaps with our date range
      if (currentPeriodStart && currentPeriodEnd) {
        const periodOverlapsRange = (
          currentPeriodStart <= dateRange.endDate &&
          currentPeriodEnd >= dateRange.startDate
        );

        if (periodOverlapsRange) {
          totalRevenue += amount;
        }
      }
    });

    return totalRevenue;
  } catch (error) {
    console.error('Error calculating subscription revenue:', error);
    return 0;
  }
}

async function getWriterPayouts(db: any, dateRange: DateRange): Promise<number> {
  try {
    const payoutsRef = db.collection(getCollectionName('tokenPayouts'));
    const payoutsSnapshot = await payoutsRef
      .where('completedAt', '>=', dateRange.startDate)
      .where('completedAt', '<=', dateRange.endDate)
      .where('status', '==', 'completed')
      .get();

    let totalPayouts = 0;

    payoutsSnapshot.forEach(doc => {
      const payout = doc.data();
      totalPayouts += payout.amount || 0;
    });

    return totalPayouts;
  } catch (error) {
    console.error('Error calculating writer payouts:', error);
    return 0;
  }
}
