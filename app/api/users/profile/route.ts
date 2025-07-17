import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET /api/users/profile?id=userId&username=username
 * 
 * Get user profile by ID or username
 * Supports both direct ID lookup and username lookup
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const username = searchParams.get('username');

    if (!id && !username) {
      return createErrorResponse('BAD_REQUEST', 'Either id or username parameter is required');
    }

    const admin = initAdmin();
    const db = admin.firestore();
    const usersCollection = getCollectionName('users');

    let userData = null;
    let userId = null;

    // First, try to get user by ID directly
    if (id) {
      const userDoc = await db.collection(usersCollection).doc(id).get();

      if (userDoc.exists) {
        userData = { id: userDoc.id, ...userDoc.data() };
        userId = userDoc.id;
      }
    }

    // If not found by ID, try to find by username
    if (!userData && (username || id)) {
      const searchUsername = username || id;

      const usernameQuery = db.collection(usersCollection).where('username', '==', searchUsername);
      const usernameSnapshot = await usernameQuery.get();

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

    // Return user profile data
    return createApiResponse({
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
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user profile');
  }
}
