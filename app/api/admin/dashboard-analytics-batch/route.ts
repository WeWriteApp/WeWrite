/**
 * Dashboard Analytics Batch API
 *
 * Consolidates 14+ individual API calls into a single request.
 * Queries each collection once and splits results in memory.
 *
 * Performance optimizations:
 * - analytics_events queried ONCE, filtered by event type in memory
 * - writerUsdEarnings queried ONCE, split by status in memory
 * - pages queried ONCE for pages, replies, and links
 * - Parallel fetching of independent collections
 * - In-memory caching with 5-minute TTL
 * - HTTP cache headers for browser caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync, getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';
import { platformRevenueService } from '../../../services/platformRevenueService';

// In-memory cache with 5-minute TTL
const analyticsCache = new Map<string, { data: BatchResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface ChartDataPoint {
  date: string;
  label: string;
  count: number;
}

interface BatchResponse {
  accounts: ChartDataPoint[];
  pages: ChartDataPoint[];
  shares: ChartDataPoint[];
  contentChanges: ChartDataPoint[];
  pwaInstalls: ChartDataPoint[];
  visitors: ChartDataPoint[];
  replies: ChartDataPoint[];
  links: ChartDataPoint[];
  notifications: ChartDataPoint[];
  followedUsers: ChartDataPoint[];
  platformRevenue: any[];
  payouts: any[];
  pendingEarnings: any[];
  finalEarnings: any[];
}

function getCacheKey(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`;
}

function getFromCache(cacheKey: string): BatchResponse | null {
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  // Clean up expired entry
  if (cached) {
    analyticsCache.delete(cacheKey);
  }
  return null;
}

function setCache(cacheKey: string, data: BatchResponse): void {
  analyticsCache.set(cacheKey, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      // Check admin permissions
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json({ error: adminCheck.error || 'Unauthorized' }, { status: 401 });
      }

      const admin = getFirebaseAdmin();
      if (!admin) {
        return NextResponse.json({ error: 'Database not available' }, { status: 503 });
      }

      const db = admin.firestore();
      const { searchParams } = new URL(request.url);

      const startDateStr = searchParams.get('startDate');
      const endDateStr = searchParams.get('endDate');

      if (!startDateStr || !endDateStr) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }

      const dateRange: DateRange = { startDate, endDate };

      // Check cache
      const cacheKey = getCacheKey(startDateStr, endDateStr);
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log('[BATCH API] Cache hit for', cacheKey);
        return NextResponse.json({
          success: true,
          data: cachedData,
          metadata: {
            cacheHit: true,
            generatedAt: new Date().toISOString()
          }
        }, {
          headers: {
            'Cache-Control': 'private, max-age=300',
            'X-Cache-Hit': 'true',
            'X-Cache-Generated': new Date().toISOString()
          }
        });
      }

      console.log('[BATCH API] Cache miss, fetching all data for', cacheKey);
      const fetchStart = Date.now();

      // Fetch all data in parallel using Promise.all
      // Group by collection to minimize Firestore queries
      const [
        analyticsEventsData,
        pagesData,
        usersData,
        earningsData,
        followsData,
        payoutsData,
        pageViewsData,
        emailLogsData,
        platformRevenueData
      ] = await Promise.all([
        // 1. analytics_events - ONE query, filter by event type in memory
        fetchAnalyticsEventsOnce(db, admin, dateRange),
        // 2. pages - ONE query, compute pages/replies/links
        fetchPagesOnce(db, dateRange),
        // 3. users - new accounts
        fetchUsersOnce(db, dateRange),
        // 4. writerUsdEarnings - ONE query, split by status
        fetchEarningsOnce(db, dateRange),
        // 5. follows - for followed users metric
        fetchFollowsOnce(db, dateRange),
        // 6. usdPayouts - for payout analytics
        fetchPayoutsOnce(db, dateRange),
        // 7. pageViews - for visitor metrics
        fetchPageViewsOnce(db, dateRange),
        // 8. emailLogs - for notifications (combined with analytics_events for push)
        fetchEmailLogsOnce(db, dateRange),
        // 9. Platform revenue from service
        fetchPlatformRevenueData(dateRange)
      ]);

      // Process analytics events into different metrics (shares, pwaInstalls, push notifications)
      const { shares, pwaInstalls, pushNotifications } = processAnalyticsEvents(analyticsEventsData, dateRange);

      // Process pages data into pages, replies, and links
      const { pagesCreated, replies, links, contentChanges } = processPagesData(pagesData, dateRange);

      // Combine email logs with push notifications for notifications metric
      const notifications = combineNotifications(emailLogsData, pushNotifications, dateRange);

      // Process earnings into pending and final
      const { pendingEarnings, finalEarnings } = processEarnings(earningsData, dateRange);

      // Build response
      const batchData: BatchResponse = {
        accounts: processUsersData(usersData, dateRange),
        pages: pagesCreated,
        shares,
        contentChanges,
        pwaInstalls,
        visitors: processPageViews(pageViewsData, dateRange),
        replies,
        links,
        notifications,
        followedUsers: processFollows(followsData, dateRange),
        platformRevenue: platformRevenueData,
        payouts: processPayouts(payoutsData, dateRange),
        pendingEarnings,
        finalEarnings
      };

      // Cache the result
      setCache(cacheKey, batchData);

      const fetchDuration = Date.now() - fetchStart;
      console.log(`[BATCH API] Fetched all data in ${fetchDuration}ms`);

      return NextResponse.json({
        success: true,
        data: batchData,
        metadata: {
          cacheHit: false,
          generatedAt: new Date().toISOString(),
          fetchDuration: `${fetchDuration}ms`,
          period: `${startDateStr} to ${endDateStr}`
        }
      }, {
        headers: {
          'Cache-Control': 'private, max-age=300',
          'X-Cache-Hit': 'false',
          'X-Cache-Generated': new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('[BATCH API] Error:', error);
      return NextResponse.json({
        error: 'Failed to fetch dashboard analytics',
        details: error.message
      }, { status: 500 });
    }
  });
}

// ============ Data Fetching Functions ============

async function fetchAnalyticsEventsOnce(db: FirebaseFirestore.Firestore, admin: any, dateRange: DateRange) {
  const eventsCollectionName = await getCollectionNameAsync('analytics_events');
  const eventsRef = db.collection(eventsCollectionName);

  const startTimestamp = admin.firestore.Timestamp.fromDate(dateRange.startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(dateRange.endDate);

  const snapshot = await eventsRef
    .where('timestamp', '>=', startTimestamp)
    .where('timestamp', '<=', endTimestamp)
    .get();

  return snapshot.docs.map(doc => doc.data());
}

async function fetchPagesOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  const pagesCollectionName = await getCollectionNameAsync('pages');
  const pagesRef = db.collection(pagesCollectionName);

  const startDateStr = dateRange.startDate.toISOString();
  const endDateStr = dateRange.endDate.toISOString();

  const snapshot = await pagesRef
    .where('deleted', '==', false)
    .where('createdAt', '>=', startDateStr)
    .where('createdAt', '<=', endDateStr)
    .get();

  return snapshot.docs.map(doc => doc.data());
}

async function fetchUsersOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  const usersCollectionName = await getCollectionNameAsync('users');
  const usersRef = db.collection(usersCollectionName);

  const startDateStr = dateRange.startDate.toISOString();
  const endDateStr = dateRange.endDate.toISOString();

  const snapshot = await usersRef
    .where('createdAt', '>=', startDateStr)
    .where('createdAt', '<=', endDateStr)
    .get();

  return snapshot.docs.map(doc => doc.data());
}

async function fetchEarningsOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  const earningsCollection = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
  const snapshot = await db.collection(earningsCollection).get();
  return snapshot.docs.map(doc => doc.data());
}

async function fetchFollowsOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  try {
    const followsCollectionName = await getCollectionNameAsync('follows');
    const followsRef = db.collection(followsCollectionName);

    const snapshot = await followsRef
      .where('followedAt', '>=', dateRange.startDate)
      .where('followedAt', '<=', dateRange.endDate)
      .get();

    return snapshot.docs.map(doc => doc.data());
  } catch {
    // Index might not exist, return empty
    return [];
  }
}

async function fetchPayoutsOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  const payoutsCollection = getCollectionName(USD_COLLECTIONS.USD_PAYOUTS);
  const snapshot = await db.collection(payoutsCollection).get();
  return snapshot.docs.map(doc => doc.data());
}

async function fetchPageViewsOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  const pageViewsCollectionName = await getCollectionNameAsync('pageViews');
  const pageViewsRef = db.collection(pageViewsCollectionName);

  const startDateStr = dateRange.startDate.toISOString().split('T')[0];
  const endDateStr = dateRange.endDate.toISOString().split('T')[0];

  const snapshot = await pageViewsRef
    .where('date', '>=', startDateStr)
    .where('date', '<=', endDateStr)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchEmailLogsOnce(db: FirebaseFirestore.Firestore, dateRange: DateRange) {
  try {
    const emailLogsCollectionName = await getCollectionNameAsync('emailLogs');
    const emailLogsRef = db.collection(emailLogsCollectionName);

    const startDateStr = dateRange.startDate.toISOString();
    const endDateStr = dateRange.endDate.toISOString();

    const snapshot = await emailLogsRef
      .where('sentAt', '>=', startDateStr)
      .where('sentAt', '<=', endDateStr)
      .get();

    return snapshot.docs.map(doc => doc.data());
  } catch {
    return [];
  }
}

async function fetchPlatformRevenueData(dateRange: DateRange) {
  try {
    const months: string[] = [];
    let currentDate = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1);
    const endDate = new Date(dateRange.endDate.getFullYear(), dateRange.endDate.getMonth(), 1);

    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    const chartData = [];
    for (const month of months) {
      try {
        const report = await platformRevenueService.getPlatformRevenueReport(month);
        const monthDate = new Date(month + '-01');
        chartData.push({
          date: month,
          platformFees: report?.revenueStreams?.platformFees?.amount || 0,
          unallocatedFunds: report?.revenueStreams?.unallocatedFunds?.amount || 0,
          totalRevenue: report?.totalRevenue || 0,
          label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      } catch {
        const monthDate = new Date(month + '-01');
        chartData.push({
          date: month,
          platformFees: 0,
          unallocatedFunds: 0,
          totalRevenue: 0,
          label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
    }
    return chartData;
  } catch {
    return [];
  }
}

// ============ Data Processing Functions ============

function initializeDailyMap(dateRange: DateRange): Map<string, number> {
  const map = new Map<string, number>();
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dayKey = currentDate.toISOString().split('T')[0];
    map.set(dayKey, 0);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return map;
}

function mapToChartData(map: Map<string, number>): ChartDataPoint[] {
  return Array.from(map.entries()).map(([date, count]) => ({
    date,
    count,
    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));
}

function processAnalyticsEvents(events: any[], dateRange: DateRange) {
  const shares = initializeDailyMap(dateRange);
  const pwaInstalls = initializeDailyMap(dateRange);
  const pushNotifications = initializeDailyMap(dateRange);

  for (const event of events) {
    const timestamp = event.timestamp;
    if (!timestamp) continue;

    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      continue;
    }

    const dayKey = date.toISOString().split('T')[0];

    switch (event.eventType) {
      case 'share_event':
        if (shares.has(dayKey)) shares.set(dayKey, shares.get(dayKey)! + 1);
        break;
      case 'pwa_install':
        if (pwaInstalls.has(dayKey)) pwaInstalls.set(dayKey, pwaInstalls.get(dayKey)! + 1);
        break;
      case 'pwa_notification_sent':
        if (pushNotifications.has(dayKey)) pushNotifications.set(dayKey, pushNotifications.get(dayKey)! + 1);
        break;
    }
  }

  return {
    shares: mapToChartData(shares),
    pwaInstalls: mapToChartData(pwaInstalls),
    pushNotifications
  };
}

function processPagesData(pages: any[], dateRange: DateRange) {
  const pagesCreated = initializeDailyMap(dateRange);
  const replies = initializeDailyMap(dateRange);
  const linksMap = initializeDailyMap(dateRange);
  const contentChanges = initializeDailyMap(dateRange);

  for (const page of pages) {
    const createdAt = page.createdAt;
    if (!createdAt) continue;

    let dateStr: string;
    if (typeof createdAt === 'string') {
      dateStr = createdAt.split('T')[0];
    } else if (createdAt.toDate) {
      dateStr = createdAt.toDate().toISOString().split('T')[0];
    } else {
      continue;
    }

    if (!pagesCreated.has(dateStr)) continue;

    // Count all pages
    pagesCreated.set(dateStr, pagesCreated.get(dateStr)! + 1);

    // Count replies (pages with replyTo)
    if (page.replyTo) {
      replies.set(dateStr, replies.get(dateStr)! + 1);
    }

    // Count links in content
    if (page.content && Array.isArray(page.content)) {
      const linkCount = countLinksInContent(page.content);
      linksMap.set(dateStr, linksMap.get(dateStr)! + linkCount);
    }
  }

  return {
    pagesCreated: mapToChartData(pagesCreated),
    replies: mapToChartData(replies),
    links: mapToChartData(linksMap),
    contentChanges: mapToChartData(contentChanges)
  };
}

function countLinksInContent(nodes: any[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'link') {
      count++;
    }
    if (node.children && Array.isArray(node.children)) {
      count += countLinksInContent(node.children);
    }
  }
  return count;
}

function processUsersData(users: any[], dateRange: DateRange): ChartDataPoint[] {
  const dailyMap = initializeDailyMap(dateRange);

  for (const user of users) {
    const createdAt = user.createdAt;
    if (!createdAt) continue;

    let dateStr: string;
    if (typeof createdAt === 'string') {
      dateStr = createdAt.split('T')[0];
    } else if (createdAt.toDate) {
      dateStr = createdAt.toDate().toISOString().split('T')[0];
    } else {
      continue;
    }

    if (dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, dailyMap.get(dateStr)! + 1);
    }
  }

  return mapToChartData(dailyMap);
}

function processEarnings(earnings: any[], dateRange: DateRange) {
  // Generate month strings for the period
  const months: string[] = [];
  const current = new Date(dateRange.startDate);
  while (current <= dateRange.endDate) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    months.push(monthStr);
    current.setMonth(current.getMonth() + 1);
  }

  const pendingByMonth = new Map<string, { totalCents: number; writerSet: Set<string> }>();
  const finalByMonth = new Map<string, { totalCents: number; writerSet: Set<string> }>();

  // Initialize
  months.forEach(month => {
    pendingByMonth.set(month, { totalCents: 0, writerSet: new Set() });
    finalByMonth.set(month, { totalCents: 0, writerSet: new Set() });
  });

  // Process each earnings record
  for (const earning of earnings) {
    const earningMonth = earning.month;
    if (!months.includes(earningMonth)) continue;

    const status = earning.status || 'pending';
    const cents = earning.totalUsdCentsReceived || 0;
    if (cents <= 0) continue;

    if (status === 'pending') {
      const monthData = pendingByMonth.get(earningMonth)!;
      monthData.totalCents += cents;
      monthData.writerSet.add(earning.userId);
    } else if (status === 'available' || status === 'paid_out') {
      const monthData = finalByMonth.get(earningMonth)!;
      monthData.totalCents += cents;
      monthData.writerSet.add(earning.userId);
    }
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const pendingEarnings = months.map(month => {
    const data = pendingByMonth.get(month)!;
    const [year, monthNum] = month.split('-');
    return {
      date: month,
      label: `${monthNames[parseInt(monthNum) - 1]} '${year.slice(2)}`,
      earnings: data.totalCents,
      writers: data.writerSet.size
    };
  });

  const finalEarnings = months.map(month => {
    const data = finalByMonth.get(month)!;
    const [year, monthNum] = month.split('-');
    return {
      date: month,
      label: `${monthNames[parseInt(monthNum) - 1]} '${year.slice(2)}`,
      earnings: data.totalCents,
      writers: data.writerSet.size
    };
  });

  return { pendingEarnings, finalEarnings };
}

function combineNotifications(
  emailLogs: any[],
  pushNotificationsMap: Map<string, number>,
  dateRange: DateRange
): ChartDataPoint[] {
  const dailyMap = initializeDailyMap(dateRange);

  // Add email logs
  for (const log of emailLogs) {
    const sentAt = log.sentAt;
    if (sentAt && typeof sentAt === 'string') {
      const dateStr = sentAt.split('T')[0];
      if (dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, dailyMap.get(dateStr)! + 1);
      }
    }
  }

  // Add push notifications
  for (const [dateStr, count] of pushNotificationsMap.entries()) {
    if (dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, dailyMap.get(dateStr)! + count);
    }
  }

  return mapToChartData(dailyMap);
}

function processFollows(follows: any[], dateRange: DateRange): ChartDataPoint[] {
  const dailyMap = initializeDailyMap(dateRange);

  for (const follow of follows) {
    if (follow.deleted) continue;
    const followedAt = follow.followedAt;
    if (!followedAt) continue;

    let date: Date;
    if (followedAt.toDate) {
      date = followedAt.toDate();
    } else if (typeof followedAt === 'string' || typeof followedAt === 'number') {
      date = new Date(followedAt);
    } else {
      continue;
    }

    const dayKey = date.toISOString().split('T')[0];
    if (dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, dailyMap.get(dayKey)! + 1);
    }
  }

  return mapToChartData(dailyMap);
}

function processPayouts(payouts: any[], dateRange: DateRange): any[] {
  const dailyMap = new Map<string, { payouts: number; payoutCount: number }>();

  // Initialize
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dayKey = currentDate.toISOString().split('T')[0];
    dailyMap.set(dayKey, { payouts: 0, payoutCount: 0 });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (const payout of payouts) {
    if (payout.status !== 'completed') continue;

    let payoutDate: Date | null = null;
    const dateFields = ['requestedAt', 'createdAt', 'completedAt'];

    for (const field of dateFields) {
      if (payout[field]) {
        if (typeof payout[field].toDate === 'function') {
          payoutDate = payout[field].toDate();
          break;
        } else if (payout[field]._seconds) {
          payoutDate = new Date(payout[field]._seconds * 1000);
          break;
        } else if (typeof payout[field] === 'string' || typeof payout[field] === 'number') {
          payoutDate = new Date(payout[field]);
          break;
        }
      }
    }

    if (!payoutDate || isNaN(payoutDate.getTime())) continue;
    if (payoutDate < dateRange.startDate || payoutDate > dateRange.endDate) continue;

    const dayKey = payoutDate.toISOString().split('T')[0];
    const amount = payout.amountCents ? payout.amountCents / 100 : payout.amount || 0;

    const existing = dailyMap.get(dayKey);
    if (existing) {
      existing.payouts += amount;
      existing.payoutCount += 1;
    }
  }

  return Array.from(dailyMap.entries()).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    payouts: data.payouts,
    payoutCount: data.payoutCount
  }));
}

function processPageViews(pageViews: any[], dateRange: DateRange): ChartDataPoint[] {
  const dailyMap = new Map<string, number>();

  // Initialize
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dayKey = currentDate.toISOString().split('T')[0];
    dailyMap.set(dayKey, 0);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (const pv of pageViews) {
    const dateStr = pv.date;
    if (dateStr && dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, dailyMap.get(dateStr)! + (pv.totalViews || 0));
    }
  }

  return mapToChartData(dailyMap);
}
