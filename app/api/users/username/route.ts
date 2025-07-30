/**
 * Username Management API
 * Provides endpoints for username operations without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface UsernameCheckResult {
  available: boolean;
  suggestion?: string;
  error?: string;
}

// Username validation regex (same as client-side)
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * Validate username format
 */
function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }

  if (username.length > 20) {
    return { valid: false, error: 'Username must be no more than 20 characters long' };
  }

  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }

  // Check for reserved usernames
  const reservedUsernames = ['admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 'support', 'help'];
  if (reservedUsernames.includes(username.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}

/**
 * Generate username suggestions
 */
function generateUsernameSuggestions(baseUsername: string): string[] {
  const suggestions: string[] = [];
  const cleanBase = baseUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  if (cleanBase.length >= 3) {
    suggestions.push(cleanBase);
    suggestions.push(`${cleanBase}${Math.floor(Math.random() * 100)}`);
    suggestions.push(`${cleanBase}_${Math.floor(Math.random() * 1000)}`);
  }
  
  return suggestions.slice(0, 3);
}

// GET endpoint - Check username availability
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse('BAD_REQUEST', 'Username parameter is required');
    }

    // Validate format first
    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.valid) {
      return createApiResponse({
        available: false,
        error: formatValidation.error
      });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Check if username exists in Firestore users collection
    const usersQuery = await db.collection(getCollectionName('users'))
      .where('username', '==', username)
      .limit(1)
      .get();

    const isAvailable = usersQuery.empty;

    const result: UsernameCheckResult = {
      available: isAvailable
    };

    // If not available, provide suggestions
    if (!isAvailable) {
      const suggestions = generateUsernameSuggestions(username);
      result.suggestion = suggestions[0];
    }

    return createApiResponse(result);

  } catch (error) {
    console.error('Error checking username availability:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check username availability');
  }
}

// POST endpoint - Set or update username
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return createErrorResponse('BAD_REQUEST', 'Username is required');
    }

    // Validate format
    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.valid) {
      return createErrorResponse('BAD_REQUEST', formatValidation.error);
    }

    // Check availability (excluding current user)
    const usersQuery = await db.collection(getCollectionName('users'))
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!usersQuery.empty) {
      const existingUser = usersQuery.docs[0];
      if (existingUser.id !== currentUserId) {
        return createErrorResponse('BAD_REQUEST', 'Username is already taken');
      }
    }

    // Get current user data
    const userRef = db.collection(getCollectionName('users')).doc(currentUserId);
    const userDoc = await userRef.get();
    
    let oldUsername = null;
    if (userDoc.exists) {
      oldUsername = userDoc.data()?.username;
    }

    // Update user document
    await userRef.set({
      username,
      lastModified: new Date().toISOString()
    }, { merge: true });

    // Record username history if this is a change
    if (oldUsername && oldUsername !== username) {
      await db.collection(getCollectionName('usernameHistory')).add({
        userId: currentUserId,
        oldUsername,
        newUsername: username,
        changedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Also update in Realtime Database for compatibility
    try {
      const rtdb = admin.database();
      await rtdb.ref(`users/${currentUserId}`).update({
        username,
        lastModified: new Date().toISOString()
      });
    } catch (rtdbError) {
      console.warn('Failed to update username in RTDB:', rtdbError);
      // Don't fail the request if RTDB update fails
    }

    // CRITICAL: Invalidate all username-related caches
    console.log('🔄 Username updated, invalidating caches for user:', currentUserId);

    // Trigger cache invalidation for all components that might display this username
    try {
      // Import cache invalidation utilities
      const { invalidateUserPages, invalidateRecentActivity } = await import('../../../utils/globalCacheInvalidation');
      const { invalidatePageCreationCaches } = await import('../../../utils/cacheInvalidation');

      // Invalidate user-specific caches
      invalidateUserPages(currentUserId);

      // Invalidate activity caches (since activities show usernames)
      invalidateRecentActivity();

      // Invalidate all page-related caches for this user
      invalidatePageCreationCaches(currentUserId);

      console.log('✅ Cache invalidation completed for username update');
    } catch (cacheError) {
      console.error('❌ Error invalidating caches after username update:', cacheError);
      // Don't fail the request if cache invalidation fails
    }

    return createApiResponse({
      username,
      message: oldUsername ? 'Username updated successfully' : 'Username set successfully',
      // Include metadata to help client-side components refresh
      metadata: {
        userId: currentUserId,
        oldUsername,
        newUsername: username,
        cacheInvalidated: true
      }
    });

  } catch (error) {
    console.error('Error setting username:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to set username');
  }
}

// PUT endpoint - Generate username suggestions
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUsername, count = 5 } = body;

    if (!baseUsername) {
      return createErrorResponse('BAD_REQUEST', 'Base username is required');
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const suggestions: string[] = [];
    const maxAttempts = count * 3; // Try more than requested to account for taken usernames
    
    for (let i = 0; i < maxAttempts && suggestions.length < count; i++) {
      let suggestion: string;
      
      if (i === 0) {
        // First try the clean base username
        suggestion = baseUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      } else if (i < 5) {
        // Try with numbers
        suggestion = `${baseUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}${Math.floor(Math.random() * 1000)}`;
      } else {
        // Try with underscores and numbers
        suggestion = `${baseUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}_${Math.floor(Math.random() * 1000)}`;
      }

      // Validate format
      const formatValidation = validateUsernameFormat(suggestion);
      if (!formatValidation.valid) {
        continue;
      }

      // Check availability
      const usersQuery = await db.collection(getCollectionName('users'))
        .where('username', '==', suggestion)
        .limit(1)
        .get();

      if (usersQuery.empty && !suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
      }
    }

    return createApiResponse({
      suggestions,
      baseUsername
    });

  } catch (error) {
    console.error('Error generating username suggestions:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to generate username suggestions');
  }
}
