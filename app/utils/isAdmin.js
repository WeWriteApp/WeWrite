// Define admin user IDs
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
  return ADMIN_USER_IDS.includes(userEmail);
};