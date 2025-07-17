// Define admin user IDs - ONLY jamiegray2234@gmail.com has admin access
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
];

/**
 * Check if a user is an admin
 * @param {string} userEmail - The user's email address
 * @returns {boolean} - Whether the user is an admin
 */
export const isAdmin = (userEmail) => {
  if (!userEmail) return false;

  // Only the specific admin user has access
  return ADMIN_USER_IDS.includes(userEmail);
};