// Server-side version of feature flag utilities
// This file should NOT have "use client" directive

// Define admin user IDs
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
];

/**
 * Check if a user is an admin (server-side version)
 * @param userEmail - The user's email
 * @returns boolean indicating if the user is an admin
 */
export const isAdminServer = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
};
