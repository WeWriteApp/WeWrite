import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../../utils/environmentConfig';
import { getUserIdFromRequest } from '../../../auth-helper';
import { trackFirebaseRead } from '../../../../utils/costMonitor';
import { userCache } from '../../../../utils/userCache';

/**
 * Optimized User Data API
 * 
 * Provides cached user data with minimal Firebase reads
 * Returns public user information only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const startTime = Date.now();

  try {
    const userId = params.userId;

    // Get authenticated user (optional)
    let currentUserId: string | null = null;
    try {
      currentUserId = await getUserIdFromRequest(request);
    } catch (error) {
      // Anonymous access is allowed for public user data
      console.log('🔓 Anonymous access to user data:', userId);
    }

    console.log(`👤 [User API] Fetching user ${userId} for ${currentUserId || 'anonymous'}`);

    // Check enhanced cache first
    const cachedUserData = userCache.get(userId, 'profile');
    if (cachedUserData) {
      const responseTime = Date.now() - startTime;
      console.log(`🚀 [User API] Cache hit for ${userId} (${responseTime}ms)`);

      // Filter data based on access permissions
      const publicUserData = {
        id: cachedUserData.id,
        username: cachedUserData.username,
        displayName: cachedUserData.displayName,
        bio: cachedUserData.bio,
        profilePicture: cachedUserData.profilePicture,
        isVerified: cachedUserData.isVerified || false,
        createdAt: cachedUserData.createdAt,
        // Include additional fields only for the user themselves
        ...(currentUserId === userId && {
          email: cachedUserData.email,
          preferences: cachedUserData.preferences,
          settings: cachedUserData.settings
        })
      };

      const response = NextResponse.json({
        success: true,
        userData: publicUserData,
        fromCache: true
      });

      response.headers.set('Cache-Control', 'public, max-age=900, s-maxage=1800'); // 15min browser, 30min CDN
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      response.headers.set('X-Database-Reads', '0');

      return response;
    }

    console.log(`💸 [User API] Cache miss for ${userId} - fetching from database`);

    // Track this read for cost monitoring
    trackFirebaseRead('users', 'getUserById', 1, 'api-user-profile-data');

    // Get Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Fetch user document
    const userDoc = await db
      .collection(getCollectionName(COLLECTIONS.USERS))
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (!userData) {
      return NextResponse.json(
        { error: 'User data not available' },
        { status: 404 }
      );
    }

    // Return only public user information
    const publicUserData = {
      id: userDoc.id,
      username: userData.username,
      displayName: userData.displayName,
      bio: userData.bio,
      profilePicture: userData.profilePicture,
      isVerified: userData.isVerified || false,
      createdAt: userData.createdAt,
      // Include additional fields only for the user themselves
      ...(currentUserId === userId && {
        email: userData.email,
        preferences: userData.preferences,
        settings: userData.settings
      })
    };

    // Cache the result in enhanced cache system
    userCache.set(userId, userData, 'profile');

    const responseTime = Date.now() - startTime;
    console.log(`✅ [User API] Successfully fetched ${userId} (${responseTime}ms)`);

    // Return successful result with enhanced cache headers
    const response = NextResponse.json({
      success: true,
      userData: publicUserData,
      fromCache: false
    });

    // Enhanced cache headers for fresh data
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=900, stale-while-revalidate=1800'); // 10min browser, 15min CDN
    response.headers.set('ETag', `"user-${userId}-${Date.now()}"`);
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    response.headers.set('X-Database-Reads', '1');

    return response;

  } catch (error) {
    console.error('[User API] Error fetching user:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Update user data (authenticated users only, own data only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    
    // Require authentication for updates
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Users can only update their own data
    if (currentUserId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const updateData = await request.json();

    // Validate update data
    if (!updateData || typeof updateData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid update data' },
        { status: 400 }
      );
    }

    // Sanitize update data - only allow specific fields
    const allowedFields = [
      'displayName',
      'bio',
      'profilePicture',
      'preferences',
      'settings'
    ];

    const sanitizedData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        sanitizedData[field] = updateData[field];
      }
    }

    if (Object.keys(sanitizedData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    console.log(`[User API] Updating user ${userId} with fields:`, Object.keys(sanitizedData));

    // Track this write for cost monitoring
    trackFirebaseRead('users', 'updateUser', 1, 'api-update');

    // Get Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Update user document
    await db
      .collection(getCollectionName(COLLECTIONS.USERS))
      .doc(userId)
      .update({
        ...sanitizedData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      updatedFields: Object.keys(sanitizedData)
    });

  } catch (error) {
    console.error('[User API] Error updating user:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
