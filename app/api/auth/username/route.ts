import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { cookies } from 'next/headers';
import {
  verifyIdToken,
  getFirestoreDocument,
  setFirestoreDocument,
  updateFirestoreDocument,
  queryFirestoreDocuments,
  updateRtdbData
} from '../../../lib/firebase-rest';
import { getCollectionName } from '../../../utils/environmentConfig';
import { validateUsernameFormat } from '../../../utils/validationPatterns';

/**
 * Username Management API Route
 * 
 * GET: Check username availability
 * POST: Add/update username for user
 * 
 * This route uses Firebase REST APIs to avoid server-side firebase-admin issues.
 */

// GET /api/auth/username?username=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse('BAD_REQUEST', 'Username is required');
    }

    // Validate username format using centralized validation
    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.isValid) {
      return createApiResponse({
        isAvailable: false,
        message: formatValidation.message,
        error: formatValidation.error,
        suggestions: []
      });
    }

    // Check if username exists in users collection
    const usersQuery = await queryFirestoreDocuments(
      getCollectionName('users'),
      'username',
      'EQUAL',
      username,
      1
    );

    // Check if username exists in usernames collection
    let usernamesQueryResult: { success: boolean; documents?: Array<{ id: string; data: Record<string, any> }> } = { success: true, documents: [] };
    try {
      usernamesQueryResult = await queryFirestoreDocuments(
        getCollectionName('usernames'),
        'username',
        'EQUAL',
        username,
        1
      );
    } catch (error) {
      // Usernames collection might not exist, that's okay
      console.log('[username] Usernames collection query failed (may not exist)');
    }

    const isAvailable = 
      (!usersQuery.documents || usersQuery.documents.length === 0) && 
      (!usernamesQueryResult.documents || usernamesQueryResult.documents.length === 0);

    // Generate suggestions if username is taken
    const suggestions: string[] = [];
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
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check username availability');
  }
}

// Helper function to get user ID from request
async function getUserIdFromSession(request: NextRequest): Promise<string | null> {
  // First try session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("simpleUserSession");
  
  if (sessionCookie?.value) {
    try {
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
      if (sessionData.uid) {
        return sessionData.uid;
      }
    } catch {
      // Continue to check auth header
    }
  }

  // Try Authorization header with ID token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const verifyResult = await verifyIdToken(token);
    if (verifyResult.success && verifyResult.uid) {
      return verifyResult.uid;
    }
  }

  return null;
}

// POST /api/auth/username
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromSession(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return createErrorResponse('BAD_REQUEST', 'Username is required');
    }

    // Guard: If user already has a username, they should use /api/users/username for changes
    const currentUserDoc = await getFirestoreDocument(getCollectionName('users'), currentUserId);
    if (currentUserDoc.success && currentUserDoc.data?.username) {
      return createErrorResponse('BAD_REQUEST', 'Use /api/users/username to change an existing username');
    }

    // Validate username format using centralized validation
    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.isValid) {
      return createErrorResponse('BAD_REQUEST', formatValidation.message || 'Invalid username format');
    }

    // Check if username is already taken
    const usersQuery = await queryFirestoreDocuments(
      getCollectionName('users'),
      'username',
      'EQUAL',
      username,
      5
    );

    if (usersQuery.success && usersQuery.documents && usersQuery.documents.length > 0) {
      // Check if it's the same user
      const isSameUser = usersQuery.documents.some(doc => doc.id === currentUserId);
      if (!isSameUser) {
        return createErrorResponse('BAD_REQUEST', 'This username is already taken. Please choose a different username.');
      }
    }

    // Update user's username in Firestore
    const updateResult = await updateFirestoreDocument(
      getCollectionName('users'),
      currentUserId,
      {
        username: username,
        lastModified: new Date().toISOString()
      }
    );

    if (!updateResult.success) {
      console.error('Failed to update username in Firestore:', updateResult.error);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to update username');
    }

    // CRITICAL: Also update username in Realtime Database
    // This is the primary source for username lookups in leaderboard, trending, etc.
    try {
      const rtdbResult = await updateRtdbData(`users/${currentUserId}`, {
        username: username,
        lastModified: new Date().toISOString()
      });
      if (rtdbResult.success) {
        console.log(`✅ Username updated in RTDB for user ${currentUserId}`);
      } else {
        console.error('❌ Failed to update username in RTDB:', rtdbResult.error);
      }
    } catch (rtdbError) {
      console.error('❌ Failed to update username in RTDB:', rtdbError);
      // Don't fail the request, but log for monitoring
    }

    // Also add to usernames collection for faster lookups
    try {
      // Get user's email for login compatibility
      const userDoc = await getFirestoreDocument(getCollectionName('users'), currentUserId);
      const userEmail = userDoc.success ? userDoc.data?.email : null;

      if (userEmail) {
        await setFirestoreDocument(
          getCollectionName('usernames'),
          username.toLowerCase(),
          {
            uid: currentUserId,
            username: username,
            email: userEmail,
            createdAt: new Date().toISOString()
          }
        );
      } else {
        console.warn('Could not find user email for username mapping');
      }
    } catch (error) {
      // Usernames collection might not exist, that's okay
      console.warn('Could not update usernames collection:', error);
    }

    // Update the session cookie with the new username
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("simpleUserSession");
    
    if (sessionCookie?.value) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
        sessionData.username = username;
        
        const response = NextResponse.json({
          success: true,
          data: {
            success: true,
            message: 'Username updated successfully',
            username: username
          }
        });
        
        response.cookies.set({
          name: "simpleUserSession",
          value: encodeURIComponent(JSON.stringify(sessionData)),
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        
        return response;
      } catch {
        // Session parse failed, continue without updating cookie
      }
    }

    return createApiResponse({ 
      success: true, 
      message: 'Username updated successfully',
      username: username
    });

  } catch (error) {
    console.error('Error updating username:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update username');
  }
}
