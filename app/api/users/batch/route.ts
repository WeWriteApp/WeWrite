/**
 * Batch User Data API
 * Provides endpoint for fetching multiple users' data efficiently
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { executeDeduplicatedOperation } from '../../../utils/serverRequestDeduplication';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';

interface UserData {
  uid: string;
  username?: string;
  email?: string;
  tier?: number;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  pageCount?: number;
  followerCount?: number;
  viewCount?: number;
}

// Helper function to get effective tier
function getEffectiveTier(amount: number | null, tier: number | null, status: string | null): number {
  // If subscription is not active, return tier 0
  if (!status || status !== 'active') {
    return 0;
  }

  // If we have an explicit tier, use it
  if (tier !== null && tier !== undefined) {
    return tier;
  }

  // Calculate tier based on amount
  if (!amount || amount <= 0) {
    return 0;
  } else if (amount < 20) {
    return 1;
  } else if (amount < 30) {
    return 2;
  } else {
    return 3;
  }
}

// POST endpoint - Get batch user data
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Try to initialize realtime database, but don't fail if it's not available
    let rtdb = null;
    try {
      rtdb = admin.database();
    } catch (rtdbError) {
      console.warn('Realtime Database not available, continuing without it:', rtdbError.message);
    }

    // Authentication is optional for this endpoint since it's used for public user data
    const currentUserId = await getUserIdFromRequest(request);

    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds)) {
      return createErrorResponse('BAD_REQUEST', 'userIds array is required');
    }

    if (userIds.length === 0) {
      return createApiResponse({ users: {} });
    }

    if (userIds.length > 100) {
      return createErrorResponse('BAD_REQUEST', 'Maximum 100 user IDs allowed per request');
    }

    console.log(`Batch user data: Fetching data for ${userIds.length} users`);

    // Use deduplication for the entire batch operation
    const results = await executeDeduplicatedOperation(
      'batchUserData',
      { userIds: userIds.sort() }, // Sort for consistent cache keys
      async () => {
        return await fetchBatchUserDataInternal(userIds, db, rtdb);
      },
      { cacheTTL: 3 * 60 * 1000 } // 3 minutes cache
    );

    console.log(`Batch user data: Successfully fetched data for ${Object.keys(results).length} users`);

    return createApiResponse({
      users: results,
      count: Object.keys(results).length
    });

  } catch (error) {
    console.error('Error fetching batch user data:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user data');
  }
}

/**
 * Internal function to fetch batch user data
 */
async function fetchBatchUserDataInternal(
  userIds: string[],
  db: any,
  rtdb: any
): Promise<Record<string, UserData>> {
  const results: Record<string, UserData> = {};

  try {
    // Batch fetch from Firestore (max 10 per query due to 'in' limitation)
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        // Fetch user profiles from Firestore
        const usersQuery = db.collection('users').where('__name__', 'in', batch);
        const usersSnapshot = await usersQuery.get();

        // Fetch subscription data in parallel using environment-aware paths
        const subscriptionPromises = batch.map(async (userId) => {
          try {
            // Use environment-aware collection paths
            const { parentPath, subCollectionName } = getSubCollectionPath(
              PAYMENT_COLLECTIONS.USERS,
              userId,
              PAYMENT_COLLECTIONS.SUBSCRIPTIONS
            );
            const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
            return {
              userId,
              subscription: subDoc.exists ? subDoc.data() : null
            };
          } catch (error) {
            console.warn(`Error fetching subscription for user ${userId}:`, error);
            return { userId, subscription: null };
          }
        });

        const subscriptionResults = await Promise.all(subscriptionPromises);
        const subscriptionMap = new Map(
          subscriptionResults.map(result => [result.userId, result.subscription])
        );

        // Process Firestore results
        const firestoreUserIds = new Set<string>();
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const subscription = subscriptionMap.get(doc.id);

          // Use centralized tier determination logic
          const effectiveTier = getEffectiveTier(
            subscription?.amount || null,
            subscription?.tier || null,
            subscription?.status || null
          );



          const user: UserData = {
            uid: doc.id,
            username: userData.username,
            displayName: userData.displayName,
            email: userData.email,
            tier: String(effectiveTier), // Ensure tier is always a string
            subscriptionStatus: subscription?.status,
            subscriptionAmount: subscription?.amount,
            pageCount: userData.pageCount || 0,
            followerCount: userData.followerCount || 0,
            viewCount: userData.viewCount || 0
          };

          results[doc.id] = user;
          firestoreUserIds.add(doc.id);
        });

        // Fallback to RTDB for users not found in Firestore (if RTDB is available)
        const rtdbUserIds = batch.filter(id => !firestoreUserIds.has(id));

        if (rtdbUserIds.length > 0 && rtdb) {
          console.log(`Batch user data: Falling back to RTDB for ${rtdbUserIds.length} users`);

          const rtdbPromises = rtdbUserIds.map(async (userId) => {
            try {
              const userSnapshot = await rtdb.ref(`users/${userId}`).get();

              if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const user: UserData = {
                  uid: userId,
                  username: userData.username || "Missing username", // SECURITY: Never expose email
                  email: userData.email,
                  pageCount: userData.pageCount || 0,
                  followerCount: userData.followerCount || 0,
                  viewCount: userData.viewCount || 0
                };

                return { userId, user };
              }

              return { userId, user: null };
            } catch (error) {
              console.warn(`Error fetching user ${userId} from RTDB:`, error);
              return { userId, user: null };
            }
          });

          const rtdbResults = await Promise.all(rtdbPromises);

          rtdbResults.forEach(({ userId, user }) => {
            if (user) {
              results[userId] = user;
            }
          });
        } else if (rtdbUserIds.length > 0 && !rtdb) {
          // If RTDB is not available, create fallback user data for missing users
          console.log(`Batch user data: RTDB not available, creating fallback data for ${rtdbUserIds.length} users`);
          rtdbUserIds.forEach(userId => {
            results[userId] = {
              uid: userId,
              username: 'Unknown User'
            };
          });
        }

      } catch (error) {
        console.error(`Error fetching batch ${i}-${i + batchSize}:`, error);

        // Create fallback user data for failed fetches
        batch.forEach(userId => {
          if (!results[userId]) {
            results[userId] = {
              uid: userId,
              username: 'Unknown User'
            };
          }
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in fetchBatchUserDataInternal:', error);
    return {};
  }
}

// GET endpoint - Get single user data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return createErrorResponse('BAD_REQUEST', 'userId parameter is required');
    }

    // Use the POST endpoint internally for consistency
    const batchResponse = await POST(new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ userIds: [userId] })
    }));

    const batchResult = await batchResponse.json();

    if (!batchResult.success) {
      return createErrorResponse('INTERNAL_ERROR', batchResult.error);
    }

    const user = batchResult.data.users[userId];

    if (!user) {
      return createErrorResponse('NOT_FOUND', 'User not found');
    }

    return createApiResponse({ user });

  } catch (error) {
    console.error('Error fetching single user data:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user data');
  }
}
