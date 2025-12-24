/**
 * Admin Configuration
 *
 * @deprecated This file is mostly deprecated. Admin access is now controlled by:
 * 1. Firebase Custom Claims (admin: true) - most secure
 * 2. Firestore user document (isAdmin: true) - database-backed
 *
 * The session's isAdmin flag (set by /api/auth/session) should be the source of truth.
 *
 * Environment variable approach (ADMIN_EMAILS) has been removed for better security.
 * To make someone an admin:
 * - Set isAdmin: true on their Firestore user document, OR
 * - Use /api/admin/claims to set Firebase Custom Claims
 */

import { getEnvironmentType } from './environmentConfig';

/**
 * @deprecated No longer uses ADMIN_EMAILS env var.
 * Returns empty array - admin status is now in Firestore/Custom Claims.
 */
export function getAdminEmails(): string[] {
  return [];
}

/**
 * @deprecated No longer uses ADMIN_USER_IDS env var.
 * Returns empty array - admin status is now in Firestore/Custom Claims.
 */
export function getAdminUserIds(): string[] {
  return [];
}

/**
 * @deprecated Always returns false in production.
 * Admin status is determined by Firebase Custom Claims or Firestore isAdmin field.
 */
export function isAdminEmail(_email: string | null | undefined): boolean {
  return false;
}

/**
 * @deprecated Always returns false.
 * Admin status is determined by Firebase Custom Claims or Firestore isAdmin field.
 */
export function isAdminUserId(_userId: string | null | undefined): boolean {
  return false;
}

/**
 * @deprecated Always returns false in production.
 * Use the session's isAdmin flag instead.
 */
export function isProductionAdmin(_email: string | null | undefined): boolean {
  return false;
}

/**
 * Check if user has admin access in the current environment
 *
 * @deprecated Use the session's isAdmin flag instead.
 * This only returns true in development for local testing.
 *
 * In development: ALL users are admins (but only for DEV_ collections)
 * In production: Returns false - admin status is in session cookie
 */
export function hasAdminAccess(
  _email: string | null | undefined,
  _userId?: string | null
): boolean {
  // In development, all authenticated users get admin access
  // They can only access DEV_ collections anyway
  const env = getEnvironmentType();
  if (env === 'development') {
    return true;
  }

  return false;
}

/**
 * @deprecated No-op function, config logging removed.
 */
export function logAdminConfig(): void {
  console.log('[ADMIN CONFIG] Admin access is now determined by Firebase Custom Claims and Firestore isAdmin field');
}

/**
 * Check if a decoded ID token has the admin custom claim
 * This is the most secure method as claims are cryptographically signed
 *
 * @param decodedToken - The decoded Firebase ID token
 * @returns true if the token has admin: true custom claim
 */
export function hasAdminCustomClaim(decodedToken: { admin?: boolean } | null): boolean {
  if (!decodedToken) return false;
  return decodedToken.admin === true;
}
