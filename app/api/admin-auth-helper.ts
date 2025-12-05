/**
 * Admin Authentication Helper
 * Provides authentication and authorization utilities for admin API endpoints
 * 
 * NOTE: This helper avoids using firebase-admin Auth operations to prevent jose dependency
 * issues in Vercel serverless. Instead, we read email from session cookies which were
 * verified when the session was created.
 */

import { NextRequest } from 'next/server';
import { getUserIdFromRequest } from './auth-helper';

// Define admin user IDs - ONLY these emails have admin access
// Keep this list in sync with app/utils/isAdmin.ts to avoid mismatched UX/API behavior.
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
  'admin.test@wewrite.app', // Secure admin test account for production data access
  'jamie@wewrite.app', // Development admin user
  'admin@local.dev', // Local development admin user
  'test1@wewrite.dev', // Dev admin (UX already shows admin for this account)
  'test2@wewrite.dev' // Dev admin: testuser2
];

/**
 * Check if a user is an admin (server-side version)
 */
export const isAdminServer = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
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

    // For development, allow dev_admin_user to bypass
    if (userId === 'dev_admin_user' || userId === 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N') {
      console.log('🔧 DEV MODE: Allowing dev_admin_user admin access');
      return { success: true, userEmail: 'jamie@wewrite.app' };
    }

    // Get user email from session cookie (already verified when session was created)
    const userEmail = getEmailFromSessionCookie(request);

    if (!userEmail) {
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
