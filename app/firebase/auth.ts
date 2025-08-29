// Firebase auth - clean implementation
import { auth, firestore } from './config';
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
import Cookies from 'js-cookie';
import type { User } from '../types/database';
import { getCollectionName } from '../utils/environmentConfig';

// Firebase auth - clean and simple
console.log('[Firebase Auth] Using authentication system');

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

    console.log('[Firebase Auth] Starting login process for:', trimmedInput);
    console.log('[Firebase Auth] Input validation:', {
      originalLength: emailOrUsername?.length || 0,
      trimmedLength: trimmedInput.length,
      hasWhitespace: emailOrUsername !== trimmedInput,
      inputType: trimmedInput.includes('@') ? 'email' : 'username'
    });
    console.log('[Firebase Auth] Firebase config check:', {
      hasAuth: !!auth,
      hasFirestore: !!firestore,
      authCurrentUser: auth?.currentUser?.email || 'none'
    });

    let email = trimmedInput;

    // Check if the input is a username (doesn't contain @)
    if (!trimmedInput.includes('@')) {
      console.log('[Firebase Auth] Looking up email for username:', trimmedInput);
      const usernameCollection = getCollectionName('usernames');
      console.log('[Firebase Auth] Username collection:', usernameCollection);

      // Look up the email by username
      const usernameDoc = await getDoc(doc(firestore, usernameCollection, trimmedInput.toLowerCase()));

      if (!usernameDoc.exists()) {
        console.log('[Firebase Auth] Username not found in collection:', usernameCollection);
        return {
          code: "auth/user-not-found",
          message: "No account found with this username or email."
        };
      }

      // Get the user's email from the users collection
      const userData = usernameDoc.data();
      console.log('[Firebase Auth] Found UID for username:', userData.uid);

      const userCollection = getCollectionName('users');
      console.log('[Firebase Auth] User collection:', userCollection);
      const userDoc = await getDoc(doc(firestore, userCollection, userData.uid));
      if (!userDoc.exists()) {
        console.log('[Firebase Auth] User document not found for UID:', userData.uid);
        return {
          code: "auth/user-not-found",
          message: "No account found with this username or email."
        };
      }

      email = userDoc.data().email;
      console.log('[Firebase Auth] Resolved email for username:', email);
    }

    // CRITICAL: Final email validation before Firebase call
    const finalEmail = email.trim();
    console.log('[Firebase Auth] Final email validation:', {
      email: finalEmail,
      length: finalEmail.length,
      hasAt: finalEmail.includes('@'),
      hasDot: finalEmail.includes('.'),
      isValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)
    });

    console.log('[Firebase Auth] Attempting Firebase signInWithEmailAndPassword for:', finalEmail);
    const userCredential = await signInWithEmailAndPassword(auth, finalEmail, trimmedPassword);
    console.log('[Firebase Auth] Firebase login successful for:', userCredential.user.email);
    return { user: userCredential.user };
  } catch (error: any) {
    console.error("[Firebase Auth] Login error:", error);
    console.error("[Firebase Auth] Error details:", {
      code: error.code,
      message: error.message,
      stack: error.stack,
      // Check for any timing information in the error
      customData: error.customData,
      details: error.details,
      serverResponse: error.serverResponse,
      // Additional debugging for Android PWA issues
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'server',
      isAndroid: typeof navigator !== 'undefined' ? /Android/i.test(navigator.userAgent) : false,
      isPWA: typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)').matches : false
    });

    // Convert Firebase error codes to user-friendly messages
    let message = "An error occurred during login. Please try again.";

    if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      message = "Incorrect username/email or password. Please try again.";
    } else if (error.code === "auth/invalid-email") {
      // ENHANCED: Better error message for invalid email on Android PWA
      message = "Please check your email address and try again. Make sure there are no extra spaces.";
    } else if (error.code === "auth/user-disabled") {
      message = "This account has been disabled.";
    } else if (error.code === "auth/too-many-requests") {
      // Log detailed error information to see if Firebase provides any timing data
      console.error("[Firebase Auth] Rate limit error details:", {
        fullError: error,
        customData: error.customData,
        details: error.details,
        serverResponse: error.serverResponse,
        timestamp: new Date().toISOString()
      });

      message = "Too many failed login attempts. Please wait 15-30 minutes before trying again, or use 'Forgot Password' to reset your password.";
    } else if (error.code === "auth/network-request-failed") {
      message = "Network error. Please check your internet connection.";
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
    console.log('🔴 LOGOUT: Logout started');

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
      console.warn('Failed to clear localStorage:', error);
    }

    // Clear server-side session
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.warn('Failed to clear server-side session:', error);
    }

    console.log('🔴 LOGOUT: Logout completed');
    return { success: true };
  } catch (error) {
    console.error("🔴 LOGOUT: Logout error:", error);
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
    console.error("Error updating username:", error);
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
    console.error("Error fetching user profile:", error);
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
    console.error("Error updating email:", error);
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
    console.error("Error updating password:", error);

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

    // Check for whitespace characters (comprehensive Unicode whitespace detection)
    if (/\s/.test(username)) {
      return {
        isAvailable: false,
        message: "Usernames cannot contain spaces or whitespace characters. Try using underscores (_) instead.",
        error: "CONTAINS_WHITESPACE",
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
      console.error(`Error checking suggestion availability for ${suggestion}:`, error);
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
      console.error('Error tracking anonymous user creation:', error);
    }

    return { user: userCredential.user };
  } catch (error: any) {
    console.error("Anonymous login error:", error);
    return { code: error.code, message: error.message };
  }
}