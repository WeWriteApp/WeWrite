import {app} from './config';
import { getAuth } from "firebase/auth";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, updateEmail as firebaseUpdateEmail, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import Cookies from 'js-cookie';

export const auth = getAuth(app);
const db = getFirestore(app);

// firebase database service
export const createUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    return error;
  }
}

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  } catch (error) {
    console.error("Login error:", error);

    // Convert Firebase error codes to user-friendly messages
    let message = "An error occurred during login. Please try again.";

    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      message = "Incorrect email or password. Please try again.";
    } else if (error.code === "auth/invalid-email") {
      message = "Invalid email address format.";
    } else if (error.code === "auth/user-disabled") {
      message = "This account has been disabled.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Too many failed login attempts. Please try again later.";
    } else if (error.code === "auth/network-request-failed") {
      message = "Network error. Please check your internet connection.";
    }

    return { code: error.code, message: message };
  }
}

export const logoutUser = async (keepPreviousSession = false, returnToPreviousAccount = false) => {
  try {
    // Check if we should return to a previous account
    if (returnToPreviousAccount) {
      console.log('Logout: Attempting to return to previous account');

      // Get saved accounts to find the previous account
      const savedAccountsJson = localStorage.getItem('savedAccounts');
      if (savedAccountsJson) {
        try {
          const savedAccounts = JSON.parse(savedAccountsJson);

          // Find the account that was previously current (not the current one)
          // Sort by lastUsed to get the most recently used non-current account
          const nonCurrentAccounts = savedAccounts
            .filter(account => !account.isCurrent)
            .sort((a, b) => new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0));

          if (nonCurrentAccounts.length > 0) {
            const previousAccount = nonCurrentAccounts[0];
            console.log('Logout: Found previous account to return to:', previousAccount.email);

            // Store the account to switch to
            localStorage.setItem('switchToAccount', JSON.stringify(previousAccount));
            localStorage.setItem('accountSwitchInProgress', 'true');

            // Update saved accounts to mark the previous account as current
            const updatedAccounts = savedAccounts.map(account => ({
              ...account,
              isCurrent: account.uid === previousAccount.uid,
              lastUsed: account.uid === previousAccount.uid ? new Date().toISOString() : account.lastUsed
            }));
            localStorage.setItem('savedAccounts', JSON.stringify(updatedAccounts));

            // Sign out from Firebase
            await signOut(auth);

            // Redirect to switch account page
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                window.location.href = '/auth/switch-account';
              }, 100);
            }

            return { success: true, returnedToPrevious: true };
          } else {
            console.log('Logout: No previous account found, proceeding with normal logout');
          }
        } catch (parseError) {
          console.error('Logout: Error parsing saved accounts:', parseError);
        }
      }
    }

    // Only clear previous user session if not explicitly keeping it
    if (!keepPreviousSession) {
      localStorage.removeItem('previousUserSession');
      localStorage.removeItem('wewrite_accounts');
      localStorage.removeItem('wewrite_current_account');
      localStorage.removeItem('wewrite_auth_state');
      localStorage.removeItem('authState');
      localStorage.removeItem('accountSwitchInProgress');
      localStorage.removeItem('switchToAccount');

      // Clear cookies
      Cookies.remove('session');
      Cookies.remove('authenticated');
      Cookies.remove('userSession');
      Cookies.remove('wewrite_authenticated');
      Cookies.remove('wewrite_user_id');
    }

    // We'll no longer try to get the token directly to avoid browser extension issues
    // Instead, we'll just mark that we're in the process of switching accounts
    if (keepPreviousSession) {
      // Set a flag to indicate we're in the process of switching accounts
      localStorage.setItem('accountSwitchInProgress', 'true');
    }

    // Sign out from Firebase
    await signOut(auth);

    // Force a page reload in PWA mode to ensure clean state
    if (!keepPreviousSession && typeof window !== 'undefined') {
      // Use a small timeout to ensure the signOut completes
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }

    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);

    // Even if there's an error, try to clear cookies and redirect
    if (!keepPreviousSession && typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }

    return { success: false, error };
  }
}

export const addUsername = async (userId, username) => {
  try {
    // Check if username is available
    const isAvailable = await checkUsernameAvailability(username);
    if (!isAvailable) {
      throw new Error('Username is already taken');
    }

    // Update the username in Firestore users collection
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      username: username
    });

    // Also update auth display name if current user
    if (auth.currentUser && auth.currentUser.uid === userId) {
      await updateProfile(auth.currentUser, {
        displayName: username
      });
    }

    // Reserve the username in the usernames collection
    const usernameDocRef = doc(db, 'usernames', username.toLowerCase());
    await setDoc(usernameDocRef, {
      uid: userId,
      createdAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating username:", error);
    return { success: false, error };
  }
}

export const getUserProfile = async (userId) => {
  if (!userId) return null;

  try {
    // Try to get user from Firestore users collection
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data();
    }

    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export const updateEmail = async (user, newEmail) => {
  try {
    // Update the email in Firebase Authentication
    await firebaseUpdateEmail(user, newEmail);

    // Update the email in Firestore users collection
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, {
      email: newEmail
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating email:", error);
    return { success: false, error };
  }
}

export const checkUsernameAvailability = async (username) => {
  try {
    if (!username || username.length < 3) {
      return {
        isAvailable: false,
        message: "Username must be at least 3 characters",
        error: "TOO_SHORT",
        suggestions: []
      };
    }

    // Check if username contains only alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        isAvailable: false,
        message: "Username can only contain letters, numbers, and underscores",
        error: "INVALID_CHARACTERS",
        suggestions: []
      };
    }

    const userDoc = doc(db, 'usernames', username.toLowerCase());
    const docSnap = await getDoc(userDoc);

    const isAvailable = !docSnap.exists();

    if (isAvailable) {
      return {
        isAvailable: true,
        message: "Username is available",
        error: null,
        suggestions: []
      };
    } else {
      // Generate username suggestions
      const suggestions = generateUsernameSuggestions(username);

      // Check if suggestions are available
      const availableSuggestions = await checkSuggestionsAvailability(suggestions);

      return {
        isAvailable: false,
        message: "Username already taken",
        error: "USERNAME_TAKEN",
        suggestions: availableSuggestions
      };
    }
  } catch (error) {
    console.error("Error checking username availability:", error);
    return {
      isAvailable: false,
      message: "Error checking username availability",
      error: "CHECK_ERROR",
      suggestions: []
    };
  }
}

/**
 * Generate username suggestions based on the original username
 * @param {string} username - The original username
 * @returns {string[]} - Array of username suggestions
 */
const generateUsernameSuggestions = (username) => {
  const suggestions = [];

  // Add a random number (1-99) to the end
  for (let i = 0; i < 3; i++) {
    const randomNum = Math.floor(Math.random() * 99) + 1;
    suggestions.push(`${username}${randomNum}`);
  }

  // Add an underscore and a random number
  suggestions.push(`${username}_${Math.floor(Math.random() * 99) + 1}`);

  // Add the current year
  suggestions.push(`${username}${new Date().getFullYear()}`);

  // Return unique suggestions only
  return [...new Set(suggestions)].slice(0, 3);
}

/**
 * Check which of the suggested usernames are available
 * @param {string[]} suggestions - Array of username suggestions
 * @returns {Promise<string[]>} - Array of available username suggestions
 */
const checkSuggestionsAvailability = async (suggestions) => {
  const availableSuggestions = [];

  for (const suggestion of suggestions) {
    try {
      const userDoc = doc(db, 'usernames', suggestion.toLowerCase());
      const docSnap = await getDoc(userDoc);

      if (!docSnap.exists()) {
        availableSuggestions.push(suggestion);

        // Stop once we have 3 available suggestions
        if (availableSuggestions.length >= 3) {
          break;
        }
      }
    } catch (error) {
      console.error(`Error checking suggestion availability for ${suggestion}:`, error);
    }
  }

  return availableSuggestions;
}

/**
 * Sign in anonymously
 *
 * @returns {Promise<Object>} Result object with user or error
 */
export const loginAnonymously = async () => {
  try {
    const userCredential = await signInAnonymously(auth);

    // Create a basic profile for the anonymous user
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    await setDoc(userDocRef, {
      email: null,
      username: `anonymous_${Math.floor(Math.random() * 10000)}`,
      displayName: 'Anonymous User',
      isAnonymous: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    }, { merge: true });

    return { user: userCredential.user };
  } catch (error) {
    console.error("Anonymous login error:", error);
    return { code: error.code, message: error.message };
  }
}