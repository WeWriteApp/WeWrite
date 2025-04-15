/**
 * AuthManager - A robust utility for managing authentication and account switching
 * 
 * This utility provides a centralized way to manage authentication state and
 * account switching without directly accessing tokens or cookies, which can
 * trigger security measures in browser extensions.
 */

import { auth } from '../firebase/auth';
import { signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import Cookies from 'js-cookie';

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
 * @returns {Array} Array of saved accounts
 */
export const getSavedAccounts = () => {
  try {
    const accountsJson = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (accountsJson) {
      return JSON.parse(accountsJson);
    }
  } catch (error) {
    console.error('Error getting saved accounts:', error);
  }
  return [];
};

/**
 * Save an account to local storage
 * @param {Object} account Account data to save
 */
export const saveAccount = (account) => {
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
 * @param {Object} account Account to set as current
 */
export const setCurrentAccount = (account) => {
  if (!account) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ACCOUNT);
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ACCOUNT, JSON.stringify(account));
    
    // Set auth state
    localStorage.setItem(STORAGE_KEYS.AUTH_STATE, 'authenticated');
    
    // Set cookie for server-side auth
    Cookies.set('authenticated', 'true', { expires: 7 });
    Cookies.set('userSession', JSON.stringify({
      uid: account.uid,
      email: account.email,
      username: account.username || account.displayName,
      displayName: account.displayName || account.username
    }), { expires: 7 });
  } catch (error) {
    console.error('Error setting current account:', error);
  }
};

/**
 * Get the current account
 * @returns {Object|null} Current account or null
 */
export const getCurrentAccount = () => {
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
 * @returns {boolean} True if authenticated
 */
export const isAuthenticated = () => {
  return !!auth.currentUser || 
         !!getCurrentAccount() || 
         localStorage.getItem(STORAGE_KEYS.AUTH_STATE) === 'authenticated' ||
         Cookies.get('authenticated') === 'true';
};

/**
 * Switch to a different account
 * @param {Object} account Account to switch to
 * @returns {Promise} Promise that resolves when the switch is complete
 */
export const switchToAccount = async (account) => {
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
 * @param {boolean} keepAccounts Whether to keep saved accounts
 * @returns {Promise} Promise that resolves when sign out is complete
 */
export const signOutUser = async (keepAccounts = true) => {
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
 * @param {string} uid User ID to remove
 */
export const removeAccount = (uid) => {
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
