/**
 * Admin API: User Activation Matrix
 * Provides activation milestone data for all users in a dense matrix format
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

// Activation milestone keys in chronological order
export const ACTIVATION_MILESTONES = [
  'usernameSet',
  'emailVerified',
  'pageCreated',
  'linkedOwnPage',
  'linkedOtherPage',
  'repliedToPage',
  'pwaInstalled',
  'hasSubscription',
  'allocatedToWriters',
  'receivedEarnings',
  'reachedPayoutThreshold',
  'payoutsSetup',
] as const;

// Payout threshold in cents ($25.00)
const PAYOUT_THRESHOLD_CENTS = 2500;

export type ActivationMilestone = typeof ACTIVATION_MILESTONES[number];

// Define milestone hierarchy for UI grouping
export const MILESTONE_HIERARCHY: Record<string, { parent?: string; children?: string[] }> = {
  pageCreated: { children: ['linkedOwnPage', 'linkedOtherPage', 'repliedToPage'] },
  linkedOwnPage: { parent: 'pageCreated' },
  linkedOtherPage: { parent: 'pageCreated' },
  repliedToPage: { parent: 'pageCreated' },
  hasSubscription: { children: ['allocatedToWriters'] },
  allocatedToWriters: { parent: 'hasSubscription' },
  receivedEarnings: { children: ['reachedPayoutThreshold', 'payoutsSetup'] },
  reachedPayoutThreshold: { parent: 'receivedEarnings' },
  payoutsSetup: { parent: 'receivedEarnings' },
};

export interface UserActivationData {
  uid: string;
  email: string;
  username?: string;
  createdAt: string;
  milestones: Record<ActivationMilestone, boolean>;
  completedCount: number;
}

// GET endpoint - Get activation matrix data for all users
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    const startTime = Date.now();

    try {
      const admin = getFirebaseAdmin();
      if (!admin) {
        return NextResponse.json({
          error: 'Firebase Admin not available',
        }, { status: 500 });
      }
      const db = admin.firestore();

      // Verify admin access
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '500');
      const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt or completedCount
      const sortDir = searchParams.get('sortDir') || 'desc';

      // Collection names - getCollectionName handles dev vs prod automatically
      const usersCollectionName = getCollectionName('users');
      const pagesCollectionName = getCollectionName('pages');
      const analyticsEventsCollectionName = getCollectionName('analytics_events');

      console.log(`[User Activation] Using collections: users=${usersCollectionName}, pages=${pagesCollectionName}`);

      // Fetch all users
      let snapshot;
      try {
        snapshot = await db.collection(usersCollectionName)
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();
      } catch {
        snapshot = await db.collection(usersCollectionName).limit(limit).get();
      }

      if (snapshot.empty) {
        return NextResponse.json({
          success: true,
          users: [],
          milestones: ACTIVATION_MILESTONES,
        });
      }

      const userIds = snapshot.docs.map(doc => doc.id);

      // Parallel data fetching for all milestones
      const backlinksCollectionName = getCollectionName('backlinks');
      const allocationsCollectionName = getCollectionName('usd_allocations');
      const earningsCollectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);

      const [
        pageCountsMap,
        pwaInstallsMap,
        subscriptionsMap,
        linkedOwnPageMap,
        linkedOtherPageMap,
        repliedMap,
        allocatedMap,
        earningsMap,
      ] = await Promise.all([
        batchFetchPageCounts(db, pagesCollectionName, userIds),
        batchFetchPWAInstalls(db, analyticsEventsCollectionName, userIds),
        batchFetchSubscriptions(db, usersCollectionName, userIds),
        batchFetchLinkedOwnPage(db, backlinksCollectionName, pagesCollectionName, userIds),
        batchFetchLinkedOtherPage(db, backlinksCollectionName, pagesCollectionName, userIds),
        batchFetchRepliedToPage(db, pagesCollectionName, userIds),
        batchFetchAllocations(db, allocationsCollectionName, userIds),
        batchFetchEarnings(db, earningsCollectionName, userIds),
      ]);

      // Build activation data
      const activationData: UserActivationData[] = [];

      for (const userDoc of snapshot.docs) {
        const data = userDoc.data();
        const uid = userDoc.id;

        // Check each milestone
        const hasUsername = data.username && !data.username.startsWith('user_');
        const hasPages = (pageCountsMap.get(uid) ?? 0) > 0;
        const hasPwa = pwaInstallsMap.get(uid) ?? false;
        const subscriptionData = subscriptionsMap.get(uid);
        const hasSubscription = subscriptionData?.status === 'active';
        const hasStripe = Boolean(data.stripeConnectedAccountId);
        const hasLinkedOwnPage = linkedOwnPageMap.get(uid) ?? false;
        const hasLinkedOtherPage = linkedOtherPageMap.get(uid) ?? false;
        const hasReplied = repliedMap.get(uid) ?? false;
        const hasAllocated = allocatedMap.get(uid) ?? false;
        // Earnings: check if user has any earnings and if they've reached the payout threshold
        const earningsData = earningsMap.get(uid);
        const hasReceivedEarnings = (earningsData?.totalCents ?? 0) > 0;
        const hasReachedPayoutThreshold = (earningsData?.availableCents ?? 0) >= PAYOUT_THRESHOLD_CENTS;

        const milestones: Record<ActivationMilestone, boolean> = {
          usernameSet: Boolean(hasUsername),
          emailVerified: data.emailVerified === true,
          pageCreated: hasPages,
          linkedOwnPage: hasLinkedOwnPage,
          linkedOtherPage: hasLinkedOtherPage,
          repliedToPage: hasReplied,
          pwaInstalled: hasPwa,
          hasSubscription: hasSubscription,
          allocatedToWriters: hasAllocated,
          receivedEarnings: hasReceivedEarnings,
          reachedPayoutThreshold: hasReachedPayoutThreshold,
          payoutsSetup: hasStripe,
        };

        const completedCount = Object.values(milestones).filter(Boolean).length;

        // Format createdAt
        let createdAtStr = '';
        if (data.createdAt) {
          if (data.createdAt.toDate) {
            createdAtStr = data.createdAt.toDate().toISOString();
          } else if (data.createdAt._seconds) {
            createdAtStr = new Date(data.createdAt._seconds * 1000).toISOString();
          } else {
            createdAtStr = new Date(data.createdAt).toISOString();
          }
        }

        activationData.push({
          uid,
          email: data.email || 'No email',
          username: data.username,
          createdAt: createdAtStr,
          milestones,
          completedCount,
        });
      }

      // Sort if needed
      if (sortBy === 'completedCount') {
        activationData.sort((a, b) => {
          const diff = b.completedCount - a.completedCount;
          return sortDir === 'asc' ? -diff : diff;
        });
      } else if (sortBy === 'createdAt' && sortDir === 'asc') {
        activationData.reverse();
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        users: activationData,
        milestones: ACTIVATION_MILESTONES,
        hierarchy: MILESTONE_HIERARCHY,
        total: activationData.length,
        _debug: { durationMs: duration },
      });

    } catch (error) {
      console.error('Error fetching user activation data:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch user activation data',
        details: (error as Error).message,
      }, { status: 500 });
    }
  });
}

// Helper: Batch fetch page counts
async function batchFetchPageCounts(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;

  try {
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
            const snap = await query.select().get();
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
    console.warn('[User Activation] Error batch fetching page counts:', err);
  }
  return map;
}

// Helper: Batch fetch PWA installs
async function batchFetchPWAInstalls(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;

  try {
    const batchSize = 30;
    const batches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      batches.push(
        db.collection(collectionName)
          .where('eventType', '==', 'pwa_install')
          .where('userId', 'in', batch)
          .limit(batch.length)
          .get()
      );
    }

    const results = await Promise.all(batches);

    for (const snapshot of results) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.userId) {
          map.set(data.userId, true);
        }
      }
    }
  } catch (err) {
    console.warn('[User Activation] Error batch fetching PWA installs:', err);
  }
  return map;
}

// Helper: Batch fetch subscriptions
async function batchFetchSubscriptions(
  db: FirebaseFirestore.Firestore,
  usersCollectionName: string,
  userIds: string[]
): Promise<Map<string, { status: string }>> {
  const map = new Map<string, { status: string }>();
  if (userIds.length === 0) return map;

  try {
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
        });
      }
    }
  } catch (err) {
    console.warn('[User Activation] Error batch fetching subscriptions:', err);
  }
  return map;
}

// Helper: Batch fetch if user has linked to their own page
// Uses the backlinks collection: sourcePageId links to targetPageId
// A user has "linked to own page" if they have a backlink where both source and target pages belong to them
async function batchFetchLinkedOwnPage(
  db: FirebaseFirestore.Firestore,
  backlinksCollectionName: string,
  pagesCollectionName: string,
  userIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;

  try {
    // First get all pages to build userId -> pageIds mapping
    const batchSize = 30;
    const userPageIds = new Map<string, Set<string>>();

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const pagesSnapshot = await db.collection(pagesCollectionName)
        .where('userId', 'in', batch)
        .select('userId')
        .get();

      for (const doc of pagesSnapshot.docs) {
        const userId = doc.data().userId;
        if (!userPageIds.has(userId)) {
          userPageIds.set(userId, new Set());
        }
        userPageIds.get(userId)!.add(doc.id);
      }
    }

    // Now query backlinks to find self-links
    // For each user, check if there's a backlink where both source and target are their pages
    const allBacklinks = await db.collection(backlinksCollectionName).get();

    console.log(`[User Activation] Found ${allBacklinks.size} total backlinks, ${userPageIds.size} users with pages`);

    for (const doc of allBacklinks.docs) {
      const data = doc.data();
      const sourcePageId = data.sourcePageId;
      const targetPageId = data.targetPageId;

      // Find which user owns the source page
      for (const [userId, pageIds] of userPageIds) {
        if (pageIds.has(sourcePageId) && pageIds.has(targetPageId)) {
          // User has linked to their own page
          map.set(userId, true);
          break;
        }
      }
    }

    console.log(`[User Activation] Found ${map.size} users with own-page links`);
  } catch (err) {
    console.warn('[User Activation] Error batch fetching linked own page:', err);
  }
  return map;
}

// Helper: Batch fetch if user has linked to someone else's page
// Uses the backlinks collection: sourcePageId links to targetPageId
// A user has "linked to other's page" if they have a backlink where source is theirs but target is not
async function batchFetchLinkedOtherPage(
  db: FirebaseFirestore.Firestore,
  backlinksCollectionName: string,
  pagesCollectionName: string,
  userIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;

  try {
    // First get all pages to build userId -> pageIds mapping
    const batchSize = 30;
    const userPageIds = new Map<string, Set<string>>();

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const pagesSnapshot = await db.collection(pagesCollectionName)
        .where('userId', 'in', batch)
        .select('userId')
        .get();

      for (const doc of pagesSnapshot.docs) {
        const userId = doc.data().userId;
        if (!userPageIds.has(userId)) {
          userPageIds.set(userId, new Set());
        }
        userPageIds.get(userId)!.add(doc.id);
      }
    }

    // Now query backlinks to find links to others' pages
    const allBacklinks = await db.collection(backlinksCollectionName).get();

    for (const doc of allBacklinks.docs) {
      const data = doc.data();
      const sourcePageId = data.sourcePageId;
      const targetPageId = data.targetPageId;

      // Find which user owns the source page
      for (const [userId, pageIds] of userPageIds) {
        if (pageIds.has(sourcePageId) && !pageIds.has(targetPageId)) {
          // User has linked to another user's page
          map.set(userId, true);
          break;
        }
      }
    }

    console.log(`[User Activation] Found ${map.size} users with other-page links`);
  } catch (err) {
    console.warn('[User Activation] Error batch fetching linked other page:', err);
  }
  return map;
}

// Helper: Batch fetch if user has replied to someone's page (created a page with replyTo field)
// Replies are pages with isReply: true and a replyTo field containing the target page ID
async function batchFetchRepliedToPage(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;

  try {
    const batchSize = 30;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      // Fetch all pages for these users and check replyTo/isReply fields
      // This avoids composite index requirements and is more reliable
      const snapshot = await db.collection(collectionName)
        .where('userId', 'in', batch)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        // Check if page is a reply (has replyTo field or isReply is true)
        if (data.userId && (data.replyTo || data.isReply === true)) {
          map.set(data.userId, true);
        }
      }
    }

    console.log(`[User Activation] Found ${map.size} users with replies out of ${userIds.length} checked`);
  } catch (err) {
    console.warn('[User Activation] Error batch fetching replied to page:', err);
  }
  return map;
}

// Helper: Batch fetch if user has allocated funds to writers
// Allocations are stored in the usd_allocations collection with userId field (the donor/allocator)
async function batchFetchAllocations(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;

  try {
    const batchSize = 30;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      // Query for allocations where this user is the allocator (userId field)
      const snapshot = await db.collection(collectionName)
        .where('userId', 'in', batch)
        .where('status', '==', 'active')
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.userId) {
          map.set(data.userId, true);
        }
      }
    }

    console.log(`[User Activation] Found ${map.size} users with allocations out of ${userIds.length} checked`);
  } catch (err) {
    console.warn('[User Activation] Error batch fetching allocations:', err);
  }
  return map;
}

// Helper: Batch fetch earnings data (total earned and available balance)
// Earnings are stored in writerUsdEarnings collection with userId field
async function batchFetchEarnings(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, { totalCents: number; availableCents: number }>> {
  const map = new Map<string, { totalCents: number; availableCents: number }>();
  if (userIds.length === 0) return map;

  try {
    const batchSize = 30;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      // Query for earnings records for these users
      const snapshot = await db.collection(collectionName)
        .where('userId', 'in', batch)
        .get();

      // Aggregate earnings by user
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = data.userId;
        if (!userId) continue;

        const existing = map.get(userId) || { totalCents: 0, availableCents: 0 };
        const earnedCents = data.totalUsdCentsReceived || 0;

        existing.totalCents += earnedCents;

        // Available balance includes pending and available status earnings
        if (data.status === 'available' || data.status === 'pending') {
          existing.availableCents += earnedCents;
        }

        map.set(userId, existing);
      }
    }

    console.log(`[User Activation] Found ${map.size} users with earnings out of ${userIds.length} checked`);
  } catch (err) {
    console.warn('[User Activation] Error batch fetching earnings:', err);
  }
  return map;
}
