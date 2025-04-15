/**
 * Current User Utility
 *
 * This is the single source of truth for the current user in the application.
 * It overrides all other auth mechanisms and provides a simple way to get and set
 * the current user regardless of Firebase auth state.
 */

import Cookies from 'js-cookie';
import { auth } from '../firebase/auth';

// Get the current user from all possible sources
export const getCurrentUser = () => {
  try {
    // First check if we have a Firebase auth user
    if (auth.currentUser) {
      console.log('Using Firebase auth user:', auth.currentUser.email);
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
      try {
        const userData = JSON.parse(userSessionCookie);
        console.log('Using session cookie user:', userData.email);
        return userData;
      } catch (e) {
        console.error('Error parsing user session cookie:', e);
      }
    }

    // If no session cookie, check localStorage
    const switchToAccount = localStorage.getItem('switchToAccount');
    if (switchToAccount) {
      try {
        const accountData = JSON.parse(switchToAccount);
        console.log('Using switchToAccount data:', accountData.email);
        return accountData;
      } catch (e) {
        console.error('Error parsing switchToAccount data:', e);
      }
    }

    // Last resort: check for previous user session
    const previousUserSession = localStorage.getItem('previousUserSession');
    if (previousUserSession) {
      try {
        const sessionData = JSON.parse(previousUserSession);
        console.log('Using previousUserSession data:', sessionData.email);
        return sessionData;
      } catch (e) {
        console.error('Error parsing previousUserSession data:', e);
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }

  console.log('No user found in any source');
  return null;
};

// Set the current user in all storage mechanisms
export const setCurrentUser = (user) => {
  if (!user) {
    console.log('Clearing all user data');
    Cookies.remove('userSession');
    Cookies.remove('authenticated');
    Cookies.remove('session'); // Remove Firebase auth token
    localStorage.removeItem('switchToAccount');
    localStorage.removeItem('accountSwitchInProgress');
    return;
  }

  console.log('Setting current user:', user.email);

  // Set the authenticated cookie
  Cookies.set('authenticated', 'true', { expires: 7 });

  // Clean up the user object to ensure it's serializable
  const cleanUser = {
    uid: user.uid,
    email: user.email,
    username: user.username || user.displayName,
    displayName: user.displayName || user.username,
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

  // Set the user session cookie
  Cookies.set('userSession', JSON.stringify(cleanUser), { expires: 7 });

  // If we have an auth token, set it as a session cookie
  if (cleanUser.authToken) {
    console.log('Setting session cookie with auth token');
    Cookies.set('session', cleanUser.authToken, { expires: 7 });
  }

  // Update saved accounts to ensure only this one is current
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
};

// Check if the user is authenticated
export const isAuthenticated = () => {
  // Check multiple sources for authentication
  const firebaseAuth = !!auth.currentUser;
  const sessionUser = !!getCurrentUser();
  const authenticatedCookie = Cookies.get('authenticated') === 'true';
  const sessionCookie = !!Cookies.get('session');

  console.log('Auth check:', {
    firebaseAuth,
    sessionUser,
    authenticatedCookie,
    sessionCookie
  });

  return firebaseAuth || sessionUser || authenticatedCookie || sessionCookie;
};

// Get the current user's auth token
export const getCurrentUserToken = async () => {
  try {
    // First check if we have a Firebase auth user
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(true);
        console.log('Got token from Firebase auth');
        return token;
      } catch (e) {
        console.error('Error getting Firebase token:', e);
      }
    }

    // If no Firebase auth user, check for session cookie
    const sessionToken = Cookies.get('session');
    if (sessionToken) {
      console.log('Got token from session cookie');
      return sessionToken;
    }

    // Check user session for token
    const userSession = getCurrentUser();
    if (userSession && userSession.authToken) {
      console.log('Got token from user session');
      return userSession.authToken;
    }

    // Last resort: check localStorage
    const lastAuthToken = localStorage.getItem('lastAuthToken');
    if (lastAuthToken) {
      console.log('Got token from localStorage');
      return lastAuthToken;
    }
  } catch (error) {
    console.error('Error getting current user token:', error);
  }

  console.log('No auth token found');
  return null;
};
