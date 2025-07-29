/**
 * DEPRECATED: Current User Utility
 *
 * ⚠️ WARNING: This file contains old auth patterns and should be replaced
 * with the new simplified auth system using useAuth() hook.
 *
 * NEW PATTERN:
 * import { useAuth } from '../providers/AuthProvider';
 * const { user, isAuthenticated } = useAuth();
 *
 * This utility is kept for backward compatibility during migration.
 * All new code should use the AuthProvider instead.
 */

import { auth } from "../firebase/auth";

// DEPRECATED: Use User type from types/auth.ts instead
interface UserData {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  emailVerified?: boolean;
  [key: string]: any;
}

/**
 * DEPRECATED: Get current user from Firebase Auth only
 *
 * This function has been simplified to only check Firebase Auth.
 * The complex multi-source checking has been removed in favor of
 * the new AuthProvider system.
 *
 * @deprecated Use useAuth() hook instead
 */
export const getCurrentUser = (): UserData | null => {
  try {
    // Only check Firebase auth - all other sources removed
    if (auth.currentUser) {
      return {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        username: auth.currentUser.displayName || undefined,
        displayName: auth.currentUser.displayName || undefined,
        photoURL: auth.currentUser.photoURL || undefined,
        emailVerified: auth.currentUser.emailVerified || false
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * DEPRECATED: Set current user
 *
 * @deprecated This function is deprecated. The new AuthProvider
 * handles all user state management automatically.
 */
export const setCurrentUser = (user: UserData | null): void => {
  console.warn('setCurrentUser is deprecated. Use AuthProvider instead.');
  // No-op - AuthProvider handles user state
};

/**
 * DEPRECATED: Check if user is authenticated
 *
 * @deprecated Use useAuth() hook instead: const { isAuthenticated } = useAuth();
 */
export const isAuthenticated = (): boolean => {
  console.warn('isAuthenticated is deprecated. Use useAuth() hook instead.');
  // Simplified check - only Firebase auth
  return !!auth.currentUser;
};

/**
 * DEPRECATED: Get current user's auth token
 *
 * @deprecated Use the AuthProvider and environment-aware API system instead.
 * All API calls should go through the proper API endpoints.
 */
export const getCurrentUserToken = async (): Promise<string> => {
  console.warn('getCurrentUserToken is deprecated. Use environment-aware API system instead.');

  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken(true);
    }
  } catch (error) {
    console.error('Error getting Firebase token:', error);
  }

  return '';
};