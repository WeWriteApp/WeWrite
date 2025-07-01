/**
 * Admin Authentication Helper
 * Provides authentication and authorization utilities for admin API endpoints
 */

import { getUserIdFromRequest } from './auth-helper';
import { getFirebaseAdmin } from '../firebase/firebaseAdmin';

// Define admin user IDs
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
  'patrick@mailfischer.com',
  'skyler99ireland@gmail.com',
  'diamatryistmatov@gmail.com',
  'josiahsparrow@gmail.com'
];

/**
 * Check if a user is an admin (server-side version)
 * @param {string} userEmail - The user's email
 * @returns {boolean} - Whether the user is an admin
 */
export const isAdminServer = (userEmail) => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
};

/**
 * Check admin permissions for API requests
 * @param {NextRequest} request - The Next.js request object
 * @returns {Promise<{success: boolean, error?: string, userEmail?: string}>} - Auth result
 */
export async function checkAdminPermissions(request) {
  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return { success: false, error: 'Unauthorized - no user ID' };
    }

    // Get user email using Firebase Admin SDK
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUser(userId);
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