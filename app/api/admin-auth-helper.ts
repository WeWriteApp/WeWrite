/**
 * Admin Authentication Helper
 * Provides authentication and authorization utilities for admin API endpoints
 *
 * Uses centralized admin configuration from adminConfig.ts
 * Admin lists are loaded from environment variables.
 */

import { NextRequest } from 'next/server';
import { getUserIdFromRequest } from './auth-helper';
import { getAdminEmails, getAdminUserIds } from '../utils/adminConfig';
import { getEnvironmentType } from '../utils/environmentConfig';

/**
 * Check if a user is an admin (server-side version)
 */
export const isAdminServer = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;

  // Check against centralized admin emails from environment
  const adminEmails = getAdminEmails();
  if (adminEmails.includes(userEmail)) {
    return true;
  }

  // In development, all authenticated users are admins
  const env = getEnvironmentType();
  if (env === 'development') {
    return true;
  }

  return false;
};

/**
 * Get user email from session cookie
 * This avoids using firebase-admin auth which causes jose dependency issues in Vercel
 */
function getEmailFromSessionCookie(request: NextRequest): string | null {
  const simpleSessionCookie = request.cookies.get('simpleUserSession')?.value;
  if (!simpleSessionCookie) return null;

  try {
    const sessionData = JSON.parse(simpleSessionCookie);
    return sessionData?.email || null;
  } catch {
    return null;
  }
}

/**
 * Check admin permissions for API requests
 * Uses session cookie to get email - avoids firebase-admin auth (jose issues)
 */
export async function checkAdminPermissions(request: NextRequest): Promise<{success: boolean, error?: string, userEmail?: string}> {
  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return { success: false, error: 'Unauthorized - no user ID' };
    }

    // Check if userId is in the admin user IDs list
    const adminUserIds = getAdminUserIds();
    if (adminUserIds.includes(userId)) {
      console.log('🔐 [ADMIN AUTH] Admin access granted by user ID');
      // Get email from session if available
      const userEmail = getEmailFromSessionCookie(request);
      return { success: true, userEmail: userEmail || undefined };
    }

    // Get user email from session cookie (already verified when session was created)
    const userEmail = getEmailFromSessionCookie(request);

    if (!userEmail) {
      // In development, allow access even without email
      const env = getEnvironmentType();
      if (env === 'development') {
        console.log('🔧 [DEV MODE] Allowing admin access without email in development');
        return { success: true, userEmail: undefined };
      }
      return { success: false, error: 'Unauthorized - no email in session' };
    }

    // Check if user is admin
    if (!isAdminServer(userEmail)) {
      return { success: false, error: 'Admin access required' };
    }

    return { success: true, userEmail };
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return { success: false, error: 'Authentication error' };
  }
}
