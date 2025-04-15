import {app} from './config';
import { getAuth } from "firebase/auth";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, updateEmail as firebaseUpdateEmail } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

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
    return { code: error.code, message: error.message };
  }
}

export const logoutUser = async (keepPreviousSession = false) => {
  try {
    // Only clear previous user session if not explicitly keeping it
    if (!keepPreviousSession) {
      localStorage.removeItem('previousUserSession');
    }

    // Get the current Firebase ID token before signing out
    let idToken = null;
    if (keepPreviousSession && auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken(true);
        // Store the token in localStorage for account switching
        if (idToken) {
          localStorage.setItem('lastAuthToken', idToken);
        }
      } catch (tokenError) {
        console.error('Error getting ID token before logout:', tokenError);
      }
    }

    await signOut(auth);
    return { success: true, token: idToken };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error };
  }
}

export const addUsername = async (userId, username) => {
  try {
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
      return { isAvailable: false, message: "Username must be at least 3 characters" };
    }

    // Check if username contains only alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { isAvailable: false, message: "Username can only contain letters, numbers, and underscores" };
    }

    const userDoc = doc(db, 'usernames', username.toLowerCase());
    const docSnap = await getDoc(userDoc);

    return {
      isAvailable: !docSnap.exists(),
      message: docSnap.exists() ? "Username already taken" : "Username is available"
    };
  } catch (error) {
    console.error("Error checking username availability:", error);
    return { isAvailable: false, message: "Error checking username" };
  }
}