import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { initAdmin } from '../../../../firebase/admin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * Server-safe user profile loading (no client-side caching)
 */
async function getServerUserProfile(userId: string) {
  const admin = initAdmin();
  const db = admin.firestore();

  const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

  if (userDoc.exists) {
    return { id: userDoc.id, ...userDoc.data() };
  }

  return null;
}

/**
 * API route for updating user bio content
 * Handles environment-aware collection names and development authentication
 */

// GET endpoint - Get user bio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return createErrorResponse('BAD_REQUEST', 'User ID is required');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Get user document from environment-aware collection
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

    if (!userDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'User not found');
    }

    const userData = userDoc.data();

    // Normalize Firestore data to plain JSON to avoid environment differences
    const normalizedBio = userData?.bio
      ? JSON.parse(JSON.stringify(userData.bio))
      : '';

    const response = createApiResponse({
      bio: normalizedBio,
      bioLastEditor: userData?.bioLastEditor || null,
      bioLastEditTime: userData?.bioLastEditTime || null
    });

    // Prevent caching of bio data to ensure users always see latest content
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error) {
    console.error('Error fetching user bio:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch user bio');
  }
}

// PUT endpoint - Update user bio
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return createErrorResponse('BAD_REQUEST', 'User ID is required');
    }

    // Get current user ID from request (handles both production and development auth)
    const currentUserId = await getUserIdFromRequest(request);
    
    // Check if user is authorized to update this bio
    // Allow if:
    // 1. User is updating their own bio
    // 2. User is a development test user (for development environment)
    const isDevelopmentTestUser = userId.startsWith('dev_test_');
    const isAuthorized = currentUserId === userId || isDevelopmentTestUser;

    if (!isAuthorized) {
      return createErrorResponse('FORBIDDEN', 'Not authorized to update this user bio');
    }

    const body = await request.json();
    const { bio, editorName } = body;

    if (bio === undefined) {
      return createErrorResponse('BAD_REQUEST', 'Bio content is required');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Update user document in environment-aware collection
    const userDocRef = db.collection(getCollectionName('users')).doc(userId);

    const updateData = {
      bio: bio,
      bioLastEditor: editorName || 'Unknown',
      bioLastEditTime: new Date().toISOString()
    };

    // Check if user document exists, create if it doesn't
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      // Create user document with basic fields
      await userDocRef.set({
        uid: userId,
        ...updateData,
        createdAt: new Date().toISOString()
      });
    } else {
      // Update existing user document
      await userDocRef.update(updateData);
    }

    console.log(`Bio updated for user ${userId} by ${editorName || 'Unknown'}`);

    return createApiResponse({
      success: true,
      message: 'Bio updated successfully',
      bio: bio,
      bioLastEditor: updateData.bioLastEditor,
      bioLastEditTime: updateData.bioLastEditTime
    });

  } catch (error) {
    console.error('Error updating user bio:', error);
    
    // Provide more specific error messages
    if (error.code === 'not-found') {
      return createErrorResponse('NOT_FOUND', 'User not found');
    } else if (error.code === 'permission-denied') {
      return createErrorResponse('FORBIDDEN', 'Permission denied');
    }
    
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update user bio');
  }
}
