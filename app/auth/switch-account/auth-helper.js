"use client";

import { auth } from '../../firebase/auth';
import { signInWithCustomToken } from 'firebase/auth';
import Cookies from 'js-cookie';

/**
 * Helper function to get a custom token for the user
 * This is a simplified version that just returns a mock token for demonstration
 * In a real app, you would call your backend to generate a Firebase custom token
 */
export const getCustomToken = async (userId) => {
  // In a real implementation, you would call your backend API to generate a custom token
  // For example:
  // const response = await fetch('/api/auth/get-custom-token', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ userId })
  // });
  // const data = await response.json();
  // return data.token;

  // For now, we'll just return a mock token
  return `mock_token_for_${userId}`;
};

/**
 * Helper function to sign in with a custom token
 */
export const signInWithToken = async (token) => {
  try {
    // Sign in with the custom token
    const userCredential = await signInWithCustomToken(auth, token);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in with custom token:', error);
    throw error;
  }
};

/**
 * Helper function to set up session cookies
 */
export const setupSessionCookies = (userData) => {
  if (!userData || !userData.uid) return;

  // Set cookies for session-based auth
  Cookies.set('wewrite_user_id', userData.uid, { expires: 7 });
  Cookies.set('wewrite_authenticated', 'true', { expires: 7 });
  Cookies.set('authenticated', 'true', { expires: 7 });
  Cookies.set('userSession', JSON.stringify({
    uid: userData.uid,
    email: userData.email,
    username: userData.username || userData.displayName,
    displayName: userData.displayName || userData.username
  }), { expires: 7 });
};

/**
 * Helper function to update session storage
 */
export const updateSessionStorage = (userData) => {
  if (!userData || !userData.uid) return;

  try {
    // Update wewrite_accounts in sessionStorage
    let accounts = [];
    const accountsJson = sessionStorage.getItem('wewrite_accounts');

    if (accountsJson) {
      accounts = JSON.parse(accountsJson);

      // Update or add the current user
      const existingIndex = accounts.findIndex(acc => acc.uid === userData.uid);

      if (existingIndex >= 0) {
        // Update existing account
        accounts[existingIndex] = {
          ...accounts[existingIndex],
          ...userData,
          isCurrent: true
        };

        // Mark all other accounts as not current
        accounts = accounts.map(acc => ({
          ...acc,
          isCurrent: acc.uid === userData.uid
        }));
      } else {
        // Add new account
        accounts.push({
          ...userData,
          isCurrent: true
        });
      }
    } else {
      // Create new accounts array
      accounts = [{
        ...userData,
        isCurrent: true
      }];
    }

    // Save updated accounts to sessionStorage
    sessionStorage.setItem('wewrite_accounts', JSON.stringify(accounts));

    // Also save to localStorage for persistence and to ensure consistency
    localStorage.setItem('wewrite_accounts', JSON.stringify(accounts));
  } catch (error) {
    console.error('Error updating sessionStorage:', error);
  }
};
