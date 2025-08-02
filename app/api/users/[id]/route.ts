import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';

/**
 * Optimized User Data API
 * 
 * Provides cached user data with minimal Firebase reads
 * Returns public user information only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    // Get authenticated user (optional)
    let currentUserId: string | null = null;
    try {
      currentUserId = await getUserIdFromRequest(request);
    } catch (error) {
      // Anonymous access is allowed for public user data
      console.log('Anonymous access to user data:', userId);
    }

    console.log(`[User API] Fetching user ${userId} for ${currentUserId || 'anonymous'}`);

    // Track this read for cost monitoring
    trackFirebaseRead('users', 'getUserById', 1, 'api-optimized');

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

    // Return successful result with cache headers
    const response = NextResponse.json({
      success: true,
      userData: publicUserData,
      fromCache: false // Will be set by readOptimizer
    });

    // Add cache headers for browser caching
    // Longer cache for user data since it changes less frequently
    response.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200'); // 10 min cache, 20 min stale
    response.headers.set('CDN-Cache-Control', 'public, max-age=600');
    
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
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    
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
