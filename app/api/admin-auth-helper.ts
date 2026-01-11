/**
 * Admin Authentication Helper
 * Provides authentication and authorization utilities for admin API endpoints
 *
 * Admin status is now determined by the session cookie's isAdmin flag,
 * which is set by /api/auth/session using:
 * 1. Firebase Custom Claims (most secure, cryptographically signed)
 * 2. Firestore isAdmin/role fields
 * 3. Dev user whitelist (development only)
 */

import { NextRequest } from 'next/server';
import { getUserIdFromRequest } from './auth-helper';
import { getEnvironmentType } from '../utils/environmentConfig';
import { DEV_TEST_USER_UIDS } from '../utils/testUsers';

interface SessionData {
  uid?: string;
  email?: string;
  isAdmin?: boolean;
}

/**
 * Get session data from session cookie
 */
function getSessionData(request: NextRequest): SessionData | null {
  const simpleSessionCookie = request.cookies.get('simpleUserSession')?.value;
  if (!simpleSessionCookie) return null;

  try {
    return JSON.parse(simpleSessionCookie) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Check if a user is an admin (server-side version)
 * Uses the session cookie's isAdmin flag which is set by /api/auth/session
 * In development, grants access to whitelisted test users only (H1 security fix)
 */
export const isAdminServer = (request: NextRequest): boolean => {
  const sessionData = getSessionData(request);
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

/**
 * Check admin permissions for API requests
 * Uses session cookie's isAdmin flag - set by /api/auth/session
 */
export async function checkAdminPermissions(request: NextRequest): Promise<{success: boolean, error?: string, userEmail?: string}> {
  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return { success: false, error: 'Unauthorized - no user ID' };
    }

    // Get session data
    const sessionData = getSessionData(request);

    // Check if session has isAdmin flag
    if (sessionData?.isAdmin === true) {
      console.log('🔐 [ADMIN AUTH] Admin access granted via session isAdmin flag');
      return { success: true, userEmail: sessionData.email || undefined };
    }

    // H1 Security Fix: Only whitelisted dev users get admin in development
    const env = getEnvironmentType();
    if (env === 'development' && sessionData?.uid && DEV_TEST_USER_UIDS.includes(sessionData.uid)) {
      console.log('🔧 [DEV MODE] Admin access granted via dev whitelist');
      return { success: true, userEmail: sessionData?.email || undefined };
    }

    // Not an admin
    return { success: false, error: 'Admin access required' };
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return { success: false, error: 'Authentication error' };
  }
}
