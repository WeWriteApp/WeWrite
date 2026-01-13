// Firebase auth - clean implementation
import { auth, firestore, rtdb } from './config';
import {
  type User as FirebaseUser,
  type UserCredential,
  updateProfile,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { ref, update as rtdbUpdate } from 'firebase/database';
import Cookies from 'js-cookie';
import type { User } from '../types/database';
import { getCollectionName } from '../utils/environmentConfig';
import { isValidEmail } from '@/utils/validationPatterns';

// Firebase auth - clean and simple

// Export auth instance for backward compatibility
export { auth } from './config';

// Auth result interfaces
interface AuthResult {
  user?: FirebaseUser;
  success?: boolean;
  error?: any;
  code?: string;
  message?: string;
}

interface UsernameAvailabilityResult {
  isAvailable: boolean;
  message: string;
  error: string | null;
  suggestions: string[];
}

// Simple user creation
export const createUser = async (email: string, password: string): Promise<UserCredential | Error> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    return error as Error;
  }
}

export const loginUser = async (emailOrUsername: string, password: string): Promise<AuthResult> => {
  try {
    // CRITICAL: Trim input to prevent whitespace issues on Android PWA
    const trimmedInput = emailOrUsername?.trim() || '';
    const trimmedPassword = password?.trim() || '';

    let email = trimmedInput;
    let usedUsername = false;

    // Check if the input is a username (doesn't contain @)
    if (!trimmedInput.includes('@')) {
      usedUsername = true;
      const usernameCollection = getCollectionName('usernames');

      // Look up the email by username
      const usernameDoc = await getDoc(doc(firestore, usernameCollection, trimmedInput.toLowerCase()));

      if (!usernameDoc.exists()) {
        return {
          code: "auth/user-not-found",
          message: "No account found with this username. Please check your spelling or try your email address instead."
        };
      }

      // Get the user's email from the users collection
      const userData = usernameDoc.data();

      const userCollection = getCollectionName('users');
      const userDoc = await getDoc(doc(firestore, userCollection, userData.uid));
      if (!userDoc.exists()) {
        return {
          code: "auth/user-not-found",
          message: "No account found with this username. Please check your spelling or try your email address instead."
        };
      }

      email = userDoc.data().email;
    } else {
      // User entered an email - validate the format
      if (!isValidEmail(trimmedInput)) {
        // Check for common typos in email domains
        const commonTypos: Record<string, string> = {
          '.con': '.com',
          '.cpm': '.com',
          '.ocm': '.com',
          '.vom': '.com',
          '.xom': '.com',
          '.comm': '.com',
          '.copm': '.com',
          '.coom': '.com',
          '.ckm': '.com',
          '.cm': '.com',
          '.co': '.com',
          'gmial.com': 'gmail.com',
          'gmai.com': 'gmail.com',
          'gamil.com': 'gmail.com',
          'gnail.com': 'gmail.com',
          'gmal.com': 'gmail.com',
          'gmail.con': 'gmail.com',
          'hotmal.com': 'hotmail.com',
          'hotmial.com': 'hotmail.com',
          'hotmail.con': 'hotmail.com',
          'outlok.com': 'outlook.com',
          'outloo.com': 'outlook.com',
          'outlook.con': 'outlook.com',
          'yahooo.com': 'yahoo.com',
          'yaho.com': 'yahoo.com',
          'yahoo.con': 'yahoo.com',
          'iclud.com': 'icloud.com',
          'icoud.com': 'icloud.com',
          'icloud.con': 'icloud.com',
        };

        // Check for typo suggestions
        const lowerInput = trimmedInput.toLowerCase();
        for (const [typo, correction] of Object.entries(commonTypos)) {
          if (lowerInput.includes(typo)) {
            const suggested = lowerInput.replace(typo, correction);
            return {
              code: "auth/invalid-email",
              message: `Invalid email format. Did you mean "${suggested}"?`
            };
          }
        }

        return {
          code: "auth/invalid-email",
          message: "Invalid email format. Please check for typos (e.g., '.com' not '.con')."
        };
      }

      // Check if user exists with this email before attempting password auth
      // This allows us to give more specific error messages
      const userCollection = getCollectionName('users');
      const { query, where, getDocs, collection } = await import('firebase/firestore');
      const usersQuery = query(
        collection(firestore, userCollection),
        where('email', '==', trimmedInput.toLowerCase())
      );
      const userSnapshot = await getDocs(usersQuery);

      if (userSnapshot.empty) {
        // Also check with original case
        const usersQueryOriginal = query(
          collection(firestore, userCollection),
          where('email', '==', trimmedInput)
        );
        const userSnapshotOriginal = await getDocs(usersQueryOriginal);

        if (userSnapshotOriginal.empty) {
          return {
            code: "auth/user-not-found",
            message: "No account found with this email address. Please check your spelling or sign up for a new account."
          };
        }
      }
    }

    // CRITICAL: Final email validation before Firebase call
    const finalEmail = email.trim();

    const userCredential = await signInWithEmailAndPassword(auth, finalEmail, trimmedPassword);
    return { user: userCredential.user };
  } catch (error: any) {
    // Convert Firebase error codes to user-friendly messages
    let message = "Unable to sign in. Please check your credentials and try again.";

    // Firebase v9+ returns auth/invalid-credential for wrong password (security measure)
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      message = "Incorrect password. Please try again or use 'Forgot Password' to reset it.";
    } else if (error.code === "auth/user-not-found") {
      message = "No account found with this email or username.";
    } else if (error.code === "auth/invalid-email") {
      message = "Invalid email format. Please check for typos.";
    } else if (error.code === "auth/user-disabled") {
      message = "This account has been disabled. Please contact support.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Too many failed login attempts. Please wait 15-30 minutes before trying again, or use 'Forgot Password' to reset your password.";
    } else if (error.code === "auth/network-request-failed") {
      message = "Network error. Please check your internet connection and try again.";
    }

    return { code: error.code, message: message };
  }
}

interface LogoutResult {
  success: boolean;
  returnedToPrevious?: boolean;
  error?: any;
}

// Removed SavedAccount interface - no longer supporting account switching

export const logoutUser = async (): Promise<LogoutResult> => {
  try {
    // Sign out from Firebase
    await firebaseSignOut(auth);

    // Clear all possible cookies with different domain/path combinations
    const cookiesToClear = [
      'session',
      'authenticated',
      'userSession',
      'simpleUserSession',
      'sessionId',
      'devUserSession',
      'authToken'
    ];

    // Clear cookies with different domain/path combinations to ensure complete cleanup
    cookiesToClear.forEach(cookieName => {
      // Clear with default options
      Cookies.remove(cookieName);
      // Clear with explicit path
      Cookies.remove(cookieName, { path: '/' });
      // Clear with domain for production
      if (window.location.hostname.includes('getwewrite.app')) {
        Cookies.remove(cookieName, { path: '/', domain: '.getwewrite.app' });
        Cookies.remove(cookieName, { path: '/', domain: 'getwewrite.app' });
      }
    });

    // Clear localStorage items that might persist user state
    try {
      const localStorageKeysToRemove = [
        'email_verification_notification_dismissed',
        'last_email_verification_notification',
        'email_verification_resend_cooldown',
        'email_verification_resend_count',
        'authRedirectPending'
      ];

      localStorageKeysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      // Failed to clear localStorage
    }

    // Clear server-side session
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      // Failed to clear server-side session
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export const addUsername = async (userId: string, username: string): Promise<AuthResult> => {
  try {
    // Check if username is available
    const availabilityResult = await checkUsernameAvailability(username);
    if (!availabilityResult.isAvailable) {
      throw new Error('Username is already taken');
    }

    // Update the username in Firestore users collection
    const userDocRef = doc(firestore, getCollectionName('users'), userId);
    await updateDoc(userDocRef, {
      username: username
    });

    // CRITICAL: Also update username in Realtime Database
    // This is the primary source for username lookups in leaderboard, trending, etc.
    try {
      const userRef = ref(rtdb, `users/${userId}`);
      await rtdbUpdate(userRef, {
        username: username,
        lastModified: new Date().toISOString()
      });
    } catch (rtdbError) {
      // Don't fail the request, but log for monitoring
    }

    // Update auth profile if current user
    if (auth.currentUser && auth.currentUser.uid === userId) {
      // No displayName needed - WeWrite only uses usernames

      // Trigger a custom event to notify components that user data has changed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('userDataUpdated', {
          detail: { userId, username }
        }));
      }
    }

    // Reserve the username in the usernames collection
    // CRITICAL: Include email field for login compatibility
    const userDoc = await getDoc(doc(firestore, getCollectionName('users'), userId));
    const userData = userDoc.data();
    const userEmail = userData?.email;

    if (!userEmail) {
      throw new Error('User email not found - cannot create username mapping');
    }

    const usernameDocRef = doc(firestore, getCollectionName('usernames'), username.toLowerCase());
    await setDoc(usernameDocRef, {
      uid: userId,
      username: username,
      email: userEmail, // Include email for login compatibility
      createdAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export const getUserProfile = async (userId: string): Promise<User | null> => {
  if (!userId) return null;

  try {
    // Try to get user from Firestore users collection
    const userDocRef = doc(firestore, getCollectionName('users'), userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data() as User;
    }

    return null;
  } catch (error) {
    return null;
  }
}

export const updateEmail = async (user: FirebaseUser, newEmail: string): Promise<AuthResult> => {
  try {
    // Update the email in Firebase Authentication
    await firebaseUpdateEmail(user, newEmail);

    // Update the email in Firestore users collection
    const userDocRef = doc(firestore, getCollectionName("users"), user.uid);
    await updateDoc(userDocRef, {
      email: newEmail
    });

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Update user password with reauthentication
 * @param currentPassword - Current password for reauthentication
 * @param newPassword - New password to set
 * @returns Promise resolving to update result
 */
export const updatePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, error: new Error('No authenticated user found') };
    }

    // Reauthenticate user with current password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password in Firebase Authentication
    await firebaseUpdatePassword(user, newPassword);

    // Update last password change time in Firestore
    const userDocRef = doc(firestore, getCollectionName("users"), user.uid);
    await updateDoc(userDocRef, {
      lastPasswordChange: new Date().toISOString(),
      lastModified: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    // Convert Firebase error codes to user-friendly messages
    let message = "Failed to update password. Please try again.";

    if (error.code === "auth/wrong-password") {
      message = "Current password is incorrect. Please try again.";
    } else if (error.code === "auth/weak-password") {
      message = "New password is too weak. Please choose a stronger password.";
    } else if (error.code === "auth/requires-recent-login") {
      message = "Please log out and log back in before changing your password.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Too many failed attempts. Please try again later.";
    }

    return { success: false, error: new Error(message) };
  }
}

export const checkUsernameAvailability = async (username: string): Promise<UsernameAvailabilityResult> => {
  try {
    if (!username || username.length < 3) {
      return {
        isAvailable: false,
        message: "Username must be at least 3 characters",
        error: "TOO_SHORT",
        suggestions: []
      };
    }

    if (username.length > 30) {
      return {
        isAvailable: false,
        message: "Username must be no more than 30 characters",
        error: "TOO_LONG",
        suggestions: []
      };
    }

    // Check for whitespace characters (comprehensive Unicode whitespace detection)
    if (/\s/.test(username)) {
      return {
        isAvailable: false,
        message: "Usernames cannot contain spaces or whitespace characters. Try using underscores (_) instead.",
        error: "CONTAINS_WHITESPACE",
        suggestions: []
      };
    }

    // Check if username contains only allowed characters: letters, numbers, underscores, dashes, and periods
    if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) {
      return {
        isAvailable: false,
        message: "Username can only contain letters, numbers, underscores, dashes, and periods",
        error: "INVALID_CHARACTERS",
        suggestions: []
      };
    }

    // Cannot start or end with a period, dash, or underscore
    if (/^[._\-]|[._\-]$/.test(username)) {
      return {
        isAvailable: false,
        message: "Username cannot start or end with a period, dash, or underscore",
        error: "INVALID_START_END",
        suggestions: []
      };
    }

    // Cannot have consecutive special characters
    if (/[._\-]{2,}/.test(username)) {
      return {
        isAvailable: false,
        message: "Username cannot have consecutive periods, dashes, or underscores",
        error: "CONSECUTIVE_SPECIAL",
        suggestions: []
      };
    }

    const userDoc = doc(firestore, getCollectionName('usernames'), username.toLowerCase());
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
 * @param username - The original username
 * @returns Array of username suggestions
 */
const generateUsernameSuggestions = (username: string): string[] => {
  const suggestions: string[] = [];

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
  return Array.from(new Set(suggestions)).slice(0, 3);
}

/**
 * Check which of the suggested usernames are available
 * @param suggestions - Array of username suggestions
 * @returns Array of available username suggestions
 */
const checkSuggestionsAvailability = async (suggestions: string[]): Promise<string[]> => {
  const availableSuggestions: string[] = [];

  for (const suggestion of suggestions) {
    try {
      const userDoc = doc(firestore, getCollectionName('usernames'), suggestion.toLowerCase());
      const docSnap = await getDoc(userDoc);

      if (!docSnap.exists()) {
        availableSuggestions.push(suggestion);

        // Stop once we have 3 available suggestions
        if (availableSuggestions.length >= 3) {
          break;
        }
      }
    } catch (error) {
      // Error checking suggestion availability
    }
  }

  return availableSuggestions;
}

/**
 * Sign in anonymously
 *
 * @returns Result object with user or error
 */
export const loginAnonymously = async (): Promise<AuthResult> => {
  try {
    const userCredential = await signInAnonymously(auth);

    // Create a basic profile for the anonymous user
const userDocRef = doc(firestore, getCollectionName("users"), userCredential.user.uid);
    // Use crypto-secure random ID for anonymous users
    const anonymousId = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    await setDoc(userDocRef, {
      email: null,
      username: `anonymous_${anonymousId}`,
      isAnonymous: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    }, { merge: true });

    // Track anonymous user creation event
    try {
      const analytics = getAnalyticsService();
      analytics.trackAuthEvent('USER_CREATED', {
        user_id: userCredential.session.uid,
        username: `anonymous_${anonymousId}`,
        email: null,
        registration_method: 'anonymous'
      });
    } catch (error) {
      // Error tracking anonymous user creation
    }

    return { user: userCredential.user };
  } catch (error: any) {
    return { code: error.code, message: error.message };
  }
}