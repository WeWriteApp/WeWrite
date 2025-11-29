/**
 * Admin Authentication Helper
 * Provides authentication and authorization utilities for admin API endpoints
 */

import { NextRequest } from 'next/server';
import { getUserIdFromRequest } from './auth-helper';
import { getFirebaseAdmin } from '../firebase/admin';

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
 * Check admin permissions for API requests
 */
export async function checkAdminPermissions(request: NextRequest): Promise<{success: boolean, error?: string, userEmail?: string}> {
  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return { success: false, error: 'Unauthorized - no user ID' };
    }

    // For development, allow dev_admin_user to bypass Firebase Admin check
    if (userId === 'dev_admin_user' || userId === 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N') {
      console.log('🔧 DEV MODE: Allowing dev_admin_user admin access');
      return { success: true, userEmail: 'jamie@wewrite.app' };
    }

    // Get user email using Firebase Admin SDK
    const admin = getFirebaseAdmin();
    const adminAuth = admin.auth();
    const userRecord = await adminAuth.getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail) {
      return { success: false, error: 'Unauthorized - no email found' };
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
