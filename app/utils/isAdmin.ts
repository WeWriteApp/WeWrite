// Define admin user IDs - ONLY these emails have admin access
// SECURITY: This must match the ADMIN_EMAILS list in adminSecurity.ts
const ADMIN_USER_IDS: string[] = [
  'jamiegray2234@gmail.com',
  'jamie@wewrite.app',
  'test1@wewrite.dev', // Current dev session email - REMOVE IN PRODUCTION
  'test2@wewrite.dev', // Dev admin: testuser2
  'admin.test@wewrite.app', // Secure admin test account for production data access
];

/**
 * Check if a user is an admin
 */
export const isAdmin = (userEmail: string | null | undefined): boolean => {
  if (!userEmail) return false;

  // Only the specific admin user has access
  return ADMIN_USER_IDS.includes(userEmail);
};
