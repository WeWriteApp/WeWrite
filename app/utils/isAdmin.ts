/**
 * Admin Check Utilities
 *
 * Uses centralized admin configuration from adminConfig.ts
 * All admin emails/UIDs are loaded from environment variables.
 */

import { getEnvironmentType } from './environmentConfig';
import { isAdminEmail, isProductionAdmin as isProductionAdminConfig } from './adminConfig';

/**
 * Check if a user is an admin
 *
 * In development: ALL users are admins (but only for dev collections)
 * In production: Only admin emails from ADMIN_EMAILS env var have access
 */
export const isAdmin = (userEmail: string | null | undefined): boolean => {
  if (!userEmail) return false;

  // Production admins always have access
  if (isAdminEmail(userEmail)) {
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
  return isProductionAdminConfig(userEmail);
};
