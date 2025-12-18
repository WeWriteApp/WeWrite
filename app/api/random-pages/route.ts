import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface PageData {
  id: string;
  title: string;
  userId?: string;
  username?: string;
  lastModified?: string;
  createdAt?: string;
  groupId?: string | null;
  deleted?: boolean;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  groupIsPublic?: boolean;
}

interface UserData {
  uid: string;
  username?: string;
  email?: string;
  tier: string;
  subscriptionStatus?: string | null;
  subscriptionAmount?: number | null;
  pageCount?: number;
  followerCount?: number;
  viewCount?: number;
}

interface BatchUserData {
  [userId: string]: UserData;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '10', 10);
    const userId = searchParams.get('userId');
    const excludeOwnPages = searchParams.get('excludeOwnPages') === 'true';
    const excludeUsername = (searchParams.get('excludeUsername') || '').trim().toLowerCase();
    const includeUsername = (searchParams.get('includeUsername') || '').trim().toLowerCase();

    const { getFirebaseAdmin } = await import('../../firebase/firebaseAdmin');
    const { getEffectiveTier } = await import('../../utils/subscriptionTiers');
    const { executeDeduplicatedOperation } = await import('../../utils/serverRequestDeduplication');
    const { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } = await import('../../utils/environmentConfig');

    const adminApp = getFirebaseAdmin();
    if (!adminApp) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500, headers: CORS_HEADERS });
    }
    const db = adminApp.firestore();

    // Initialize RTDB if available
    let rtdb: ReturnType<typeof adminApp.database> | null = null;
    try {
      if (process.env.FIREBASE_DATABASE_URL) {
        rtdb = adminApp.database();
      }
    } catch (rtdbError) {
      console.warn('RTDB not available for random pages API');
    }

    // User-first randomization for diversity
    const now = new Date();
    const timeRanges = [
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    ];

    const userSampleSize = Math.max(limitCount * 2, 30);
    const allUsers = new Set<string>();

    for (const timeRange of timeRanges) {
      try {
        const userQuery = db.collection(getCollectionName('pages'))
          .where('lastModified', '>=', timeRange.toISOString())
          .orderBy('lastModified', 'desc')
          .limit(userSampleSize);

        const userSnapshot = await userQuery.get();

        userSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.userId && !data.deleted) {
            allUsers.add(data.userId);
          }
        });

        if (allUsers.size >= userSampleSize) break;
      } catch (error) {
        console.warn(`Error sampling users from time range:`, error);
      }
    }

    // Fisher-Yates shuffle for random user selection
    const userArray = Array.from(allUsers);
    const shuffledUsers = [...userArray];
    for (let i = shuffledUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledUsers[i], shuffledUsers[j]] = [shuffledUsers[j], shuffledUsers[i]];
    }

    const targetUserCount = Math.min(limitCount, shuffledUsers.length);
    const selectedUsers = shuffledUsers.slice(0, targetUserCount);

    // Get pages from selected users
    const pagesPerUser = Math.ceil(limitCount * 1.5 / Math.max(selectedUsers.length, 1));
    const allPages: PageData[] = [];

    for (const uid of selectedUsers) {
      try {
        const userPagesQuery = db.collection(getCollectionName('pages'))
          .where('userId', '==', uid)
          .orderBy('lastModified', 'desc')
          .limit(pagesPerUser);

        const userPagesSnapshot = await userPagesQuery.get();

        userPagesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.deleted) {
            allPages.push({
              id: doc.id,
              title: data.title || 'Untitled',
              userId: data.userId,
              username: data.username || 'Anonymous',
              lastModified: data.lastModified,
              createdAt: data.createdAt,
              groupId: data.groupId || null
            });
          }
        });
      } catch (error) {
        console.warn(`Error fetching pages for user ${uid}:`, error);
      }
    }

    // Fallback if not enough pages
    if (allPages.length < limitCount) {
      const supplementQuery = db.collection(getCollectionName('pages'))
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 2);

      const supplementSnapshot = await supplementQuery.get();

      supplementSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.deleted && !allPages.some(p => p.id === doc.id)) {
          allPages.push({
            id: doc.id,
            title: data.title || 'Untitled',
            userId: data.userId,
            username: data.username || 'Anonymous',
            lastModified: data.lastModified,
            createdAt: data.createdAt,
            groupId: data.groupId || null
          });
        }
      });
    }

    // Access control filtering
    const accessiblePages = allPages.filter(page => {
      if (excludeOwnPages && userId && page.userId === userId) {
        return false;
      }
      if (excludeUsername && (page.username || '').toLowerCase() === excludeUsername) {
        return false;
      }
      if (includeUsername && (page.username || '').toLowerCase() !== includeUsername) {
        return false;
      }
      if (page.groupId) {
        return page.groupIsPublic;
      }
      return true;
    });

    // Shuffle and limit
    const shuffledPages = [...accessiblePages];
    for (let i = shuffledPages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPages[i], shuffledPages[j]] = [shuffledPages[j], shuffledPages[i]];
    }

    const randomPages = shuffledPages.slice(0, limitCount);

    // Batch fetch user data
    const uniqueUserIds = [...new Set(randomPages.map(page => page.userId).filter((id): id is string => !!id))];
    let batchUserData: BatchUserData = {};

    if (uniqueUserIds.length > 0) {
      try {
        batchUserData = await executeDeduplicatedOperation(
          'getBatchUserData',
          { userIds: uniqueUserIds.sort() },
          () => getBatchUserDataOptimized(uniqueUserIds, db, rtdb, getEffectiveTier, getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS),
          { cacheTTL: 3 * 60 * 1000 }
        );
      } catch (error) {
        console.warn('Error fetching batch user data for random pages:', error);
      }
    }

    // Add subscription data to pages
    const randomPagesWithUserData = randomPages.map(page => {
      if (!page.userId) return page;

      const userData = batchUserData[page.userId];
      return {
        ...page,
        tier: userData?.tier,
        subscriptionStatus: userData?.subscriptionStatus,
        subscriptionAmount: userData?.subscriptionAmount,
        username: userData?.username || page.username
      };
    });

    return NextResponse.json({
      randomPages: randomPagesWithUserData,
      totalAvailable: accessiblePages.length
    }, { headers: CORS_HEADERS });

  } catch (error) {
    const err = error as Error;
    console.error('Error in random pages API:', err);
    return NextResponse.json({
      randomPages: [],
      error: 'Failed to fetch random pages',
      details: err.message
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

async function getBatchUserDataOptimized(
  userIds: string[],
  db: FirebaseFirestore.Firestore,
  rtdb: ReturnType<import('firebase-admin').app.App['database']> | null,
  getEffectiveTier: (amount: number | null, tier: string | null, status: string | null) => string,
  getCollectionName: (name: string) => string,
  getSubCollectionPath: (parent: string, docId: string, subCollection: string) => { parentPath: string; subCollectionName: string },
  PAYMENT_COLLECTIONS: { USERS: string; SUBSCRIPTIONS: string }
): Promise<BatchUserData> {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  const results: BatchUserData = {};
  const batchSize = 10;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    try {
      const usersQuery = db.collection(getCollectionName('users')).where('__name__', 'in', batch);
      const usersSnapshot = await usersQuery.get();

      const subscriptionPromises = batch.map(async (uid) => {
        try {
          const { parentPath, subCollectionName } = getSubCollectionPath(
            PAYMENT_COLLECTIONS.USERS,
            uid,
            PAYMENT_COLLECTIONS.SUBSCRIPTIONS
          );
          const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
          return {
            userId: uid,
            subscription: subDoc.exists ? subDoc.data() : null
          };
        } catch (error) {
          return { userId: uid, subscription: null };
        }
      });

      const subscriptionResults = await Promise.all(subscriptionPromises);
      const subscriptionMap = new Map(
        subscriptionResults.map(result => [result.userId, result.subscription])
      );

      const firestoreUserIds = new Set<string>();
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const subscription = subscriptionMap.get(doc.id);

        const effectiveTier = getEffectiveTier(
          subscription?.amount || null,
          subscription?.tier || null,
          subscription?.status || null
        );

        results[doc.id] = {
          uid: doc.id,
          username: userData.username,
          email: userData.email,
          tier: String(effectiveTier),
          subscriptionStatus: subscription?.status,
          subscriptionAmount: subscription?.amount,
          pageCount: userData.pageCount || 0,
          followerCount: userData.followerCount || 0,
          viewCount: userData.viewCount || 0
        };
        firestoreUserIds.add(doc.id);
      });

      // Fallback to RTDB for users not found
      const rtdbUserIds = batch.filter(id => !firestoreUserIds.has(id));

      if (rtdbUserIds.length > 0 && rtdb) {
        for (const uid of rtdbUserIds) {
          try {
            const userSnapshot = await rtdb.ref(`users/${uid}`).once('value');
            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              results[uid] = {
                uid,
                username: userData.username || 'Anonymous',
                tier: '0',
                subscriptionStatus: null,
                subscriptionAmount: null
              };
            }
          } catch (error) {
            console.warn(`Error fetching user ${uid} from RTDB:`, error);
          }
        }
      } else if (rtdbUserIds.length > 0) {
        rtdbUserIds.forEach(uid => {
          results[uid] = {
            uid,
            username: 'Unknown User',
            tier: '0',
            subscriptionStatus: null,
            subscriptionAmount: null
          };
        });
      }

    } catch (error) {
      console.error(`Error fetching batch ${i}-${i + batchSize}:`, error);
      batch.forEach(uid => {
        if (!results[uid]) {
          results[uid] = {
            uid,
            username: 'Unknown User',
            tier: '0',
            subscriptionStatus: null,
            subscriptionAmount: null
          };
        }
      });
    }
  }

  return results;
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  });
}
