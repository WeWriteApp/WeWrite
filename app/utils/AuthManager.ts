/**
 * AuthManager - A robust utility for managing authentication and account switching
 *
 * This utility provides a centralized way to manage authentication state and
 * account switching without directly accessing tokens or cookies, which can
 * trigger security measures in browser extensions.
 */

import { auth } from "../firebase/auth";
import { signOut, setPersistence, browserLocalPersistence, User } from 'firebase/auth';
import Cookies from 'js-cookie';

// Type definitions
export interface SavedAccount {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  lastLogin?: string;
  isFirebaseUser?: boolean;
}

export interface AuthResult {
  success: boolean;
  error?: any;
}

// Constants for storage keys
const STORAGE_KEYS = {
  ACCOUNTS: 'wewrite_accounts',
  CURRENT_ACCOUNT: 'wewrite_current_account',
  AUTH_STATE: 'wewrite_auth_state'
};

// Initialize persistence to local
try {
  setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.error('Error setting persistence:', error);
}

/**
 * Get all saved accounts
 */
export const getSavedAccounts = (): SavedAccount[] => {
  try {
    const accountsJson = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (accountsJson) {
      return JSON.parse(accountsJson) as SavedAccount[];
    }
  } catch (error) {
    console.error('Error getting saved accounts:', error);
  }
  return [];
};

/**
 * Save an account to local storage
 */
export const saveAccount = (account: Partial<SavedAccount>): void => {
  if (!account || !account.uid) return;

  try {
    // Get existing accounts
    const accounts = getSavedAccounts();

    // Check if account already exists
    const existingIndex = accounts.findIndex(a => a.uid === account.uid);

    // Clean up the account object
    const cleanAccount = {
      uid: account.uid,
      email: account.email,
      username: account.username || account.displayName,
      displayName: account.displayName || account.username,
      lastLogin: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Update existing account
      accounts[existingIndex] = {
        ...accounts[existingIndex],
        ...cleanAccount
      };
    } else {
      // Add new account
      accounts.push(cleanAccount);
    }

    // Save accounts
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));

    // Set as current account
    setCurrentAccount(cleanAccount);
  } catch (error) {
    console.error('Error saving account:', error);
  }
};

/**
 * Set the current active account
 */
export const setCurrentAccount = (account: SavedAccount | null): void => {
  if (!account) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ACCOUNT);
    return;
  }

  try {
    // SECURITY FIX: Validate account object before setting
    if (!account.uid || !account.email) {
      console.error('Invalid account object - missing required fields');
      return;
    }

    // SECURITY FIX: Sanitize account data
    const sanitizedAccount = {
      uid: account.uid,
      email: account.email,
      username: account.username || account.displayName || '',
      displayName: account.displayName || account.username || '',
      // Only include safe, validated properties
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_ACCOUNT, JSON.stringify(sanitizedAccount));

    // Set auth state
    localStorage.setItem(STORAGE_KEYS.AUTH_STATE, 'authenticated');

    // Set cookie for server-side auth with secure flags
    Cookies.set('authenticated', 'true', {
      expires: 7,
      secure: window.location.protocol === 'https:',
      sameSite: 'strict'
    });
    Cookies.set('userSession', JSON.stringify({
      uid: sanitizedAccount.uid,
      email: sanitizedAccount.email,
      username: sanitizedAccount.username,
      displayName: sanitizedAccount.displayName
    }), {
      expires: 7,
      secure: window.location.protocol === 'https:',
      sameSite: "strict"
    });
  } catch (error) {
    console.error('Error setting current account:', error);
  }
};

/**
 * Get the current account
 */
export const getCurrentAccount = (): SavedAccount | null => {
  // First check Firebase auth
  if (auth.currentUser) {
    const firebaseUser = {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      username: auth.currentUser.displayName,
      displayName: auth.currentUser.displayName,
      isFirebaseUser: true
    };

    // Update saved account with latest data
    saveAccount(firebaseUser);

    return firebaseUser;
  }

  // Then check local storage
  try {
    const accountJson = localStorage.getItem(STORAGE_KEYS.CURRENT_ACCOUNT);
    if (accountJson) {
      return JSON.parse(accountJson);
    }
  } catch (error) {
    console.error('Error getting current account:', error);
  }

  return null;
};

/**
 * Check if the user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser ||
         !!getCurrentAccount() ||
         localStorage.getItem(STORAGE_KEYS.AUTH_STATE) === 'authenticated' ||
         Cookies.get('authenticated') === 'true';
};

/**
 * Switch to a different account
 */
export const switchToAccount = async (account: SavedAccount): Promise<SavedAccount> => {
  if (!account || !account.uid) {
    throw new Error('Invalid account');
  }

  try {
    // First sign out from Firebase
    if (auth.currentUser) {
      await signOut(auth);
    }

    // Set the new account as current
    setCurrentAccount(account);

    // Set a flag for the account switch
    sessionStorage.setItem('accountSwitch', 'true');

    // Return the account for chaining
    return account;
  } catch (error) {
    console.error('Error switching account:', error);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (keepAccounts: boolean = true): Promise<AuthResult> => {
  try {
    // Sign out from Firebase
    await signOut(auth);

    // Clear current account
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ACCOUNT);

    // Clear auth state
    localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);

    // Clear cookies
    Cookies.remove('authenticated');
    Cookies.remove('userSession');

    // Optionally clear saved accounts
    if (!keepAccounts) {
      localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    }

    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error };
  }
};

/**
 * Remove an account from saved accounts
 */
export const removeAccount = (uid: string): void => {
  if (!uid) return;

  try {
    const accounts = getSavedAccounts();
    const filteredAccounts = accounts.filter(account => account.uid !== uid);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(filteredAccounts));

    // If this was the current account, clear it
    const currentAccount = getCurrentAccount();
    if (currentAccount && currentAccount.uid === uid) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ACCOUNT);
      localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
    }
  } catch (error) {
    console.error('Error removing account:', error);
  }
};

// Export a default object for easier imports
export default {
  getSavedAccounts,
  saveAccount,
  getCurrentAccount,
  setCurrentAccount,
  isAuthenticated,
  switchToAccount,
  signOutUser,
  removeAccount
};
