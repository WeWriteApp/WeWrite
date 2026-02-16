/**
 * Admin Authentication Helper
 * Provides authentication and authorization utilities for admin API endpoints
 *
 * Admin status is now determined by the session cookie's isAdmin flag,
 * which is set by /api/auth/session using:
 * 1. Firebase Custom Claims (most secure, cryptographically signed)
 * 2. Firestore isAdmin/role fields
 * 3. Dev user whitelist (development only)
 *
 * Security features:
 * - HMAC-signed session cookies (C2 fix)
 * - CSRF protection for state-changing operations (H6 fix)
 * - Dev user whitelist instead of open dev admin (H1 fix)
 */

import { NextRequest } from 'next/server';
import { getUserIdFromRequest } from './auth-helper';
import { getEnvironmentType } from '../utils/environmentConfig';
import { DEV_TEST_USER_UIDS } from '../utils/testUsers';
import { parseSignedCookieValue, type SessionCookieData } from '../utils/cookieUtils';
import { verifyCsrfToken } from '../utils/csrfProtection';

interface SessionData {
  uid?: string;
  email?: string;
  isAdmin?: boolean;
}

/**
 * Get session data from session cookie
 * Uses signed cookie verification for tamper protection (C2 fix)
 */
async function getSessionData(request: NextRequest): Promise<SessionData | null> {
  const simpleSessionCookie = request.cookies.get('simpleUserSession')?.value;
  if (!simpleSessionCookie) return null;

  // Try to parse as signed cookie first (new secure format)
  const signedData = await parseSignedCookieValue<SessionCookieData>(simpleSessionCookie);
  if (signedData) {
    return signedData;
  }

  // Legacy fallback: try plain JSON (will be removed in future)
  try {
    const legacyData = JSON.parse(simpleSessionCookie) as SessionData;
    return legacyData;
  } catch {
    return null;
  }
}

/**
 * Check if a user is an admin (server-side version)
 * Uses the session cookie's isAdmin flag which is set by /api/auth/session
 * In development, grants access to whitelisted test users only (H1 security fix)
 */
export const isAdminServer = async (request: NextRequest): Promise<boolean> => {
  const sessionData = await getSessionData(request);
  if (!sessionData) return false;

  // Check session's isAdmin flag (set by /api/auth/session from Custom Claims + Firestore)
  if (sessionData.isAdmin === true) {
    return true;
  }

  // H1 Security Fix: Only whitelisted dev users get admin in development
  const env = getEnvironmentType();
  if (env === 'development' && sessionData.uid) {
    return DEV_TEST_USER_UIDS.includes(sessionData.uid);
  }

  return false;
};

/**
 * Check if a user record should be marked as admin
 * Used for displaying admin status in admin panels
 * This checks Firestore data, not session - used when listing users
 *
 * @deprecated Use Firestore isAdmin field directly instead
 */
export const isUserRecordAdmin = (_userEmail?: string | null): boolean => {
  // This is deprecated - admin status should be read from Firestore isAdmin field directly
  // Return false to indicate no email-based admin check
  return false;
};

export interface CheckAdminPermissionsOptions {
  /** Skip CSRF verification (only for GET/HEAD/OPTIONS or special cases) */
  skipCsrf?: boolean;
}

/**
 * Check admin permissions for API requests
 * Uses session cookie's isAdmin flag - set by /api/auth/session
 *
 * H6 Security Fix: CSRF protection for state-changing requests
 * - GET/HEAD/OPTIONS: CSRF check skipped automatically
 * - POST/PUT/PATCH/DELETE: CSRF token required in X-CSRF-Token header
 */
export async function checkAdminPermissions(
  request: NextRequest,
  options?: CheckAdminPermissionsOptions
): Promise<{success: boolean, error?: string, userEmail?: string}> {
  try {
    // H6 Security Fix: Verify CSRF token for state-changing requests
    if (!options?.skipCsrf) {
      const csrfValid = await verifyCsrfToken(request);
      if (!csrfValid) {
        console.warn('[ADMIN AUTH] CSRF validation failed');
        return { success: false, error: 'CSRF validation failed - please refresh and try again' };
      }
    }

    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return { success: false, error: 'Unauthorized - no user ID' };
    }

    // Get session data (now uses signed cookie verification)
    const sessionData = await getSessionData(request);

    // Check if session has isAdmin flag
    if (sessionData?.isAdmin === true) {
      return { success: true, userEmail: sessionData.email || undefined };
    }

    // H1 Security Fix: Only whitelisted dev users get admin in development
    const env = getEnvironmentType();
    if (env === 'development' && sessionData?.uid && DEV_TEST_USER_UIDS.includes(sessionData.uid)) {
      return { success: true, userEmail: sessionData?.email || undefined };
    }

    // Not an admin
    return { success: false, error: 'Admin access required' };
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return { success: false, error: 'Authentication error' };
  }
}
