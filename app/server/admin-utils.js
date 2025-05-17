/**
 * Server-side admin utilities
 * 
 * This file contains server-side functions for checking admin status
 * and feature flags. These functions are safe to use in middleware
 * and other server components.
 */

// Define default admin user IDs (fallback if database check fails)
const DEFAULT_ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
];

/**
 * Server-side function to check if a user is in the default admin list
 * This is safe to use in middleware and other server components
 * 
 * @param {string} userEmail - The user's email
 * @returns {boolean} - Whether the user is in the default admin list
 */
export function isServerDefaultAdmin(userEmail) {
  if (!userEmail) return false;
  return DEFAULT_ADMIN_USER_IDS.includes(userEmail);
}
