import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { isAdmin } from '../../../utils/isAdmin';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
} from 'firebase-admin/firestore';
import { format, eachDayOfInterval, eachHourOfInterval, startOfDay, endOfDay, startOfHour } from 'date-fns';

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

  return { buckets, formatLabel, granularity: granularityType };
}

// Helper function to safely parse date keys
function safeParseDateKey(dateKey: string, granularity: string): Date {
  try {
    let date: Date;

    if (granularity === 'hourly') {
      // Handle hourly format like "2025-06-25-14"
      const parts = dateKey.split('-');
      if (parts.length === 4) {
        const [year, month, day, hour] = parts.map(Number);
        date = new Date(year, month - 1, day, hour);
      } else {
        throw new Error(`Invalid hourly date format: ${dateKey}`);
      }
    } else {
      // Handle daily format like "2025-06-25"
      date = new Date(dateKey + 'T00:00:00.000Z');
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date key: ${dateKey} (granularity: ${granularity})`);
      return new Date();
    }

    return date;
  } catch (error) {
    console.warn(`Error parsing date key: ${dateKey}`, error);
    return new Date();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the current user from the request headers (set by middleware)
    const userEmail = request.headers.get('x-user-email');

    console.log('[Payment Analytics API] User email from headers:', userEmail);
    console.log('[Payment Analytics API] Is admin check:', userEmail ? isAdmin(userEmail) : 'no email');

    if (!userEmail || !isAdmin(userEmail)) {
      console.log('[Payment Analytics API] Unauthorized access attempt');
      return NextResponse.json({
        error: 'Unauthorized',
        debug: {
          hasEmail: !!userEmail,
          email: userEmail,
          isAdmin: userEmail ? isAdmin(userEmail) : false
        }
      }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity');
    const type = searchParams.get('type'); // 'revenue' or 'subscriptions'

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
        console.warn('[Payment Analytics] Composite index not available, using fallback query:', indexError.message);

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
        console.warn('[Payment Analytics] Subscriptions index not available, using fallback query:', indexError.message);

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
