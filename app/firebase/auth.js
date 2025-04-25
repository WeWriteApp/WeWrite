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

export const logoutUser = async (keepPreviousSession = false) => {
  try {
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
      return false;
    }

    // Check if username contains only alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return false;
    }

    const userDoc = doc(db, 'usernames', username.toLowerCase());
    const docSnap = await getDoc(userDoc);

    return !docSnap.exists();
  } catch (error) {
    console.error("Error checking username availability:", error);
    return false;
  }
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