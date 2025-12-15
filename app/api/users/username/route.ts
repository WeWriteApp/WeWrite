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
// Allowed: letters, numbers, underscores, dashes, and periods
const USERNAME_REGEX = /^[a-zA-Z0-9_.\-]{3,30}$/;

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

  if (username.length > 30) {
    return { valid: false, error: 'Username must be no more than 30 characters long' };
  }

  // Check for whitespace
  if (/\s/.test(username)) {
    return { valid: false, error: 'Username cannot contain spaces or whitespace' };
  }

  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, dashes, and periods' };
  }

  // Cannot start or end with a period, dash, or underscore
  if (/^[._\-]|[._\-]$/.test(username)) {
    return { valid: false, error: 'Username cannot start or end with a period, dash, or underscore' };
  }

  // Cannot have consecutive special characters
  if (/[._\-]{2,}/.test(username)) {
    return { valid: false, error: 'Username cannot have consecutive periods, dashes, or underscores' };
  }

  // Check for reserved usernames
  const reservedUsernames = ['admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 'support', 'help'];
  if (reservedUsernames.includes(username.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}

/**
 * Generate username suggestion candidates (not yet verified as available)
 */
function generateUsernameCandidates(baseUsername: string): string[] {
  const candidates: string[] = [];
  // Allow letters, numbers, underscores, dashes, and periods
  const cleanBase = baseUsername.replace(/[^a-zA-Z0-9_.\-]/g, '').toLowerCase();

  if (cleanBase.length >= 3) {
    // Add variations with numbers
    const currentYear = new Date().getFullYear();
    candidates.push(`${cleanBase}${Math.floor(Math.random() * 100)}`);
    candidates.push(`${cleanBase}_${Math.floor(Math.random() * 1000)}`);
    candidates.push(`${cleanBase}${currentYear}`);
    candidates.push(`${cleanBase}${Math.floor(Math.random() * 10000)}`);
    candidates.push(`${cleanBase}_${currentYear}`);
    candidates.push(`the_${cleanBase}`);
    candidates.push(`${cleanBase}_real`);
  }

  // Filter out any that are too long or don't match the format
  // Also ensure they don't start/end with special chars or have consecutive special chars
  return candidates.filter(c =>
    c.length >= 3 &&
    c.length <= 30 &&
    /^[a-zA-Z0-9_.\-]+$/.test(c) &&
    !/^[._\-]|[._\-]$/.test(c) &&
    !/[._\-]{2,}/.test(c)
  );
}

/**
 * Check if a username is available (helper for suggestion checking)
 */
async function isUsernameAvailable(db: FirebaseFirestore.Firestore, username: string): Promise<boolean> {
  const [usersQuery, usernameDoc] = await Promise.all([
    db.collection(getCollectionName('users'))
      .where('username', '==', username)
      .limit(1)
      .get(),
    db.collection(getCollectionName('usernames'))
      .doc(username.toLowerCase())
      .get()
  ]);
  
  return usersQuery.empty && !usernameDoc.exists;
}

/**
 * Generate verified available username suggestions
 */
async function generateVerifiedSuggestions(db: FirebaseFirestore.Firestore, baseUsername: string, maxSuggestions: number = 3): Promise<string[]> {
  const candidates = generateUsernameCandidates(baseUsername);
  const availableSuggestions: string[] = [];
  
  // Check candidates in parallel, but limit concurrent checks
  for (const candidate of candidates) {
    if (availableSuggestions.length >= maxSuggestions) break;
    
    try {
      const isAvailable = await isUsernameAvailable(db, candidate);
      if (isAvailable) {
        availableSuggestions.push(candidate);
      }
    } catch (error) {
      console.warn(`Error checking suggestion ${candidate}:`, error);
    }
  }
  
  return availableSuggestions;
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

    // Check BOTH the users collection AND the usernames collection
    // The usernames collection is the authoritative source for reserved usernames
    const [usersQuery, usernameDoc] = await Promise.all([
      db.collection(getCollectionName('users'))
        .where('username', '==', username)
        .limit(1)
        .get(),
      db.collection(getCollectionName('usernames'))
        .doc(username.toLowerCase())
        .get()
    ]);

    // Username is only available if it's not in EITHER collection
    const isInUsersCollection = !usersQuery.empty;
    const isInUsernamesCollection = usernameDoc.exists;
    const isAvailable = !isInUsersCollection && !isInUsernamesCollection;

    const result: UsernameCheckResult = {
      available: isAvailable
    };

    // If not available, provide verified available suggestions
    if (!isAvailable) {
      const verifiedSuggestions = await generateVerifiedSuggestions(db, username, 3);
      if (verifiedSuggestions.length > 0) {
        result.suggestion = verifiedSuggestions[0];
        // Also include all suggestions in the response
        (result as any).suggestions = verifiedSuggestions;
      }
      result.error = 'Username already taken';
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
      // Allow letters, numbers, underscores, dashes, and periods in base username
      const cleanBase = baseUsername.replace(/[^a-zA-Z0-9_.\-]/g, '').toLowerCase()
        .replace(/^[._\-]+|[._\-]+$/g, '') // Remove leading/trailing special chars
        .replace(/[._\-]{2,}/g, '_'); // Replace consecutive special chars with single underscore

      if (i === 0) {
        // First try the clean base username
        suggestion = cleanBase;
      } else if (i < 5) {
        // Try with numbers
        suggestion = `${cleanBase}${Math.floor(Math.random() * 1000)}`;
      } else {
        // Try with underscores and numbers
        suggestion = `${cleanBase}_${Math.floor(Math.random() * 1000)}`;
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
