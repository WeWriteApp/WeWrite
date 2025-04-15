/**
 * Current User Utility
 *
 * This is the single source of truth for the current user in the application.
 * It overrides all other auth mechanisms and provides a simple way to get and set
 * the current user regardless of Firebase auth state.
 */

import Cookies from 'js-cookie';
import { auth } from '../firebase/auth';

// Get the current user from the cookie
export const getCurrentUser = () => {
  try {
    // First check if we have a Firebase auth user
    if (auth.currentUser) {
      return {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        username: auth.currentUser.displayName,
        displayName: auth.currentUser.displayName,
        // This is a Firebase auth user
        isFirebaseUser: true
      };
    }

    // If no Firebase auth user, check for session cookie
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
    Cookies.remove('session'); // Remove Firebase auth token
    return;
  }

  // Set the authenticated cookie
  Cookies.set('authenticated', 'true', { expires: 7 });

  // Set the user session cookie with all available properties
  Cookies.set('userSession', JSON.stringify({
    uid: user.uid,
    email: user.email,
    username: user.username || user.displayName,
    displayName: user.displayName,
    // Include the auth token if available
    authToken: user.authToken || Cookies.get('session'),
    // Add any other necessary properties from the user object
    ...user
  }), { expires: 7 });

  // If we have an auth token, set it as a session cookie
  if (user.authToken) {
    Cookies.set('session', user.authToken, { expires: 7 });
  }

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
  // Check multiple sources for authentication
  return !!auth.currentUser || !!getCurrentUser() || Cookies.get('authenticated') === 'true' || !!Cookies.get('session');
};

// Get the current user's auth token
export const getCurrentUserToken = () => {
  try {
    // First check if we have a Firebase auth user
    if (auth.currentUser) {
      return auth.currentUser.getIdToken();
    }

    // If no Firebase auth user, check for session cookie
    return Cookies.get('session');
  } catch (error) {
    console.error('Error getting current user token:', error);
    return null;
  }
};
