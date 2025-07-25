/**
 * Current User Utility
 *
 * This is the single source of truth for the current user in the application.
 * It overrides all other auth mechanisms and provides a simple way to get and set
 * the current user regardless of Firebase auth state.
 */

import Cookies from 'js-cookie';
import { auth } from "../firebase/auth";

// Types
interface UserData {
  uid: string;
  email: string;
  username?: string;
  authToken?: string;
  isFirebaseUser?: boolean;
  isCurrent?: boolean;
  [key: string]: any;
}

interface AuthCheckResult {
  firebaseAuth: boolean;
  sessionUser: boolean;
  authenticatedCookie: boolean;
  wewriteAuthenticatedCookie: boolean;
  sessionCookie: boolean;
  wewriteUserIdCookie: boolean;
  hasWewriteAccounts: boolean;
}

// Get the current user from all possible sources
export const getCurrentUser = (): UserData | null => {
  try {
    // First check if we have a Firebase auth user
    if (auth.currentUser) {
      return {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        // SECURITY: Never use displayName as username fallback - could contain email
        username: auth.currentUser.displayName?.includes('@') ? "Missing username" : auth.currentUser.displayName,
        displayName: auth.currentUser.displayName?.includes('@') ? "Missing username" : auth.currentUser.displayName,
        // This is a Firebase auth user
        isFirebaseUser: true
      };
    }

    // Check for our new wewrite cookies
    const wewriteUserId = Cookies.get('wewrite_user_id');
    if (wewriteUserId && typeof window !== 'undefined') {
      // Try to get account data from sessionStorage
      const accountsJson = sessionStorage.getItem('wewrite_accounts');
      if (accountsJson) {
        try {
          const accounts = JSON.parse(accountsJson);
          const account = accounts.find(acc => acc.uid === wewriteUserId);
          if (account) {
            return account;
          }
        } catch (e) {
          console.error('Error parsing wewrite_accounts data:', e);
        }
      }
    }

    // If no Firebase auth user, check for session cookie
    const userSessionCookie = Cookies.get('userSession');
    if (userSessionCookie) {
      try {
        const userData = JSON.parse(userSessionCookie);
        return userData;
      } catch (e) {
        console.error('Error parsing user account cookie:', e);
      }
    }

    // If no session cookie, check localStorage (browser only)
    if (typeof window !== 'undefined') {
      const switchToAccount = localStorage.getItem('switchToAccount');
      if (switchToAccount) {
        try {
          const accountData = JSON.parse(switchToAccount);
          return accountData;
        } catch (e) {
          console.error('Error parsing switchToAccount data:', e);
        }
      }

      // Last resort: check for previous user account
      const previousUserSession = localStorage.getItem('previousUserSession');
      if (previousUserSession) {
        try {
          const sessionData = JSON.parse(previousUserSession);
          return sessionData;
        } catch (e) {
          console.error('Error parsing previousUserSession data:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }

  return null;
};

// Set the current user in all storage mechanisms
export const setCurrentUser = (user: UserData | null): void => {
  if (!session) {
    Cookies.remove('userSession');
    Cookies.remove('authenticated');
    Cookies.remove('session'); // Remove Firebase auth token
    if (typeof window !== 'undefined') {
      localStorage.removeItem('switchToAccount');
      localStorage.removeItem('accountSwitchInProgress');
    }
    return;
  }

  // Set the authenticated cookie
  Cookies.set('authenticated', 'true', { expires: 7 });

  // Clean up the user object to ensure it's serializable
  const cleanUser = {
    uid: session.uid,
    email: session.email,
    username: session.username || session.displayName,
    displayName: session.displayName || session.username,
    // Include the auth token if available
    authToken: user.authToken || Cookies.get('session'),
    // Add any other necessary properties from the user object
    ...user
  };

  // Remove any circular references or functions
  delete cleanUser.getIdToken;
  delete cleanUser.reload;
  delete cleanUser.toJSON;
  delete cleanUser.providerData;
  delete cleanUser.metadata;

  // Set the user account cookie
  Cookies.set('userSession', JSON.stringify(cleanUser), { expires: 7 });

  // We'll no longer try to set the auth token directly to avoid browser extension issues
  // Instead, we'll just set the authenticated cookie
  Cookies.set('authenticated', 'true', { expires: 7 });

  // Update saved accounts to ensure only this one is current (browser only)
  if (typeof window !== 'undefined') {
    try {
      const savedAccountsJson = localStorage.getItem('savedAccounts');
      if (savedAccountsJson) {
        const savedAccounts = JSON.parse(savedAccountsJson);

        // Check if this account already exists
        const existingAccountIndex = savedAccounts.findIndex(account => account.uid === cleanUser.uid);

        if (existingAccountIndex >= 0) {
          // Update existing account
          savedAccounts[existingAccountIndex] = {
            ...savedAccounts[existingAccountIndex],
            ...cleanUser,
            isCurrent: true
          };
        } else {
          // Add new account
          savedAccounts.push({
            ...cleanUser,
            isCurrent: true
          });
        }

        // Update all other accounts to not be current
        const updatedAccounts = savedAccounts.map(account => ({
          ...account,
          isCurrent: account.uid === cleanUser.uid
        }));

        localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
      } else {
        // No saved accounts yet, create initial array
        localStorage.setItem('savedAccounts', JSON.stringify([{
          ...cleanUser,
          isCurrent: true
        }]));
      }
    } catch (error) {
      console.error('Error updating saved accounts:', error);
    }
  }
};

// Check if the user is authenticated
export const isAuthenticated = (): boolean => {
  // Check multiple sources for authentication
  const firebaseAuth = !!auth.currentUser;
  const sessionUser = !!getCurrentUser();
  const authenticatedCookie = Cookies.get('authenticated') === 'true';
  const wewriteAuthenticatedCookie = Cookies.get('wewrite_authenticated') === 'true';
  const sessionCookie = !!Cookies.get('session');
  const wewriteUserIdCookie = !!Cookies.get('wewrite_user_id');
  const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');

  return firebaseAuth ||
         sessionUser ||
         authenticatedCookie ||
         wewriteAuthenticatedCookie ||
         sessionCookie ||
         wewriteUserIdCookie;
};

// Get the current user's auth token
export const getCurrentUserToken = async (): Promise<string> => {
  try {
    // First check if we have a Firebase auth user
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(true);
        return token;
      } catch (e) {
        console.error('Error getting Firebase token:', e);
        // Don't try to access other token sources if this fails
        // as it might trigger browser extension security measures
      }
    } else {
      // If we don't have a Firebase auth user, we'll use session-based auth
      // This avoids trying to access tokens directly which can trigger browser extension security measures
      // Return a placeholder token to indicate we're using session-based auth
      return 'session-auth';
    }
  } catch (error) {
    console.error('Error getting current user token:', error);
  }

  // Return a placeholder token to indicate we're using session-based auth
  return "session-auth";
};