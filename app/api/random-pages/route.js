import { NextResponse } from 'next/server';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'};

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limitCount = parseInt(searchParams.get('limit') || '10', 10);
    const userId = searchParams.get('userId'); // For access control
    const excludeOwnPages = searchParams.get('excludeOwnPages') === 'true'; // "Not mine" filter
    const isShuffling = searchParams.get('shuffle') === 'true'; // Shuffle flag for more variety

    console.log('Random pages API: Requested limit:', limitCount, 'User ID:', userId, 'Exclude own pages:', excludeOwnPages, 'Is shuffling:', isShuffling);

    // Import Firebase modules
    const { initAdmin } = await import('../../firebase/admin.ts');
    const { getEffectiveTier } = await import('../../utils/subscriptionTiers');
    const { executeDeduplicatedOperation } = await import('../../utils/serverRequestDeduplication');

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Initialize RTDB if available
    let rtdb = null;
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getDatabase, ref, get } = await import('firebase/database');

      // Use existing app or create new one for client SDK
      let app;
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
      } else {
        const firebaseConfig = {
          databaseURL: process.env.FIREBASE_DATABASE_URL
        };
        app = initializeApp(firebaseConfig, 'random-pages-client');
      }

      if (process.env.FIREBASE_DATABASE_URL) {
        rtdb = getDatabase(app);
      }
    } catch (rtdbError) {
      console.warn('RTDB not available for random pages API:', rtdbError.message);
    }

    if (!db) {
      console.log('Firebase database not available - returning empty array');
      return NextResponse.json({
        randomPages: [],
        error: "Database not available"
      }, { headers });
    }

    // Import environment config
    const { getCollectionName } = await import('../../utils/environmentConfig');

    // NEW APPROACH: User-first randomization for better diversity
    // Instead of just shuffling recent pages (which favors prolific users),
    // we first select a diverse set of users, then pick pages from those users.
    // This ensures a more balanced representation across different authors.

    // Step 1: Get a diverse set of users by sampling from different time periods
    const now = new Date();
    const timeRanges = [
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),   // Last 7 days
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),  // Last 30 days
      new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),  // Last 90 days
    ];

    const userSampleSize = Math.max(limitCount * 2, 30); // Get more users than needed
    let allUsers = new Set();

    // Sample users from different time periods to ensure diversity
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

        // If we have enough users, break early
        if (allUsers.size >= userSampleSize) break;
      } catch (error) {
        console.warn(`Error sampling users from time range ${timeRange.toISOString()}:`, error);
      }
    }

    // Step 2: Randomly select a subset of users
    const userArray = Array.from(allUsers);
    const selectedUsers = [];
    const targetUserCount = Math.min(limitCount, userArray.length);

    // Fisher-Yates shuffle to randomly select users
    const shuffledUsers = [...userArray];
    for (let i = shuffledUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledUsers[i], shuffledUsers[j]] = [shuffledUsers[j], shuffledUsers[i]];
    }

    selectedUsers.push(...shuffledUsers.slice(0, targetUserCount));

    console.log(`Random pages API: Selected ${selectedUsers.length} diverse users from ${userArray.length} total users`);

    // Step 3: Get pages from selected users
    const pagesPerUser = Math.ceil(limitCount * 1.5 / selectedUsers.length); // Get a few pages per user
    let allPages = [];

    for (const userId of selectedUsers) {
      try {
        const userPagesQuery = db.collection(getCollectionName('pages'))
          .where('userId', '==', userId)
          .orderBy('lastModified', 'desc')
          .limit(pagesPerUser);

        const userPagesSnapshot = await userPagesQuery.get();

        userPagesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.deleted) {
            allPages.push({
              id: doc.id,
              ...data
            });
          }
        });
      } catch (error) {
        console.warn(`Error fetching pages for user ${userId}:`, error);
      }
    }

    console.log(`Random pages API: Collected ${allPages.length} pages from ${selectedUsers.length} users`);

    // Fallback: If we don't have enough pages, supplement with traditional approach
    if (allPages.length < limitCount) {
      console.log(`Random pages API: Insufficient pages (${allPages.length}), supplementing with traditional approach`);

      const supplementQuery = db.collection(getCollectionName('pages'))
        .orderBy('lastModified', 'desc')
        .limit(limitCount * 2);

      const supplementSnapshot = await supplementQuery.get();

      supplementSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.deleted && !allPages.some(p => p.id === doc.id)) {
          allPages.push({
            id: doc.id,
            ...data
          });
        }
      });

      console.log(`Random pages API: After supplementing, have ${allPages.length} total pages`);
    }

    // Create a mock snapshot-like structure for compatibility with existing code
    const pagesSnapshot = {
      empty: allPages.length === 0,
      docs: allPages.map(page => ({
        id: page.id,
        data: () => page
      }))
    };

    if (pagesSnapshot.empty) {
      console.log('No pages found');
      return NextResponse.json({
        randomPages: [],
        message: "No pages available"
      }, { headers });
    }

    // Convert to array and filter deleted pages client-side
    let pages = [];
    pagesSnapshot.docs.forEach((doc) => {
      const pageData = doc.data();

      // Filter out deleted pages client-side (already filtered above, but double-check)
      if (pageData.deleted === true) {
        return;
      }

      pages.push({
        id: doc.id,
        title: pageData.title || 'Untitled',
        userId: pageData.userId,
        username: pageData.username || 'Anonymous',
        lastModified: pageData.lastModified,
        createdAt: pageData.createdAt,

        groupId: pageData.groupId || null
      });
    });



    // Fetch additional data (groups, usernames, and subscription info) for pages
    const pagesWithCompleteInfo = await Promise.all(
      pages.map(async (page) => {
        let updatedPage = { ...page };

        // Groups functionality removed

        // Fetch username and subscription data
        if (rtdb && (!page.username || page.username === 'Anonymous')) {
          try {
            const { ref, get } = await import('firebase/database');
            const userRef = ref(rtdb, `users/${page.userId}`);
            const userSnapshot = await get(userRef);

            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              updatedPage.username = userData.username || 'Anonymous';
            }
          } catch (userError) {
            console.error(`Error fetching username for user ${page.userId}:`, userError);
          }
        }

        // Fetch subscription information using Firebase Admin from correct path
        try {
          // Import environment config for subscription paths
          const { getSubCollectionPath, PAYMENT_COLLECTIONS } = await import('../../utils/environmentConfig');
          const { parentPath, subCollectionName } = getSubCollectionPath(
            PAYMENT_COLLECTIONS.USERS,
            page.userId,
            PAYMENT_COLLECTIONS.SUBSCRIPTIONS
          );
          const subscriptionDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
          if (subscriptionDoc.exists) {
            const subscriptionData = subscriptionDoc.data();
            // Use centralized tier determination logic
            const effectiveTier = getEffectiveTier(subscriptionData.amount, subscriptionData.tier, subscriptionData.status);
            updatedPage.tier = effectiveTier;
            updatedPage.subscriptionStatus = subscriptionData.status;
            updatedPage.subscriptionAmount = subscriptionData.amount;
          }
        } catch (subscriptionError) {
          console.error(`Error fetching subscription for user ${page.userId}:`, subscriptionError);
        }

        return updatedPage;
      })
    );

    // Apply access control filtering
    let pageCount = 0;

    const accessiblePages = pagesWithCompleteInfo.filter(page => {
      // Apply "Not mine" filter - exclude pages authored by current user
      if (excludeOwnPages && userId && page.userId === userId) {
        return false;
      }

      // For pages, apply additional group-based filtering
      if (page.groupId) {
        // Pages in public groups are accessible
        // Pages in private groups are only accessible to group members (for now, exclude them)
        const isAccessible = page.groupIsPublic;
        if (isAccessible) pageCount++;
        return isAccessible;
      }

      // Pages not in groups are always accessible
      pageCount++;
      return true;
    });

    console.log(`Random pages API: Access control summary:`, {
      totalPages: pagesWithCompleteInfo.length,
      pages: pageCount,
      accessiblePages: accessiblePages.length,
      userId: userId ? `${userId.substring(0, 8)}...` : 'null'
    });

    // Randomize the array using Fisher-Yates shuffle
    const shuffledPages = [...accessiblePages];
    for (let i = shuffledPages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPages[i], shuffledPages[j]] = [shuffledPages[j], shuffledPages[i]];
    }

    // Take only the requested number of pages
    const randomPages = shuffledPages.slice(0, limitCount);

    // Log diversity metrics
    const finalUniqueUsers = [...new Set(randomPages.map(page => page.userId).filter(Boolean))];
    console.log(`Random pages API: Final diversity metrics:`, {
      totalPages: randomPages.length,
      uniqueUsers: finalUniqueUsers.length,
      diversityRatio: finalUniqueUsers.length / randomPages.length,
      pagesPerUser: randomPages.length / finalUniqueUsers.length
    });

    // Batch fetch user subscription data
    const uniqueUserIds = finalUniqueUsers;
    let batchUserData = {};

    if (uniqueUserIds.length > 0) {
      try {
        batchUserData = await executeDeduplicatedOperation(
          'getBatchUserData',
          { userIds: uniqueUserIds.sort() }, // Sort for consistent cache keys
          () => getBatchUserDataOptimized(uniqueUserIds, db, rtdb, getEffectiveTier),
          { cacheTTL: 3 * 60 * 1000 } // 3 minutes cache for user data
        );
      } catch (error) {
        console.warn('Error fetching batch user data for random pages:', error);
        // Continue without user data rather than failing the entire request
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

    console.log(`Random pages API: Returning ${randomPagesWithUserData.length} pages from ${accessiblePages.length} accessible pages`);

    return NextResponse.json({
      randomPages: randomPagesWithUserData,
      totalAvailable: accessiblePages.length
    }, { headers });

  } catch (error) {
    console.error('Error in random pages API:', error);
    return NextResponse.json({
      randomPages: [],
      error: 'Failed to fetch random pages',
      details: error.message
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'}
    });
  }
}

/**
 * Batch fetch user subscription data (server-side optimized version)
 * Uses the same logic as the batch user API to ensure consistency
 */
async function getBatchUserDataOptimized(userIds, db, rtdb, getEffectiveTier) {
  try {
    if (!userIds || userIds.length === 0) {
      return {};
    }

    // Import environment config modules
    const { getSubCollectionPath, PAYMENT_COLLECTIONS, getCollectionName } = await import('../../utils/environmentConfig');

    const results = {};
    const batchSize = 10; // Process in batches to avoid overwhelming the database

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        // Fetch user profiles from Firestore
        const usersQuery = db.collection(getCollectionName('users')).where('__name__', 'in', batch);
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
        const firestoreUserIds = new Set();
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const subscription = subscriptionMap.get(doc.id);

          // Use centralized tier determination logic
          const effectiveTier = getEffectiveTier(
            subscription?.amount || null,
            subscription?.tier || null,
            subscription?.status || null
          );

          const user = {
            uid: doc.id,
            username: userData.username,
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
          console.log(`Random pages API: Falling back to RTDB for ${rtdbUserIds.length} users`);

          const rtdbPromises = rtdbUserIds.map(async (userId) => {
            try {
              const { ref, get } = await import('firebase/database');
              const userSnapshot = await get(ref(rtdb, `users/${userId}`));

              if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const user = {
                  uid: userId,
                  username: userData.username || "Missing username", // SECURITY: Never expose email
                  email: userData.email,
                  tier: '0', // No subscription data in RTDB
                  subscriptionStatus: null,
                  subscriptionAmount: null,
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
          console.log(`Random pages API: RTDB not available, creating fallback data for ${rtdbUserIds.length} users`);
          rtdbUserIds.forEach(userId => {
            results[userId] = {
              uid: userId,
              username: 'Unknown User',
              tier: '0',
              subscriptionStatus: null,
              subscriptionAmount: null
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
  } catch (error) {
    console.error('Error in getBatchUserDataOptimized:', error);
    return {};
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'}});
}