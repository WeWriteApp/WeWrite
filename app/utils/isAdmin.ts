import { getEnvironmentType } from './environmentConfig';

// Define admin user IDs - ONLY these emails have admin access in production
// SECURITY: This must match the ADMIN_EMAILS list in adminSecurity.ts
const PRODUCTION_ADMIN_EMAILS: string[] = [
  'jamiegray2234@gmail.com',
  'jamie@wewrite.app',
  'admin.test@wewrite.app', // Secure admin test account for production data access
];

/**
 * Check if a user is an admin
 * 
 * In development: ALL users are admins (but only for dev collections)
 * In production: Only production admin emails have admin access
 * 
 * This allows easy testing of admin features during development
 * without needing to manually configure each test account.
 */
export const isAdmin = (userEmail: string | null | undefined): boolean => {
  if (!userEmail) return false;

  // Production admins always have access
  if (PRODUCTION_ADMIN_EMAILS.includes(userEmail)) {
    return true;
  }

  // In development, ALL users are admins (but scoped to DEV_ collections)
  const envType = getEnvironmentType();
  if (envType === 'development') {
    return true;
  }

  return false;
};

/**
 * Check if user is a production admin (has access to production data)
 * Use this for any admin operation that touches production collections
 */
export const isProductionAdmin = (userEmail: string | null | undefined): boolean => {
  if (!userEmail) return false;
  return PRODUCTION_ADMIN_EMAILS.includes(userEmail);
};
