import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import {
  Timestamp
} from 'firebase-admin/firestore';
import { format, eachDayOfInterval, eachHourOfInterval, startOfDay, endOfDay, startOfHour } from 'date-fns';

// Helper function to safely parse date keys
function safeParseDateKey(dateKey: string, granularity: string, context?: string): Date {
  try {
    // Handle different granularity formats
    if (granularity === 'hour') {
      // Format: YYYY-MM-DD-HH
      const [year, month, day, hour] = dateKey.split('-').map(Number);
      return new Date(year, month - 1, day, hour);
    } else {
      // Format: YYYY-MM-DD
      const [year, month, day] = dateKey.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
  } catch (error) {
    console.warn(`Error parsing date key "${dateKey}" in ${context || 'unknown context'}:`, error);
    return new Date(); // Fallback to current date
  }
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface RevenueMetrics {
  date: string;
  revenue: number;
  cumulativeRevenue: number;
  activeRevenue: number;
  cancelledRevenue: number;
  userCount: number;
  averageRevenuePerUser: number;
  churnRate: number;
}

interface SubscriptionMetrics {
  date: string;
  created: number;
  cancelled: number;
  active: number;
  cumulativeActive: number;
}

// Helper function to get time intervals
function getTimeIntervals(dateRange: DateRange, granularity?: number) {
  const diffInDays = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let buckets: string[];
  let formatLabel: (date: Date) => string;
  let granularityType: string;

  if (granularity && granularity <= 24) {
    // Hourly granularity
    granularityType = 'hourly';
    const hours = eachHourOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
    buckets = hours.map(hour => format(hour, 'yyyy-MM-dd-HH'));
    formatLabel = (date: Date) => format(date, 'MMM d, h a');
  } else {
    // Daily granularity
    granularityType = 'daily';
    const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
    buckets = days.map(day => format(day, 'yyyy-MM-dd'));
    formatLabel = (date: Date) => format(date, 'MMM d');
  }

  // Add formatKey function for date formatting
  const formatKey = (date: Date) => {
    if (granularityType === 'hourly') {
      return format(date, 'yyyy-MM-dd-HH');
    } else {
      return format(date, 'yyyy-MM-dd');
    }
  };

  return { buckets, formatLabel, formatKey, granularity: granularityType };
}



export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse(
        adminCheck.error === 'Unauthorized - no user ID' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        adminCheck.error
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity');
    const type = searchParams.get('type'); // 'revenue', 'subscriptions', 'conversion-funnel', or 'token-allocation'

    if (!startDate || !endDate || !type) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = admin.firestore();

    if (type === 'revenue') {
      // Get subscription revenue data
      const timeConfig = getTimeIntervals(dateRange, granularity ? parseInt(granularity) : undefined);

      // Query financial transactions for subscription payments
      // Note: Using separate queries to avoid index requirements in development
      let transactionsSnapshot;
      try {
        // Try the optimized query first (requires composite index)
        const transactionsQuery = db.collection('financial_transactions')
          .where('type', '==', 'SUBSCRIPTION_PAYMENT')
          .where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate))
          .where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate))
          .orderBy('createdAt', 'asc');

        transactionsSnapshot = await transactionsQuery.get();
      } catch (indexError) {
        console.warn('[Payment Analytics] Composite index not available, using fallback query:', indexError instanceof Error ? indexError.message : 'Unknown error');

        // Fallback: Query by type only, then filter in memory
        const fallbackQuery = db.collection('financial_transactions')
          .where('type', '==', 'SUBSCRIPTION_PAYMENT');

        const allTransactions = await fallbackQuery.get();

        // Filter by date range in memory
        const filteredDocs = allTransactions.docs.filter(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate();
          return createdAt &&
                 createdAt >= dateRange.startDate &&
                 createdAt <= dateRange.endDate;
        });

        // Create a mock snapshot object
        transactionsSnapshot = {
          docs: filteredDocs,
          size: filteredDocs.length,
          empty: filteredDocs.length === 0
        };
      }
      const transactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Group transactions by time bucket
      const dateMap = new Map<string, {
        activeRevenue: number;
        cancelledRevenue: number;
        userCount: number;
      }>();

      // Initialize all time buckets
      for (const bucket of timeConfig.buckets) {
        dateMap.set(bucket, {
          activeRevenue: 0,
          cancelledRevenue: 0,
          userCount: 0
        });
      }

      // Process transactions
      for (const transaction of transactions) {
        const createdAt = transaction.createdAt.toDate();
        const dateKey = timeConfig.granularity === 'hourly' 
          ? format(createdAt, 'yyyy-MM-dd-HH')
          : format(createdAt, 'yyyy-MM-dd');

        const bucket = dateMap.get(dateKey);
        if (bucket) {
          const amount = transaction.amount || 0;
          if (transaction.status === 'completed') {
            bucket.activeRevenue += amount;
          } else if (transaction.status === 'cancelled' || transaction.status === 'refunded') {
            bucket.cancelledRevenue += amount;
          }
          bucket.userCount++;
        }
      }

      // Convert to chart data format
      let cumulativeRevenue = 0;
      const result: RevenueMetrics[] = Array.from(dateMap.entries()).map(([dateKey, revenue]) => {
        const netRevenue = revenue.activeRevenue - revenue.cancelledRevenue;
        cumulativeRevenue += netRevenue;
        
        const averageRevenuePerUser = revenue.userCount > 0 ? revenue.activeRevenue / revenue.userCount : 0;
        const churnRate = revenue.userCount > 0 ? (revenue.cancelledRevenue / revenue.activeRevenue) * 100 : 0;
        
        const date = safeParseDateKey(dateKey, timeConfig.granularity);
        const label = timeConfig.formatLabel(date);

        return {
          date: label,
          revenue: Math.round(netRevenue * 100) / 100,
          cumulativeRevenue: Math.round(cumulativeRevenue * 100) / 100,
          activeRevenue: Math.round(revenue.activeRevenue * 100) / 100,
          cancelledRevenue: Math.round(revenue.cancelledRevenue * 100) / 100,
          userCount: revenue.userCount,
          averageRevenuePerUser: Math.round(averageRevenuePerUser * 100) / 100,
          churnRate: Math.round(churnRate * 100) / 100
        };
      });

      return NextResponse.json(result);

    } else if (type === 'subscriptions') {
      // Get subscriptions over time data
      const timeConfig = getTimeIntervals(dateRange, granularity ? parseInt(granularity) : undefined);

      // Query subscriptions created in the date range
      let subscriptionsSnapshot;
      try {
        // Try the optimized query first (requires index on createdAt)
        const subscriptionsQuery = db.collection('subscriptions')
          .where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate))
          .where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate))
          .orderBy('createdAt', 'asc');

        subscriptionsSnapshot = await subscriptionsQuery.get();
      } catch (indexError) {
        console.warn('[Payment Analytics] Subscriptions index not available, using fallback query:', indexError instanceof Error ? indexError.message : 'Unknown error');

        // Fallback: Get all subscriptions and filter in memory
        const allSubscriptions = await db.collection('subscriptions').get();

        // Filter by date range in memory
        const filteredDocs = allSubscriptions.docs.filter(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate();
          return createdAt &&
                 createdAt >= dateRange.startDate &&
                 createdAt <= dateRange.endDate;
        });

        // Create a mock snapshot object
        subscriptionsSnapshot = {
          docs: filteredDocs,
          size: filteredDocs.length,
          empty: filteredDocs.length === 0
        };
      }
      const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Group subscriptions by time bucket
      const dateMap = new Map<string, { created: number; cancelled: number }>();

      // Initialize all time buckets
      for (const bucket of timeConfig.buckets) {
        dateMap.set(bucket, { created: 0, cancelled: 0 });
      }

      // Process subscriptions
      for (const subscription of subscriptions) {
        const createdAt = subscription.createdAt.toDate();
        const dateKey = timeConfig.granularity === 'hourly' 
          ? format(createdAt, 'yyyy-MM-dd-HH')
          : format(createdAt, 'yyyy-MM-dd');

        const bucket = dateMap.get(dateKey);
        if (bucket) {
          bucket.created++;
          if (subscription.status === 'cancelled') {
            bucket.cancelled++;
          }
        }
      }

      // Convert to chart data format
      let cumulativeActive = 0;
      const result: SubscriptionMetrics[] = Array.from(dateMap.entries()).map(([dateKey, counts]) => {
        const netSubscriptions = counts.created - counts.cancelled;
        cumulativeActive += netSubscriptions;
        
        const date = safeParseDateKey(dateKey, timeConfig.granularity);
        const label = timeConfig.formatLabel(date);

        return {
          date: label,
          created: counts.created,
          cancelled: counts.cancelled,
          active: netSubscriptions,
          cumulativeActive: Math.max(0, cumulativeActive)
        };
      });

      return NextResponse.json(result);

    } else if (type === 'conversion-funnel') {
      // Get subscription conversion funnel data
      try {
        // Query analytics events for the funnel stages
        const analyticsQuery = db.collection('analytics_events')
          .where('timestamp', '>=', Timestamp.fromDate(dateRange.startDate))
          .where('timestamp', '<=', Timestamp.fromDate(dateRange.endDate))
          .where('category', '==', 'subscription')
          .orderBy('timestamp', 'asc');

        const analyticsSnapshot = await analyticsQuery.get();
        const events = analyticsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter events by action
        const funnelActions = [
          'subscription_flow_started',
          'subscription_abandoned_before_payment',
          'subscription_abandoned_during_payment',
          'subscription_completed',
          'first_token_allocation',
          'ongoing_token_allocation'
        ];

        const filteredEvents = events.filter(e => funnelActions.includes(e.action));

        // Count events by stage
        const stageCounts = {
          initiated: filteredEvents.filter(e => e.action === 'subscription_flow_started').length,
          abandoned_before_stripe: filteredEvents.filter(e => e.action === 'subscription_abandoned_before_payment').length,
          abandoned_during_stripe: filteredEvents.filter(e => e.action === 'subscription_abandoned_during_payment').length,
          completed: filteredEvents.filter(e => e.action === 'subscription_completed').length,
          first_allocation: filteredEvents.filter(e => e.action === 'first_token_allocation').length,
          ongoing_allocations: filteredEvents.filter(e => e.action === 'ongoing_token_allocation').length
        };

        // Calculate conversion rates and drop-offs
        const totalInitiated = stageCounts.initiated || 1; // Avoid division by zero

        const funnelData = [
          {
            stage: 'initiated',
            stageName: 'Subscription Flow Initiated',
            count: stageCounts.initiated,
            conversionRate: 100,
            dropOffRate: 0,
            description: 'Users who clicked subscribe'
          },
          {
            stage: 'abandoned_before_stripe',
            stageName: 'Abandoned Before Stripe',
            count: stageCounts.abandoned_before_stripe,
            conversionRate: ((totalInitiated - stageCounts.abandoned_before_stripe) / totalInitiated) * 100,
            dropOffRate: (stageCounts.abandoned_before_stripe / totalInitiated) * 100,
            description: 'Users who left before payment'
          },
          {
            stage: 'abandoned_during_stripe',
            stageName: 'Abandoned During Stripe',
            count: stageCounts.abandoned_during_stripe,
            conversionRate: ((totalInitiated - stageCounts.abandoned_before_stripe - stageCounts.abandoned_during_stripe) / totalInitiated) * 100,
            dropOffRate: (stageCounts.abandoned_during_stripe / totalInitiated) * 100,
            description: 'Users who started but didn\'t complete payment'
          },
          {
            stage: 'completed',
            stageName: 'Subscription Activated',
            count: stageCounts.completed,
            conversionRate: (stageCounts.completed / totalInitiated) * 100,
            dropOffRate: ((totalInitiated - stageCounts.completed) / totalInitiated) * 100,
            description: 'Completed payments via Stripe'
          },
          {
            stage: 'first_allocation',
            stageName: 'First Token Allocation',
            count: stageCounts.first_allocation,
            conversionRate: stageCounts.completed > 0 ? (stageCounts.first_allocation / stageCounts.completed) * 100 : 0,
            dropOffRate: stageCounts.completed > 0 ? ((stageCounts.completed - stageCounts.first_allocation) / stageCounts.completed) * 100 : 0,
            description: 'Users who allocated tokens to pages'
          },
          {
            stage: 'ongoing_allocations',
            stageName: 'Ongoing Allocations',
            count: stageCounts.ongoing_allocations,
            conversionRate: stageCounts.first_allocation > 0 ? (stageCounts.ongoing_allocations / stageCounts.first_allocation) * 100 : 0,
            dropOffRate: stageCounts.first_allocation > 0 ? ((stageCounts.first_allocation - stageCounts.ongoing_allocations) / stageCounts.first_allocation) * 100 : 0,
            description: 'Users who continue allocating monthly'
          }
        ];

        return NextResponse.json(funnelData);

      } catch (error) {
        console.error('Error fetching conversion funnel:', error);
        // Return empty funnel data on error
        return NextResponse.json([]);
      }

    } else if (type === 'token-allocation') {
      // Get token allocation metrics
      try {
        const timeConfig = getTimeIntervals(dateRange, granularity ? parseInt(granularity) : undefined);

        // Query token balances and allocations
        const tokenBalancesQuery = db.collection('tokenBalances')
          .where('lastAllocationDate', '>=', dateRange.startDate.toISOString())
          .where('lastAllocationDate', '<=', dateRange.endDate.toISOString());

        const tokenAllocationsQuery = db.collection('tokenAllocations')
          .where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate))
          .where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate))
          .orderBy('createdAt', 'asc');

        const [balancesSnapshot, allocationsSnapshot] = await Promise.all([
          tokenBalancesQuery.get(),
          tokenAllocationsQuery.get()
        ]);

        const balances = balancesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const allocations = allocationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Create date buckets for allocation tracking
        const dateMap = new Map();

        // Initialize all time buckets
        for (const bucket of timeConfig.buckets) {
          dateMap.set(bucket, {
            totalSubscribers: new Set(),
            subscribersWithAllocations: new Set(),
            totalTokensAllocated: 0,
            totalTokensAvailable: 0
          });
        }

        // Process token balances by date bucket
        balances.forEach(balance => {
          if (!balance.lastAllocationDate) return;

          let balanceDate;
          try {
            balanceDate = new Date(balance.lastAllocationDate);
            if (isNaN(balanceDate.getTime())) return;
          } catch (error) {
            return;
          }

          const dateKey = timeConfig.formatKey(balanceDate);

          if (dateMap.has(dateKey)) {
            const current = dateMap.get(dateKey);
            current.totalSubscribers.add(balance.userId);
            current.totalTokensAvailable += balance.totalTokens || 0;
          }
        });

        // Process token allocations by date bucket
        allocations.forEach(allocation => {
          const allocationDate = allocation.createdAt?.toDate() || new Date();
          const dateKey = timeConfig.formatKey(allocationDate);

          if (dateMap.has(dateKey)) {
            const current = dateMap.get(dateKey);
            current.subscribersWithAllocations.add(allocation.userId);
            current.totalTokensAllocated += allocation.tokens || 0;
          }
        });

        // Convert to chart data format
        const result = Array.from(dateMap.entries()).map(([dateKey, metrics]) => {
          const totalSubscribers = metrics.totalSubscribers.size;
          const subscribersWithAllocations = metrics.subscribersWithAllocations.size;
          const allocationPercentage = totalSubscribers > 0 ? (subscribersWithAllocations / totalSubscribers) * 100 : 0;
          const averageAllocationPercentage = metrics.totalTokensAvailable > 0 ? (metrics.totalTokensAllocated / metrics.totalTokensAvailable) * 100 : 0;

          const date = safeParseDateKey(dateKey, timeConfig.granularity);
          let label;
          try {
            label = timeConfig.formatLabel(date);
          } catch (error) {
            label = dateKey;
          }

          return {
            date: dateKey,
            totalSubscribers,
            subscribersWithAllocations,
            allocationPercentage,
            averageAllocationPercentage,
            totalTokensAllocated: metrics.totalTokensAllocated,
            totalTokensAvailable: metrics.totalTokensAvailable,
            label
          };
        });

        return NextResponse.json(result);

      } catch (error) {
        console.error('Error fetching token allocation metrics:', error);
        return NextResponse.json([]);
      }
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching payment analytics:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}