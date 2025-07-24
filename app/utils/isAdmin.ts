// Define admin user IDs - ONLY these emails have admin access
const ADMIN_USER_IDS: string[] = [
  'jamiegray2234@gmail.com',
  'admin.test@wewrite.app', // Secure admin test account for production data access
  'jamie@wewrite.app', // Development admin user
];

/**
 * Check if a user is an admin
 */
export const isAdmin = (userEmail: string | null | undefined): boolean => {
  if (!userEmail) return false;

  // Only the specific admin user has access
  return ADMIN_USER_IDS.includes(userEmail);
};