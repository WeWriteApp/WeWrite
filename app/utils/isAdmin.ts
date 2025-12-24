/**
 * Admin Check Utilities
 *
 * @deprecated This file is kept for backwards compatibility only.
 * Admin checks should use the session's isAdmin flag which is set by
 * /api/auth/session using Firebase Custom Claims + Firestore isAdmin field.
 *
 * In development: ALL users are admins (but only for dev collections)
 * In production: Admin status is determined by Firebase Custom Claims or Firestore isAdmin field
 */

import { getEnvironmentType } from './environmentConfig';

/**
 * Check if a user is an admin based on development environment only.
 *
 * @deprecated Use the session's isAdmin flag instead. This function only
 * returns true in development for local testing convenience.
 *
 * In production, always returns false - admin status is determined by:
 * 1. Firebase Custom Claims (admin: true)
 * 2. Firestore user document (isAdmin: true)
 */
export const isAdmin = (_userEmail: string | null | undefined): boolean => {
  // In development, ALL users are admins (but scoped to DEV_ collections)
  const envType = getEnvironmentType();
  if (envType === 'development') {
    return true;
  }

  // In production, admin is determined by Firebase Custom Claims or Firestore
  // This function should NOT be the source of truth for production admin checks
  return false;
};

/**
 * @deprecated Use Firebase Custom Claims or Firestore isAdmin field instead.
 * This always returns false in production.
 */
export const isProductionAdmin = (_userEmail: string | null | undefined): boolean => {
  return false;
};
