/**
 * Account utility functions
 * 
 * Shared utilities for account management to avoid circular dependencies
 */

/**
 * Clear a user from the logged-out accounts list when they log back in
 * This function was moved here to break circular dependency between
 * AuthProvider and AccountSwitcher
 */
export function clearLoggedOutAccount(accountUid: string): void {
  try {
    const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
    if (loggedOutAccounts) {
      const loggedOutAccountsSet = new Set(JSON.parse(loggedOutAccounts));
      if (loggedOutAccountsSet.has(accountUid)) {
        loggedOutAccountsSet.delete(accountUid);
        localStorage.setItem('loggedOutAccounts', JSON.stringify([...loggedOutAccountsSet]));
        console.log('Cleared logged-out status for account:', accountUid);
      }
    }
  } catch (error) {
    console.error('Error clearing logged-out account status:', error);
  }
}

/**
 * Get logged out account from localStorage
 */
export function getLoggedOutAccount(): any {
  try {
    const stored = localStorage.getItem('loggedOutAccount');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to get logged out account from localStorage:', error);
    return null;
  }
}

/**
 * Set logged out account in localStorage
 */
export function setLoggedOutAccount(account: any): void {
  try {
    localStorage.setItem('loggedOutAccount', JSON.stringify(account));
  } catch (error) {
    console.warn('Failed to set logged out account in localStorage:', error);
  }
}

/**
 * Check if an account was explicitly logged out
 */
export function isAccountLoggedOut(accountUid: string): boolean {
  try {
    const loggedOutAccounts = localStorage.getItem('loggedOutAccounts');
    if (loggedOutAccounts) {
      const loggedOutAccountsSet = new Set(JSON.parse(loggedOutAccounts));
      return loggedOutAccountsSet.has(accountUid);
    }
  } catch (error) {
    console.error('Error checking logged-out account status:', error);
  }
  return false;
}