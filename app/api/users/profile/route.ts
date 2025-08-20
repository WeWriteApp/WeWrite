import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { userCache } from '../../../utils/userCache';
import { trackFirebaseRead } from '../../../utils/costMonitor';
import { getDocWithTimeout, queryWithTimeout } from '../../../utils/firebaseTimeout';

/**
 * GET /api/users/profile?id=userId&username=username
 *
 * Get user profile by ID or username with enhanced caching
 * Features:
 * - Multi-tier caching (hot/warm/cold)
 * - Smart cache promotion based on access frequency
 * - Cost tracking and optimization
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const username = searchParams.get('username');

    if (!id && !username) {
      return createErrorResponse('BAD_REQUEST', 'Either id or username parameter is required');
    }

    const lookupValue = id || username;
    console.log(`👤 [User Profile API] Fetching profile for: ${lookupValue}`);

    // Check enhanced cache first
    const cachedProfile = userCache.get(lookupValue, 'profile');
    if (cachedProfile) {
      const responseTime = Date.now() - startTime;
      console.log(`🚀 [User Profile API] Cache hit for ${lookupValue} (${responseTime}ms)`);

      const response = createApiResponse(cachedProfile);
      response.headers.set('Cache-Control', 'public, max-age=900, s-maxage=1800'); // 15min browser, 30min CDN
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      response.headers.set('X-Database-Reads', '0');

      return response;
    }

    console.log(`💸 [User Profile API] Cache miss for ${lookupValue} - fetching from database`);

    console.log(`👤 [User Profile API] Initializing Firebase Admin for ${lookupValue}`);
    const admin = getFirebaseAdmin();

    if (!admin) {
      console.error('👤 [User Profile API] Firebase Admin initialization returned null');
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not available');
    }

    console.log('👤 [User Profile API] Firebase Admin initialized successfully');

    const db = admin.firestore();
    const usersCollection = await getCollectionNameAsync('users');

    let userData = null;
    let userId = null;

    // First, try to get user by ID directly
    if (id) {
      const userDoc = await getDocWithTimeout(
        db.collection(usersCollection).doc(id),
        6000 // 6 second timeout for document get
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
      const usernameSnapshot = await queryWithTimeout(
        usernameQuery,
        6000 // 6 second timeout for query
      );

      if (!usernameSnapshot.empty) {
        const userDoc = usernameSnapshot.docs[0];
        userData = { id: userDoc.id, ...userDoc.data() };
        userId = userDoc.id;
      }
    }

    if (!userData) {
      // Only log when user is actually not found (error case)
      console.warn('User not found:', { id, username });
      return createErrorResponse('NOT_FOUND', 'User not found');
    }

    // Prepare user profile data
    const profileData = {
      uid: userId,
      id: userId,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      bio: userData.bio || '',
      createdAt: userData.createdAt,
      lastModified: userData.lastModified,
      totalPages: userData.totalPages || 0,
      publicPages: userData.publicPages || 0,
      // Add any other profile fields you need
      profilePicture: userData.profilePicture || null,
      location: userData.location || null,
      website: userData.website || null,
    };

    // Track database read for cost monitoring
    trackFirebaseRead('users', 'getUserProfile', 1, 'api-user-profile');

    // Cache the result in enhanced cache system
    userCache.set(lookupValue, profileData, 'profile');

    const responseTime = Date.now() - startTime;
    console.log(`✅ [User Profile API] Successfully fetched ${lookupValue} (${responseTime}ms)`);

    // Return user profile data with optimized cache headers
    const response = createApiResponse(profileData);
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=900, stale-while-revalidate=1800'); // 10min browser, 15min CDN
    response.headers.set('ETag', `"user-${lookupValue}-${Date.now()}"`);
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    response.headers.set('X-Database-Reads', '1');

    return response;

  } catch (error: any) {
    console.error('Error fetching user profile:', error);

    // Handle timeout errors specifically
    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      console.error('🚨 User profile API timeout:', error.message);
      return createErrorResponse('TIMEOUT', 'Request timed out - please try again');
    }

    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user profile');
  }
}
