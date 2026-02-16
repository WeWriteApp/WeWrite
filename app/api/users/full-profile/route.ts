import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse, getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { userCache } from '../../../utils/userCache';
import { trackFirebaseRead } from '../../../utils/costMonitor';
import { getDocWithTimeout, queryWithTimeout } from '../../../utils/firebaseTimeout';
import { sanitizeUsername } from '../../../utils/usernameSecurity';
import { getUserSubscriptionServer } from '../../../firebase/subscription-server';
import { getEffectiveTier } from '../../../utils/subscriptionTiers';

/**
 * GET /api/users/full-profile?id=userId&username=username
 *
 * Get user profile WITH subscription data in a single request
 * This reduces 2 sequential API calls to 1, significantly improving user profile page load time
 *
 * Features:
 * - Combined profile + subscription data
 * - Multi-tier caching
 * - Cost tracking and optimization
 */

// Combined cache for profile + subscription
const fullProfileCache = new Map<string, { data: any; timestamp: number }>();
const FULL_PROFILE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes (match subscription cache)

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const username = searchParams.get('username');
    const includeSubscription = searchParams.get('includeSubscription') !== 'false'; // Default true

    if (!id && !username) {
      return createErrorResponse('BAD_REQUEST', 'Either id or username parameter is required');
    }

    const lookupValue = id || username;
    const cacheKey = `full-profile:${lookupValue}:${includeSubscription}`;

    // Check combined cache first
    const cached = fullProfileCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < FULL_PROFILE_CACHE_TTL) {
      const responseTime = Date.now() - startTime;

      const response = createApiResponse(cached.data);
      response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=300'); // 2min browser, 5min CDN
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      return response;
    }


    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not available');
    }

    const db = admin.firestore();
    const usersCollection = await getCollectionNameAsync('users');

    let userData = null;
    let userId = null;

    // First, try to get user by ID directly
    if (id) {
      const userDoc = await getDocWithTimeout(
        db.collection(usersCollection).doc(id),
        6000
      );

      if (userDoc.exists) {
        userData = { id: userDoc.id, ...userDoc.data() };
        userId = userDoc.id;
      }
    }

    // If not found by ID, try to find by username
    if (!userData && (username || id)) {
      const searchUsername = username || id;
      const usernameQuery = db.collection(usersCollection).where('username', '==', searchUsername);
      const usernameSnapshot = await queryWithTimeout(usernameQuery, 6000);

      if (!usernameSnapshot.empty) {
        const userDoc = usernameSnapshot.docs[0];
        userData = { id: userDoc.id, ...userDoc.data() };
        userId = userDoc.id;
      }
    }

    if (!userData || !userId) {
      return createErrorResponse('NOT_FOUND', 'User not found');
    }

    // Sanitize username
    const safeUsername = sanitizeUsername(
      userData.username || `user_${userId?.slice(0, 8)}`,
      'User',
      `user_${userId?.slice(0, 8)}`
    );

    // Prepare base profile data
    const profileData: any = {
      uid: userId,
      id: userId,
      username: safeUsername,
      bio: userData.bio || '',
      createdAt: userData.createdAt,
      lastModified: userData.lastModified,
      totalPages: userData.totalPages || 0,
      publicPages: userData.publicPages || 0,
      profilePicture: userData.profilePicture || null,
      location: userData.location || null,
      website: userData.website || null,
    };

    // Track profile read
    trackFirebaseRead('users', 'getFullProfile', 1, 'api-full-profile');

    // Fetch subscription data in parallel if requested
    if (includeSubscription) {
      try {
        const subscription = await getUserSubscriptionServer(userId, { verbose: false });

        if (subscription) {
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          // Pre-compute the effective tier using centralized logic
          profileData.tier = getEffectiveTier(
            subscription.amount ?? null,
            subscription.tier ?? null,
            subscription.status ?? null
          );
          // Keep these for admin/debugging but they're no longer needed for badge display
          profileData.subscriptionStatus = subscription.status;
          profileData.subscriptionAmount = isActive ? subscription.amount : 0;
          profileData.hasSubscription = isActive;
        } else {
          profileData.tier = 'inactive';
          profileData.subscriptionStatus = 'inactive';
          profileData.subscriptionAmount = 0;
          profileData.hasSubscription = false;
        }
      } catch (subError) {
        console.warn(`[Full Profile API] Failed to fetch subscription for ${userId}:`, subError);
        // Don't fail the whole request if subscription fetch fails
        profileData.tier = 'inactive';
        profileData.subscriptionStatus = null;
        profileData.subscriptionAmount = null;
        profileData.hasSubscription = false;
      }
    }

    // Cache the combined result
    fullProfileCache.set(cacheKey, {
      data: profileData,
      timestamp: Date.now()
    });

    // Also cache in user profile cache for other uses
    userCache.set(lookupValue, profileData, 'profile');

    const responseTime = Date.now() - startTime;

    const response = createApiResponse(profileData);
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Response-Time', `${responseTime}ms`);

    return response;

  } catch (error: any) {
    console.error('Error fetching full user profile:', error);

    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      return createErrorResponse('TIMEOUT', 'Request timed out - please try again');
    }

    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user profile');
  }
}

// POST endpoint to invalidate cache
export async function POST(request: NextRequest) {
  try {
    const { action, userId } = await request.json();

    if (action === 'invalidate-cache' && userId) {
      // Clear all cache entries for this user
      for (const key of fullProfileCache.keys()) {
        if (key.includes(userId)) {
          fullProfileCache.delete(key);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cache invalidated for user ${userId}`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action or missing userId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
