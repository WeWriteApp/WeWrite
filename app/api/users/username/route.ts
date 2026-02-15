/**
 * Username Management API (Primary Route)
 *
 * GET:  Check username availability (cooldown-aware) or get cooldown status
 * POST: Set or update username (with full lifecycle: batch write, old username reservation, cookie update)
 * PUT:  Generate username suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { validateUsernameFormat as validateFormat } from '../../../utils/validationPatterns';
import { checkCooldownForUser, checkAvailabilityWithCooldown } from './cooldown';
import { parseSignedCookieValue, createSignedCookieValue, SESSION_COOKIE_OPTIONS, type SessionCookieData } from '../../../utils/cookieUtils';

interface UsernameCheckResult {
  available: boolean;
  suggestion?: string;
  suggestions?: string[];
  error?: string;
  message?: string;
  cooldown?: any;
}

/**
 * Local validation wrapper that maps validationPatterns result to { valid, error }
 */
function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const result = validateFormat(username);
  if (!result.isValid) {
    return { valid: false, error: result.message || result.error || 'Invalid username' };
  }
  return { valid: true };
}

/**
 * Generate username suggestion candidates (not yet verified as available)
 */
function generateUsernameCandidates(baseUsername: string): string[] {
  const candidates: string[] = [];
  const cleanBase = baseUsername.replace(/[^a-zA-Z0-9_.\-]/g, '').toLowerCase();

  if (cleanBase.length >= 3) {
    const currentYear = new Date().getFullYear();
    candidates.push(`${cleanBase}${Math.floor(Math.random() * 100)}`);
    candidates.push(`${cleanBase}_${Math.floor(Math.random() * 1000)}`);
    candidates.push(`${cleanBase}${currentYear}`);
    candidates.push(`${cleanBase}${Math.floor(Math.random() * 10000)}`);
    candidates.push(`${cleanBase}_${currentYear}`);
    candidates.push(`the_${cleanBase}`);
    candidates.push(`${cleanBase}_real`);
  }

  return candidates.filter(c =>
    c.length >= 3 &&
    c.length <= 30 &&
    /^[a-zA-Z0-9_.\-]+$/.test(c) &&
    !/^[._\-]|[._\-]$/.test(c) &&
    !/[._\-]{2,}/.test(c)
  );
}

/**
 * Check if a username is available (simple helper for suggestion checking)
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

  // If the usernames doc is reserved and expired, treat as available
  if (usernameDoc.exists) {
    const data = usernameDoc.data();
    if (data?.status === 'reserved' && data?.reservedUntil) {
      const expiry = new Date(data.reservedUntil);
      if (new Date() > expiry) {
        return usersQuery.empty;
      }
    }
  }

  return usersQuery.empty && !usernameDoc.exists;
}

/**
 * Generate verified available username suggestions
 */
async function generateVerifiedSuggestions(db: FirebaseFirestore.Firestore, baseUsername: string, maxSuggestions: number = 3): Promise<string[]> {
  const candidates = generateUsernameCandidates(baseUsername);
  const availableSuggestions: string[] = [];

  for (const candidate of candidates) {
    if (availableSuggestions.length >= maxSuggestions) break;

    try {
      const available = await isUsernameAvailable(db, candidate);
      if (available) {
        availableSuggestions.push(candidate);
      }
    } catch (error) {
      console.warn(`Error checking suggestion ${candidate}:`, error);
    }
  }

  return availableSuggestions;
}

// GET endpoint - Check username availability or cooldown status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle cooldown status request
    if (action === 'cooldown-status') {
      const currentUserId = await getUserIdFromRequest(request);
      if (!currentUserId) {
        return createErrorResponse('UNAUTHORIZED');
      }

      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      const cooldownStatus = await checkCooldownForUser(db, currentUserId);

      return createApiResponse(cooldownStatus);
    }

    // Standard availability check
    const username = searchParams.get('username');
    if (!username) {
      return createErrorResponse('BAD_REQUEST', 'Username parameter is required');
    }

    const formatValidation = validateUsernameFormat(username);
    if (!formatValidation.valid) {
      return createApiResponse({
        available: false,
        error: formatValidation.error
      });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get current user ID (may be null for unauthenticated checks)
    const currentUserId = await getUserIdFromRequest(request);

    // Use cooldown-aware availability check
    const availabilityResult = await checkAvailabilityWithCooldown(db, username, currentUserId);

    const result: UsernameCheckResult = {
      available: availabilityResult.available,
      error: availabilityResult.error,
      message: availabilityResult.message,
      cooldown: availabilityResult.cooldown,
    };

    // If not available, provide suggestions
    if (!availabilityResult.available) {
      const verifiedSuggestions = await generateVerifiedSuggestions(db, username, 3);
      if (verifiedSuggestions.length > 0) {
        result.suggestion = verifiedSuggestions[0];
        result.suggestions = verifiedSuggestions;
      }
    }

    return createApiResponse(result);

  } catch (error) {
    console.error('Error checking username availability:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check username availability');
  }
}

// POST endpoint - Set or update username (full lifecycle)
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

    // Get current user data
    const userRef = db.collection(getCollectionName('users')).doc(currentUserId);
    const userDoc = await userRef.get();

    let oldUsername: string | null = null;
    let userEmail: string | null = null;
    if (userDoc.exists) {
      const data = userDoc.data();
      oldUsername = data?.username || null;
      userEmail = data?.email || null;
    }

    // If no actual change, return early
    if (oldUsername && oldUsername === username) {
      return createApiResponse({
        success: true,
        username,
        message: 'Username unchanged',
      });
    }

    // Check cooldown (only for username *changes*, not initial set)
    if (oldUsername) {
      const cooldownStatus = await checkCooldownForUser(db, currentUserId);
      if (cooldownStatus.blocked) {
        return createErrorResponse('BAD_REQUEST', cooldownStatus.message || 'Username change is on cooldown');
      }
    }

    // Check availability with cooldown awareness
    const availabilityResult = await checkAvailabilityWithCooldown(db, username, currentUserId);
    if (!availabilityResult.available) {
      return createErrorResponse('BAD_REQUEST', availabilityResult.message || 'Username is not available');
    }

    // Build a Firestore batch for atomicity
    const batch = db.batch();
    const now = new Date();

    // 1. Update user document with new username
    batch.set(userRef, {
      username,
      lastModified: now.toISOString(),
    }, { merge: true });

    // 2. Create usernames/{new} doc with status: 'active'
    const newUsernameRef = db.collection(getCollectionName('usernames')).doc(username.toLowerCase());
    batch.set(newUsernameRef, {
      uid: currentUserId,
      username: username,
      email: userEmail || '',
      status: 'active',
      createdAt: now.toISOString(),
    });

    // 3. If this is a change, convert old username doc to 'reserved'
    if (oldUsername && oldUsername !== username) {
      const oldUsernameRef = db.collection(getCollectionName('usernames')).doc(oldUsername.toLowerCase());
      const reservedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      batch.set(oldUsernameRef, {
        status: 'reserved',
        reservedBy: currentUserId,
        releasedAt: now.toISOString(),
        reservedUntil: reservedUntil.toISOString(),
        originalUsername: oldUsername,
      });

      // 4. Write usernameHistory record
      const historyRef = db.collection(getCollectionName('usernameHistory')).doc();
      batch.set(historyRef, {
        userId: currentUserId,
        oldUsername,
        newUsername: username,
        changedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Commit the batch
    await batch.commit();

    // Update Realtime Database (non-critical, don't fail on error)
    try {
      const rtdb = admin.database();
      await rtdb.ref(`users/${currentUserId}`).update({
        username,
        lastModified: now.toISOString(),
      });
    } catch (rtdbError) {
      console.warn('Failed to update username in RTDB:', rtdbError);
    }

    // Invalidate caches
    try {
      const { invalidateCache } = await import('../../../utils/serverCache');
      invalidateCache.user(currentUserId);
      invalidateCache.search();
    } catch (cacheError) {
      console.error('Error invalidating caches after username update:', cacheError);
    }

    // Update session cookie with new username
    const cookieValue = request.cookies.get('simpleUserSession')?.value;
    if (cookieValue) {
      try {
        const sessionData = await parseSignedCookieValue<SessionCookieData>(cookieValue);
        if (sessionData) {
          sessionData.username = username;
          const signedValue = await createSignedCookieValue(sessionData);

          const response = NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: {
              success: true,
              username,
              message: oldUsername ? 'Username updated successfully' : 'Username set successfully',
              metadata: {
                userId: currentUserId,
                oldUsername,
                newUsername: username,
                cacheInvalidated: true,
              },
            },
          });

          response.cookies.set({
            name: 'simpleUserSession',
            value: signedValue,
            ...SESSION_COOKIE_OPTIONS,
          });

          return response;
        }
      } catch {
        // Cookie parse failed, continue without updating cookie
      }
    }

    return createApiResponse({
      success: true,
      username,
      message: oldUsername ? 'Username updated successfully' : 'Username set successfully',
      metadata: {
        userId: currentUserId,
        oldUsername,
        newUsername: username,
        cacheInvalidated: true,
      },
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
    const maxAttempts = count * 3;

    for (let i = 0; i < maxAttempts && suggestions.length < count; i++) {
      let suggestion: string;
      const cleanBase = baseUsername.replace(/[^a-zA-Z0-9_.\-]/g, '').toLowerCase()
        .replace(/^[._\-]+|[._\-]+$/g, '')
        .replace(/[._\-]{2,}/g, '_');

      if (i === 0) {
        suggestion = cleanBase;
      } else if (i < 5) {
        suggestion = `${cleanBase}${Math.floor(Math.random() * 1000)}`;
      } else {
        suggestion = `${cleanBase}_${Math.floor(Math.random() * 1000)}`;
      }

      const formatValidation = validateUsernameFormat(suggestion);
      if (!formatValidation.valid) {
        continue;
      }

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
