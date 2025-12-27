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
  'accountCreated',
  'usernameSet',
  'emailVerified',
  'pageCreated',
  'linkedOwnPage',
  'linkedOtherPage',
  'repliedToPage',
  'pwaInstalled',
  'hasSubscription',
  'payoutsSetup',
] as const;

export type ActivationMilestone = typeof ACTIVATION_MILESTONES[number];

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

      // Collection names
      const usersCollectionName = getCollectionName('users');
      const pagesCollectionName = getCollectionName('pages');
      const analyticsEventsCollectionName = getCollectionName('analytics_events');

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
      const [
        pageCountsMap,
        pwaInstallsMap,
        subscriptionsMap,
        linkedOwnPageMap,
        linkedOtherPageMap,
        repliedMap,
      ] = await Promise.all([
        batchFetchPageCounts(db, pagesCollectionName, userIds),
        batchFetchPWAInstalls(db, analyticsEventsCollectionName, userIds),
        batchFetchSubscriptions(db, usersCollectionName, userIds),
        batchFetchLinkedOwnPage(db, pagesCollectionName, userIds),
        batchFetchLinkedOtherPage(db, pagesCollectionName, userIds),
        batchFetchRepliedToPage(db, pagesCollectionName, userIds),
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

        const milestones: Record<ActivationMilestone, boolean> = {
          accountCreated: true, // Always true if user exists
          usernameSet: Boolean(hasUsername),
          emailVerified: data.emailVerified === true,
          pageCreated: hasPages,
          linkedOwnPage: hasLinkedOwnPage,
          linkedOtherPage: hasLinkedOtherPage,
          repliedToPage: hasReplied,
          pwaInstalled: hasPwa,
          hasSubscription: hasSubscription,
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

// Helper: Batch fetch if user has linked to their own page (created a link that points to a page they own)
// A page has links in the content (not directly tracked), so we check if user has pages that are linked FROM other pages
// Actually, "linked to own page" means the user added a link in their page's content pointing to another of their own pages
// We'll check if the user has pages with pageLinks array containing pageIds they also own
async function batchFetchLinkedOwnPage(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  userIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;

  try {
    // First get all pages grouped by user
    const batchSize = 30;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const snapshot = await db.collection(collectionName)
        .where('userId', 'in', batch)
        .select('userId', 'pageLinks')
        .get();

      // Group pages by userId
      const userPages = new Map<string, Set<string>>();
      const userPagesWithLinks = new Map<string, string[]>();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = data.userId;

        if (!userPages.has(userId)) {
          userPages.set(userId, new Set());
          userPagesWithLinks.set(userId, []);
        }
        userPages.get(userId)!.add(doc.id);

        // Check if this page has links to other pages
        if (data.pageLinks && Array.isArray(data.pageLinks) && data.pageLinks.length > 0) {
          userPagesWithLinks.get(userId)!.push(...data.pageLinks);
        }
      }

      // For each user, check if any of their linked pages belong to them
      for (const [userId, linkedPageIds] of userPagesWithLinks) {
        const ownedPageIds = userPages.get(userId) || new Set();
        const hasLinkedOwn = linkedPageIds.some(pageId => ownedPageIds.has(pageId));
        if (hasLinkedOwn) {
          map.set(userId, true);
        }
      }
    }
  } catch (err) {
    console.warn('[User Activation] Error batch fetching linked own page:', err);
  }
  return map;
}

// Helper: Batch fetch if user has linked to someone else's page
async function batchFetchLinkedOtherPage(
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
      const snapshot = await db.collection(collectionName)
        .where('userId', 'in', batch)
        .select('userId', 'pageLinks')
        .get();

      // Group pages by userId
      const userPages = new Map<string, Set<string>>();
      const userPagesWithLinks = new Map<string, string[]>();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = data.userId;

        if (!userPages.has(userId)) {
          userPages.set(userId, new Set());
          userPagesWithLinks.set(userId, []);
        }
        userPages.get(userId)!.add(doc.id);

        if (data.pageLinks && Array.isArray(data.pageLinks) && data.pageLinks.length > 0) {
          userPagesWithLinks.get(userId)!.push(...data.pageLinks);
        }
      }

      // For each user, check if any of their linked pages DON'T belong to them
      for (const [userId, linkedPageIds] of userPagesWithLinks) {
        const ownedPageIds = userPages.get(userId) || new Set();
        const hasLinkedOther = linkedPageIds.some(pageId => !ownedPageIds.has(pageId));
        if (hasLinkedOther) {
          map.set(userId, true);
        }
      }
    }
  } catch (err) {
    console.warn('[User Activation] Error batch fetching linked other page:', err);
  }
  return map;
}

// Helper: Batch fetch if user has replied to someone's page (created a page with replyTo field)
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
      // Query for pages that have a replyTo field (meaning they are replies)
      const snapshot = await db.collection(collectionName)
        .where('userId', 'in', batch)
        .where('replyTo', '!=', null)
        .select('userId')
        .limit(batch.length) // Only need one per user
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.userId) {
          map.set(data.userId, true);
        }
      }
    }
  } catch (err) {
    console.warn('[User Activation] Error batch fetching replied to page:', err);
  }
  return map;
}
