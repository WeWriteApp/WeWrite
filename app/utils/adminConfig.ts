/**
 * Centralized Admin Configuration
 *
 * SINGLE SOURCE OF TRUTH for admin users in WeWrite.
 * All admin checks across the codebase should import from this file.
 *
 * Admin lists are loaded from environment variables:
 * - ADMIN_EMAILS: Comma-separated list of admin email addresses
 * - ADMIN_USER_IDS: Comma-separated list of Firebase Auth UIDs (optional fallback)
 *
 * SECURITY NOTES:
 * - Never commit actual admin emails/UIDs to git
 * - Set these in Vercel environment variables for production
 * - Set these in .env.local for local development (gitignored)
 */

import { getEnvironmentType } from './environmentConfig';

/**
 * Parse comma-separated environment variable into array
 */
function parseEnvList(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Get admin emails from environment variable
 * Falls back to empty array if not configured (fail-secure)
 */
export function getAdminEmails(): string[] {
  return parseEnvList(process.env.ADMIN_EMAILS);
}

/**
 * Get admin user IDs from environment variable
 * Falls back to empty array if not configured (fail-secure)
 */
export function getAdminUserIds(): string[] {
  return parseEnvList(process.env.ADMIN_USER_IDS);
}

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email);
}

/**
 * Check if a user ID is in the admin list
 */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const adminUserIds = getAdminUserIds();
  return adminUserIds.includes(userId);
}

/**
 * Check if a user is a production admin
 * Returns true only if the user's email is in ADMIN_EMAILS
 * This should be used for any operation that accesses production data
 */
export function isProductionAdmin(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}

/**
 * Check if user has admin access in the current environment
 *
 * In development: ALL users are admins (but only for DEV_ collections)
 * In production: Only users in ADMIN_EMAILS have admin access
 *
 * @param email - User's email address
 * @param userId - User's Firebase Auth UID (optional fallback)
 */
export function hasAdminAccess(
  email: string | null | undefined,
  userId?: string | null
): boolean {
  // Check by email first (primary method)
  if (isAdminEmail(email)) {
    return true;
  }

  // Check by user ID (fallback)
  if (isAdminUserId(userId)) {
    return true;
  }

  // In development, all authenticated users get admin access
  // They can only access DEV_ collections anyway
  const env = getEnvironmentType();
  if (env === 'development') {
    return true;
  }

  return false;
}

/**
 * Log admin configuration for debugging (sanitized)
 * Only logs count and first few characters of emails
 */
export function logAdminConfig(): void {
  const emails = getAdminEmails();
  const userIds = getAdminUserIds();

  console.log('[ADMIN CONFIG]', {
    emailCount: emails.length,
    userIdCount: userIds.length,
    environment: getEnvironmentType(),
    // Show sanitized preview (first 3 chars of each)
    emailPreviews: emails.map(e => e.substring(0, 3) + '***'),
  });
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
