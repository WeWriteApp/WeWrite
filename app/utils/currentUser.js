/**
 * Current User Utility
 * 
 * This is the single source of truth for the current user in the application.
 * It overrides all other auth mechanisms and provides a simple way to get and set
 * the current user regardless of Firebase auth state.
 */

import Cookies from 'js-cookie';

// Get the current user from the cookie
export const getCurrentUser = () => {
  try {
    const userSessionCookie = Cookies.get('userSession');
    if (userSessionCookie) {
      return JSON.parse(userSessionCookie);
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }
  return null;
};

// Set the current user in the cookie
export const setCurrentUser = (user) => {
  if (!user) {
    Cookies.remove('userSession');
    Cookies.remove('authenticated');
    return;
  }
  
  // Set the authenticated cookie
  Cookies.set('authenticated', 'true', { expires: 7 });
  
  // Set the user session cookie
  Cookies.set('userSession', JSON.stringify({
    uid: user.uid,
    email: user.email,
    username: user.username || user.displayName,
    displayName: user.displayName,
    // Add any other necessary properties
  }), { expires: 7 });
  
  // Update saved accounts to ensure only this one is current
  try {
    const savedAccountsJson = localStorage.getItem('savedAccounts');
    if (savedAccountsJson) {
      const savedAccounts = JSON.parse(savedAccountsJson);
      const updatedAccounts = savedAccounts.map(account => ({
        ...account,
        isCurrent: account.uid === user.uid
      }));
      localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));
    }
  } catch (error) {
    console.error('Error updating saved accounts:', error);
  }
};

// Check if the user is authenticated
export const isAuthenticated = () => {
  return !!getCurrentUser() || Cookies.get('authenticated') === 'true';
};
