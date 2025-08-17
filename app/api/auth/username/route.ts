import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Username Management API Route
 * 
 * GET: Check username availability
 * POST: Add/update username for user
 * 
 * This route replaces direct Firebase calls for username operations
 * and ensures environment-aware collection naming.
 */

// GET /api/auth/username?username=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse('Username is required', 'BAD_REQUEST');
    }

    // Basic username validation
    if (username.length < 3 || username.length > 30) {
      return createApiResponse({
        isAvailable: false,
        message: 'Username must be between 3 and 30 characters',
        error: 'Invalid length',
        suggestions: []
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return createApiResponse({
        isAvailable: false,
        message: 'Username can only contain letters, numbers, and underscores',
        error: 'Invalid characters',
        suggestions: []
      });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if username exists in users collection
    const usersQuery = db.collection(getCollectionName('users')).where('username', '==', username);
    const usersSnapshot = await usersQuery.get();

    // Check if username exists in usernames collection (if it exists)
    let usernamesSnapshot;
    try {
      const usernamesQuery = db.collection(getCollectionName('usernames')).where('username', '==', username);
      usernamesSnapshot = await usernamesQuery.get();
    } catch (error) {
      // Usernames collection might not exist, that's okay
      usernamesSnapshot = { empty: true };
    }

    const isAvailable = usersSnapshot.empty && usernamesSnapshot.empty;

    // Generate suggestions if username is taken
    const suggestions = [];
    if (!isAvailable) {
      for (let i = 1; i <= 3; i++) {
        suggestions.push(`${username}${i}`);
        suggestions.push(`${username}_${i}`);
      }
    }

    return createApiResponse({
      isAvailable,
      message: isAvailable ? 'Username is available' : 'Username is already taken',
      error: isAvailable ? null : 'Username taken',
      suggestions
    });

  } catch (error) {
    console.error('Error checking username availability:', error);
    return createErrorResponse('Failed to check username availability', 'INTERNAL_ERROR');
  }
}

// POST /api/auth/username
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return createErrorResponse('Username is required', 'BAD_REQUEST');
    }

    // Basic username validation
    if (username.length < 3 || username.length > 30) {
      return createErrorResponse('Username must be between 3 and 30 characters', 'BAD_REQUEST');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return createErrorResponse('Username can only contain letters, numbers, and underscores', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if username is already taken
    const usersQuery = db.collection(getCollectionName('users')).where('username', '==', username);
    const usersSnapshot = await usersQuery.get();

    if (!usersSnapshot.empty) {
      // Check if it's the same user
      const existingUser = usersSnapshot.docs[0];
      if (existingUser.id !== currentUserId) {
        return createErrorResponse('Username is already taken', 'BAD_REQUEST');
      }
    }

    // Update user's username
    await db.collection(getCollectionName('users')).doc(currentUserId).update({
      username: username,
      lastModified: new Date().toISOString()
    });

    // Also add to usernames collection for faster lookups (if collection exists)
    try {
      // Get user's email for login compatibility
      const userDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
      const userData = userDoc.data();
      const userEmail = userData?.email;

      if (userEmail) {
        await db.collection(getCollectionName('usernames')).doc(username.toLowerCase()).set({
          uid: currentUserId, // Use 'uid' to match registration format
          username: username,
          email: userEmail, // Include email for login compatibility
          createdAt: new Date().toISOString()
        });
      } else {
        console.warn('Could not find user email for username mapping');
      }
    } catch (error) {
      // Usernames collection might not exist, that's okay
      console.warn('Could not update usernames collection:', error);
    }

    return createApiResponse({ 
      success: true, 
      message: 'Username updated successfully',
      username: username
    });

  } catch (error) {
    console.error('Error updating username:', error);
    return createErrorResponse('Failed to update username', 'INTERNAL_ERROR');
  }
}
