/**
 * Admin API: User Management
 * Provides endpoints for managing users in the admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions, isUserRecordAdmin } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';

interface UserData {
  uid: string;
  email: string;
  username?: string;
  emailVerified: boolean;
  createdAt: any;
  lastLogin?: any;
  totalPages?: number;
  // Feature flags removed - all features are now always enabled
  stripeConnectedAccountId?: string | null;
  isAdmin?: boolean;
  referredBy?: string;
  referredByUsername?: string;
  referralSource?: string;
  pwaInstalled?: boolean;
  pwaVerified?: boolean;  // True if user has actually used PWA in standalone mode (not just claimed to install)
  notificationSparkline?: number[];
  tier?: string;  // Pre-computed effective tier for badge display
  financial?: {
    hasSubscription: boolean;
    subscriptionAmount?: number | null;
    subscriptionStatus?: string | null;
    subscriptionCancelReason?: string | null;
    availableEarningsUsd?: number;
    payoutsSetup: boolean;
    earningsTotalUsd?: number;
    earningsThisMonthUsd?: number;
    // Allocation data (how much of their subscription they've allocated this month)
    allocatedUsdCents?: number;
    unallocatedUsdCents?: number;
    totalBudgetUsdCents?: number;
  };
}

// GET endpoint - Get all users with their details and feature flag overrides
// OPTIMIZED: Uses parallel batch queries instead of sequential N+1 queries
export async function GET(request: NextRequest) {
  // Wrap the entire handler with admin context for proper environment detection
  return withAdminContext(request, async () => {
  const startTime = Date.now();

  try {
    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (initError: any) {
      console.error('[Admin Users API] Firebase Admin initialization error:', initError.message);
      return NextResponse.json({
        error: 'Firebase Admin initialization failed',
        details: initError.message
      }, { status: 500 });
    }

    if (!admin) {
      console.error('[Admin Users API] Firebase Admin failed to initialize');
      return NextResponse.json({
        error: 'Firebase Admin not available',
        details: 'Server configuration issue - check environment variables'
      }, { status: 500 });
    }
    const db = admin.firestore();

    // Verify admin access using session cookie (avoids firebase-admin auth/jose issues)
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const searchTerm = searchParams.get('search');
    const includeFinancial = searchParams.get('includeFinancial') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';

    // Collection names are now synchronous when using withAdminContext wrapper
    const usersCollectionName = getCollectionName('users');
    const pagesCollectionName = getCollectionName('pages');
    const writerEarningsCollectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
    const analyticsEventsCollectionName = getCollectionName('analytics_events');

    // Debug: Log which collections are being used
    console.log(`[Admin Users API] Using collections: users=${usersCollectionName}, pages=${pagesCollectionName}, earnings=${writerEarningsCollectionName}`);

    // If only the count is needed, return early
    if (countOnly) {
      try {
        const usersCollection = db.collection(usersCollectionName);
        if (typeof (usersCollection as any).count === 'function') {
          const countSnap = await (usersCollection as any).count().get();
          const totalCount = countSnap.data()?.count ?? 0;
          return NextResponse.json({ success: true, total: totalCount });
        }
      } catch (countError) {
        console.warn('Count query failed:', countError);
      }
      const snapshot = await db.collection(usersCollectionName).limit(1).get();
      return NextResponse.json({ success: true, total: snapshot.size });
    }

    // Query Firestore for user documents
    let snapshot;
    try {
      snapshot = await db.collection(usersCollectionName)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    } catch (orderingError) {
      console.warn('Order by createdAt failed; falling back to unordered fetch:', orderingError);
      snapshot = await db.collection(usersCollectionName).limit(limit).get();
    }

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        users: [],
        message: 'No users found in the database'
      });
    }

    console.log(`[Admin Users] Found ${snapshot.docs.length} users, fetching additional data...`);

    // Extract all user IDs for batch queries
    const userIds = snapshot.docs.map(doc => doc.id);

    // Get collection name for USD balances
    const usdBalancesCollectionName = getCollectionName(USD_COLLECTIONS.USD_BALANCES);

    // OPTIMIZATION: Run all data fetches in parallel instead of sequentially
    const [subscriptionsMap, earningsMap, pageCountsMap, referrerUsernamesMap, pwaInstallsMap, notificationSparklinesMap, usdBalancesMap] = await Promise.all([
      // 1. Fetch Firestore subscription documents (source of truth - updated by webhooks)
      includeFinancial ? batchFetchSubscriptions(db, usersCollectionName, userIds) : Promise.resolve(new Map()),

      // 2. Batch fetch all earnings (aggregated by userId)
      includeFinancial ? batchFetchEarnings(db, writerEarningsCollectionName, userIds) : Promise.resolve(new Map()),

      // 3. Batch fetch page counts (using parallel count queries)
      batchFetchPageCounts(db, pagesCollectionName, userIds),

      // 4. Pre-fetch referrer usernames
      batchFetchReferrerUsernames(db, usersCollectionName, snapshot.docs),

      // 5. Batch fetch PWA installation status from analytics_events
      batchFetchPWAInstalls(db, analyticsEventsCollectionName, userIds),

      // 6. Batch fetch notification sparklines (7-day data)
      batchFetchNotificationSparklines(db, userIds),

      // 7. Batch fetch USD balances (allocated/unallocated)
      includeFinancial ? batchFetchUsdBalances(db, usdBalancesCollectionName, userIds) : Promise.resolve(new Map()),
    ]);

    // Build user data array (now just simple object construction, no async)
    const userData: UserData[] = [];

    for (const userDoc of snapshot.docs) {
      const data = userDoc.data();
      const uid = userDoc.id;

      // Build basic user object
      const user: UserData = {
        uid,
        email: data.email || 'No email',
        username: data.username,
        emailVerified: data.emailVerified === true,
        createdAt: data.createdAt,
        lastLogin: data.lastLoginAt || data.lastLogin || null,
        stripeConnectedAccountId: data.stripeConnectedAccountId || null,
        isAdmin: data.isAdmin === true || isUserRecordAdmin(data.email || ''),
        referredBy: data.referredBy || undefined,
        referralSource: data.referralSource || undefined,
        totalPages: pageCountsMap.get(uid) ?? 0,
        pwaInstalled: pwaInstallsMap.get(uid)?.installed ?? false,
        pwaVerified: pwaInstallsMap.get(uid)?.verified ?? false,
        notificationSparkline: notificationSparklinesMap.get(uid) || Array(7).fill(0),
      };

      // Add referrer username if available
      if (user.referredBy && referrerUsernamesMap.has(user.referredBy)) {
        user.referredByUsername = referrerUsernamesMap.get(user.referredBy);
      }

      // Add financial data if requested
      if (includeFinancial) {
        const subscriptionData = subscriptionsMap.get(uid);
        const earningsData = earningsMap.get(uid) || { total: 0, available: 0, thisMonth: 0 };

        // Use Firestore subscription document as source of truth (updated by webhooks)
        let subscriptionAmount: number | null = null;
        let subscriptionStatus: string | null = null;
        let subscriptionCancelReason: string | null = null;

        if (subscriptionData) {
          subscriptionAmount = subscriptionData.amount;
          subscriptionStatus = subscriptionData.status;
          subscriptionCancelReason = subscriptionData.cancelReason || null;
        }

        // Pre-compute effective tier using centralized logic
        user.tier = getEffectiveTier(
          subscriptionAmount,
          subscriptionData?.tier ?? null,
          subscriptionStatus
        );

        // Get USD balance data for allocation info
        const usdBalanceData = usdBalancesMap.get(uid);

        user.financial = {
          hasSubscription: subscriptionStatus === 'active',
          subscriptionAmount,
          subscriptionStatus,
          subscriptionCancelReason,
          availableEarningsUsd: earningsData.available > 0 ? earningsData.available / 100 : undefined,
          earningsTotalUsd: earningsData.total > 0 ? earningsData.total / 100 : undefined,
          earningsThisMonthUsd: earningsData.thisMonth > 0 ? earningsData.thisMonth / 100 : undefined,
          payoutsSetup: Boolean(user.stripeConnectedAccountId),
          // Allocation data (how much of their subscription budget they've allocated)
          allocatedUsdCents: usdBalanceData?.allocatedUsdCents,
          unallocatedUsdCents: usdBalanceData?.availableUsdCents,
          totalBudgetUsdCents: usdBalanceData?.totalUsdCents,
        };
      }

      // Apply search filter if provided
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (user.email.toLowerCase().includes(searchLower) ||
            user.username?.toLowerCase().includes(searchLower)) {
          userData.push(user);
        }
      } else {
        userData.push(user);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Admin Users] Processed ${userData.length} users in ${duration}ms`);

    return NextResponse.json({
      success: true,
      users: userData,
      total: userData.length,
      _debug: { durationMs: duration }
    });

  } catch (error) {
    console.error('Error loading users:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load users',
      details: (error as Error).message
    }, { status: 500 });
  }
  }); // End withAdminContext
}

// Helper: Batch fetch subscription documents from Firestore (source of truth)
// Subscriptions are stored at users/{userId}/subscriptions/current and updated by webhooks
interface SubscriptionInfo {
  status: string;
  amount: number | null;
  cancelReason?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  tier?: string;
}

async function batchFetchSubscriptions(
  db: FirebaseFirestore.Firestore,
  usersCollectionName: string,
  userIds: string[]
): Promise<Map<string, SubscriptionInfo>> {
  const map = new Map<string, SubscriptionInfo>();
  if (userIds.length === 0) return map;

  try {
    // Fetch subscription documents from users/{userId}/subscriptions/current
    const refs = userIds.map(uid =>
      db.collection(usersCollectionName).doc(uid).collection('subscriptions').doc('current')
    );
    const docs = await db.getAll(...refs);

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const userId = userIds[i];

      if (doc.exists) {
        const data = doc.data()!;
        map.set(userId, {
          status: data.status || 'inactive',
          amount: data.amount ?? null,
          cancelReason: data.cancelReason,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          currentPeriodEnd: data.currentPeriodEnd,
          tier: data.tier,
        });
      }
    }

    console.log(`[Admin Users] Fetched ${map.size} subscription documents from Firestore`);
  } catch (err) {
    console.warn('[Admin Users] Error batch fetching subscriptions:', err);
  }
  return map;
}

// Helper: Batch fetch earnings aggregated by userId
async function batchFetchEarnings(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, { total: number; available: number; thisMonth: number }>> {
  const map = new Map<string, { total: number; available: number; thisMonth: number }>();
  if (userIds.length === 0) return map;

  // Get current month in YYYY-MM format for "this month" calculation
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    // Firestore 'in' query supports up to 30 items, batch if needed
    const batchSize = 30;
    const batches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      batches.push(
        db.collection(collectionName)
          .where('userId', 'in', batch)
          .get()
      );
    }

    const results = await Promise.all(batches);

    // Aggregate earnings by userId
    for (const snapshot of results) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = data.userId;
        const cents = data.totalUsdCentsReceived || data.totalCentsReceived || 0;
        const month = data.month; // YYYY-MM format

        if (!map.has(userId)) {
          map.set(userId, { total: 0, available: 0, thisMonth: 0 });
        }

        const entry = map.get(userId)!;
        entry.total += cents;

        // "This month" = earnings from current month (by month field, not status)
        if (month === currentMonth) {
          entry.thisMonth += cents;
        }

        // "Available" = earnings that can be paid out
        if (data.status === 'available') {
          entry.available += cents;
        }
      }
    }
  } catch (err) {
    console.warn('[Admin Users] Error batch fetching earnings:', err);
  }
  return map;
}

// Helper: Batch fetch page counts using parallel count queries
async function batchFetchPageCounts(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;

  try {
    // Run count queries in parallel (limit concurrency to avoid overwhelming Firestore)
    const CONCURRENCY = 20;
    const pagesCollection = db.collection(collectionName);

    for (let i = 0; i < userIds.length; i += CONCURRENCY) {
      const batch = userIds.slice(i, i + CONCURRENCY);
      const countPromises = batch.map(async (uid) => {
        try {
          const query = pagesCollection.where('userId', '==', uid);
          if (typeof (query as any).count === 'function') {
            const countSnap = await (query as any).count().get();
            return { uid, count: countSnap.data()?.count ?? 0 };
          } else {
            const snap = await query.select().get(); // select() returns only doc refs, not data
            return { uid, count: snap.size };
          }
        } catch {
          return { uid, count: 0 };
        }
      });

      const results = await Promise.all(countPromises);
      for (const { uid, count } of results) {
        map.set(uid, count);
      }
    }
  } catch (err) {
    console.warn('[Admin Users] Error batch fetching page counts:', err);
  }
  return map;
}

// Helper: Batch fetch referrer usernames
async function batchFetchReferrerUsernames(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userDocs: FirebaseFirestore.QueryDocumentSnapshot[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Collect unique referrer IDs
  const referrerIds = new Set<string>();
  for (const doc of userDocs) {
    const referredBy = doc.data().referredBy;
    if (referredBy) {
      referrerIds.add(referredBy);
    }
  }

  if (referrerIds.size === 0) return map;

  try {
    // Use getAll for efficient batch fetching
    const refs = Array.from(referrerIds).map(uid => db.collection(collectionName).doc(uid));
    const docs = await db.getAll(...refs);

    for (const doc of docs) {
      if (doc.exists) {
        const username = doc.data()?.username;
        if (username) {
          map.set(doc.id, username);
        }
      }
    }
  } catch (err) {
    console.warn('[Admin Users] Error fetching referrer usernames:', err);
  }
  return map;
}

// Helper: Batch fetch PWA installation status from analytics_events
// Checks if a user has installed PWA (pwa_install event) AND/OR actually used it (pwa_usage_verified)
// pwaInstalled = claimed to install, pwaVerified = actually used in standalone mode
async function batchFetchPWAInstalls(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, { installed: boolean; verified: boolean }>> {
  const map = new Map<string, { installed: boolean; verified: boolean }>();
  if (userIds.length === 0) return map;

  try {
    // Firestore 'in' query supports up to 30 items, batch if needed
    const batchSize = 30;
    const installBatches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
    const verifiedBatches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      // Query for pwa_install events (claimed installation)
      installBatches.push(
        db.collection(collectionName)
          .where('eventType', '==', 'pwa_install')
          .where('userId', 'in', batch)
          .limit(batch.length)
          .get()
      );
      // Query for pwa_usage_verified events (actually used PWA in standalone mode)
      verifiedBatches.push(
        db.collection(collectionName)
          .where('eventType', '==', 'pwa_usage_verified')
          .where('userId', 'in', batch)
          .limit(batch.length)
          .get()
      );
    }

    const [installResults, verifiedResults] = await Promise.all([
      Promise.all(installBatches),
      Promise.all(verifiedBatches)
    ]);

    // Track installed users
    const installedUsers = new Set<string>();
    for (const snapshot of installResults) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.userId) installedUsers.add(data.userId);
      }
    }

    // Track verified users
    const verifiedUsers = new Set<string>();
    for (const snapshot of verifiedResults) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.userId) verifiedUsers.add(data.userId);
      }
    }

    // Build result map
    for (const userId of userIds) {
      const installed = installedUsers.has(userId);
      const verified = verifiedUsers.has(userId);
      if (installed || verified) {
        map.set(userId, { installed, verified });
      }
    }

    console.log(`[Admin Users] Found ${installedUsers.size} PWA installs, ${verifiedUsers.size} verified`);
  } catch (err) {
    console.warn('[Admin Users] Error batch fetching PWA installs:', err);
  }
  return map;
}

// Helper: Batch fetch notification sparklines (last 7 days)
// Combines email logs and push notification events
async function batchFetchNotificationSparklines(
  db: FirebaseFirestore.Firestore,
  userIds: string[]
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (userIds.length === 0) return map;

  try {
    const admin = getFirebaseAdmin();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Initialize sparkline data for all users
    userIds.forEach(uid => {
      map.set(uid, Array(7).fill(0));
    });

    // 1. Fetch email logs (using environment-aware collection name)
    const emailLogsCollectionName = getCollectionName('emailLogs');
    const batchSize = 30;
    const emailBatches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      emailBatches.push(
        db.collection(emailLogsCollectionName)
          .where('recipientUserId', 'in', batch)
          .where('sentAt', '>=', sevenDaysAgo.toISOString())
          .get()
      );
    }

    const emailResults = await Promise.all(emailBatches);

    for (const snapshot of emailResults) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = data.recipientUserId;
        const sentDate = new Date(data.sentAt);
        const dayIndex = Math.floor((sentDate.getTime() - sevenDaysAgo.getTime()) / (24 * 60 * 60 * 1000));

        if (userId && dayIndex >= 0 && dayIndex < 7) {
          const sparkline = map.get(userId);
          if (sparkline) {
            sparkline[dayIndex]++;
          }
        }
      }
    }

    // 2. Fetch push notification events
    const analyticsCollectionName = getCollectionName('analytics_events');
    const startTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysAgo);
    const pushBatches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      pushBatches.push(
        db.collection(analyticsCollectionName)
          .where('eventType', '==', 'pwa_notification_sent')
          .where('userId', 'in', batch)
          .where('timestamp', '>=', startTimestamp)
          .get()
      );
    }

    const pushResults = await Promise.all(pushBatches);

    for (const snapshot of pushResults) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = data.userId;
        const timestamp = data.timestamp;

        if (userId && timestamp?.toDate) {
          const eventDate = timestamp.toDate();
          const dayIndex = Math.floor((eventDate.getTime() - sevenDaysAgo.getTime()) / (24 * 60 * 60 * 1000));

          if (dayIndex >= 0 && dayIndex < 7) {
            const sparkline = map.get(userId);
            if (sparkline) {
              sparkline[dayIndex]++;
            }
          }
        }
      }
    }

    console.log(`[Admin Users] Fetched notification sparklines for ${map.size} users`);
  } catch (err) {
    console.warn('[Admin Users] Error batch fetching notification sparklines:', err);
    // Return empty sparklines on error
    userIds.forEach(uid => {
      if (!map.has(uid)) {
        map.set(uid, Array(7).fill(0));
      }
    });
  }
  return map;
}

// Helper: Batch fetch USD balances (allocated/unallocated amounts)
interface UsdBalanceInfo {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

async function batchFetchUsdBalances(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, UsdBalanceInfo>> {
  const map = new Map<string, UsdBalanceInfo>();
  if (userIds.length === 0) return map;

  try {
    // Use getAll for efficient batch fetching (document IDs are user IDs)
    const refs = userIds.map(uid => db.collection(collectionName).doc(uid));
    const docs = await db.getAll(...refs);

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const userId = userIds[i];

      if (doc.exists) {
        const data = doc.data()!;
        const totalUsdCents = data.totalUsdCents || 0;
        const allocatedUsdCents = data.allocatedUsdCents || 0;
        const availableUsdCents = totalUsdCents - allocatedUsdCents;

        map.set(userId, {
          totalUsdCents,
          allocatedUsdCents,
          availableUsdCents
        });
      }
    }

    console.log(`[Admin Users] Fetched ${map.size} USD balances`);
  } catch (err) {
    console.warn('[Admin Users] Error batch fetching USD balances:', err);
  }
  return map;
}

// POST endpoint - Update user feature flag overrides
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    // Feature flags have been removed - this endpoint no longer handles feature flag updates
    return NextResponse.json({
      error: 'Feature flags have been removed from the system'
    }, { status: 410 }); // 410 Gone - resource no longer available

    // This code is unreachable since we return early above

  } catch (error: any) {
    console.error('Error updating user feature flag:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update feature flag',
      details: error?.message
    }, { status: 500 });
  }
}
