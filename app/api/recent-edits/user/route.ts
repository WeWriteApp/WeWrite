import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from "../../../utils/environmentConfig";
import { getEffectiveTier } from '../../../utils/subscriptionTiers';

/**
 * USER RECENT EDITS API
 *
 * Fetches recent edits for a specific user (used in user profiles)
 * Uses the same logic as /api/home to ensure consistency
 *
 * This is the CLEAR, RENAMED version of the old /api/recent-pages endpoint.
 *
 * Query parameters:
 * - userId: The user ID to fetch recent edits for (REQUIRED)
 * - searchTerm: Optional search term to filter results
 * - limit: Maximum number of results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const searchTerm = searchParams.get('searchTerm') || '';
    const limitCount = parseInt(searchParams.get('limit') || '20');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('[USER_RECENT_EDITS] Starting user recent edits fetch for user:', userId);

    // Initialize Firebase Admin
    let adminApp;
    try {
      adminApp = initAdmin();
      if (!adminApp) {
        console.error('Firebase Admin not available');
        return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not available');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin initialization failed');
    }

    const db = adminApp.firestore();

    // Use the same logic as /api/home - get recently modified pages for the user
    let pagesQuery;

    // For logged-in users, get recent pages and filter deleted ones in code
    // This avoids the composite index requirement
    pagesQuery = db.collection(getCollectionName('pages'))
      .where('userId', '==', userId)
      .orderBy('lastModified', 'desc')
      .limit(limitCount * 2); // Get more to account for filtering

    const snapshot = await pagesQuery.get();
    console.log(`[USER_RECENT_EDITS] Raw query returned ${snapshot.size} documents`);

    if (snapshot.empty) {
      return NextResponse.json({
        pages: [],
        total: 0,
        hasMore: false
      });
    }

    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter pages using the same logic as homepage
    const filteredPages = pages.filter(page => {
      // Filter out deleted pages
      if (page.deleted === true) {
        return false;
      }

      // Apply search term if provided
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = (page.title || '').toLowerCase().includes(searchLower);
        const contentMatch = page.content && 
          (typeof page.content === 'string' ? 
            page.content.toLowerCase().includes(searchLower) :
            JSON.stringify(page.content).toLowerCase().includes(searchLower)
          );
        
        if (!titleMatch && !contentMatch) {
          return false;
        }
      }

      return true;
    });

    // Sort by lastModified and take the requested limit
    const sortedPages = filteredPages
      .sort((a, b) => {
        const dateA = new Date(a.lastModified || 0).getTime();
        const dateB = new Date(b.lastModified || 0).getTime();
        return dateB - dateA; // Newest first
      })
      .slice(0, limitCount);

    console.log(`[USER_RECENT_EDITS] Returning ${sortedPages.length} pages after filtering`);

    // Fetch subscription data for all unique user IDs (including the main user)
    const uniqueUserIds = [...new Set(sortedPages.map(page => page.userId).filter(Boolean))];
    const batchUserData = await fetchBatchUserData(uniqueUserIds, db);

    // Enhance pages with user and subscription data
    const enhancedPages = sortedPages.map(page => {
      const userData = batchUserData[page.userId];
      return {
        ...page,
        // Use username from user data if available, fallback to page username
        username: userData?.username || page.username,
        displayName: userData?.displayName || page.displayName,
        hasActiveSubscription: userData?.hasActiveSubscription || false,
        subscriptionTier: userData?.tier || null,
        subscriptionAmount: userData?.subscriptionAmount || null,
        subscriptionStatus: userData?.subscriptionStatus || null,
        // Include diff data that's already stored on the page
        lastDiff: page.lastDiff,
        diffPreview: page.diffPreview
      };
    });

    return NextResponse.json({
      pages: enhancedPages,
      total: enhancedPages.length,
      hasMore: filteredPages.length > limitCount
    });

  } catch (error) {
    console.error('[USER_RECENT_EDITS] Error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user recent edits');
  }
}

/**
 * Fetch batch user data including subscription information
 */
async function fetchBatchUserData(userIds: string[], db: any): Promise<Record<string, any>> {
  if (userIds.length === 0) return {};

  const results: Record<string, any> = {};

  try {

    // Batch process user IDs to avoid hitting Firestore limits
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        // Get user profiles from Firestore
        const userPromises = batch.map(async (userId) => {
          try {
            const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
            if (userDoc.exists) {
              return { userId, data: userDoc.data() };
            }
            return { userId, data: null };
          } catch (error) {
            console.warn(`Error fetching user ${userId}:`, error);
            return { userId, data: null };
          }
        });

        const userResults = await Promise.all(userPromises);

        // Get subscription data for this batch using the same approach as global API
        const subscriptionPromises = batch.map(async (userId) => {
          try {
            // Use environment-aware collection paths (same as global API)
            const { parentPath, subCollectionName } = getSubCollectionPath(
              PAYMENT_COLLECTIONS.USERS,
              userId,
              PAYMENT_COLLECTIONS.SUBSCRIPTIONS
            );

            const subDoc = await db.doc(parentPath).collection(subCollectionName).doc('current').get();
            const subscriptionData = subDoc.exists ? subDoc.data() : null;

            // Use centralized tier determination logic (same as global API)
            const effectiveTier = getEffectiveTier(
              subscriptionData?.amount || null,
              subscriptionData?.tier || null,
              subscriptionData?.status || null
            );

            // Check if subscription is active (same as global API)
            const isActive = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';

            return {
              userId,
              subscription: {
                hasActiveSubscription: isActive,
                tier: String(effectiveTier), // Ensure tier is always a string
                subscriptionAmount: subscriptionData?.amount || null,
                subscriptionStatus: subscriptionData?.status || null
              }
            };
          } catch (error) {
            console.warn(`Error fetching subscription for ${userId}:`, error);
            return {
              userId,
              subscription: {
                hasActiveSubscription: false,
                tier: null,
                subscriptionAmount: null,
                subscriptionStatus: null
              }
            };
          }
        });

        const subscriptionResults = await Promise.all(subscriptionPromises);

        // Combine user and subscription data
        userResults.forEach(({ userId, data }) => {
          const subscriptionData = subscriptionResults.find(s => s.userId === userId)?.subscription || {};

          results[userId] = {
            username: data?.username || null,
            displayName: data?.displayName || null,
            ...subscriptionData
          };
        });

      } catch (error) {
        console.warn(`Error fetching batch ${i}-${i + batchSize}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in fetchBatchUserData:', error);
  }

  return results;
}

function createErrorResponse(code: string, message: string) {
  return NextResponse.json({
    error: message,
    code,
    pages: [],
    total: 0,
    hasMore: false
  }, { status: 500 });
}
