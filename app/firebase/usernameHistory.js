import { db } from './config';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getDatabase, ref, get, update } from 'firebase/database';

// Only import admin in a server context
let admin;

// Only initialize Firebase Admin on the server
if (typeof window === 'undefined') {
  try {
    // Import our centralized Firebase Admin initialization
    const { initAdmin, admin: firebaseAdmin } = require('./admin');

    // Initialize Firebase Admin using our centralized function
    initAdmin();

    // Set admin reference
    admin = firebaseAdmin;
  } catch (initError) {
    console.error("Error initializing Firebase Admin:", initError);
  }
}

/**
 * Records a username change in the usernameHistory collection
 * @param {string} userId - The user's ID
 * @param {string} oldUsername - The previous username
 * @param {string} newUsername - The new username
 * @returns {Promise<string>} - The ID of the newly created history record
 */
export const recordUsernameChange = async (userId, oldUsername, newUsername) => {
  try {
    // Add record to Firestore
    const historyRef = collection(db, 'usernameHistory');
    const docRef = await addDoc(historyRef, {
      userId,
      oldUsername,
      newUsername,
      changedAt: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error('Error recording username change:', error);
    throw error;
  }
};

/**
 * Gets the username history for a specific user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} - Array of username change records
 */
export const getUsernameHistory = async (userId) => {
  try {
    // This functionality is implemented in the UsernameHistory component
    // This is just a placeholder for future backend API implementation
    return [];
  } catch (error) {
    console.error('Error getting username history:', error);
    throw error;
  }
};

/**
 * Updates a user's username in both RTDB and Firebase Auth
 * @param {string} userId - The user's ID
 * @param {string} newUsername - The new username
 * @returns {Promise<void>}
 */
export const updateUsername = async (userId, newUsername) => {
  try {
    // First, get the current username from RTDB
    const rtdb = getDatabase();
    const userRef = ref(rtdb, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      throw new Error("User not found in database");
    }

    const userData = snapshot.val();
    const oldUsername = userData.username || "Unknown";

    // Check if the new username is different from the current one
    if (oldUsername === newUsername) {
      console.log("Username unchanged, skipping update");
      return { success: true, message: "Username unchanged" };
    }

    // Check if the new username is already taken
    const usernamesQuery = query(
      collection(db, "usernames"),
      where("username", "==", newUsername.toLowerCase())
    );

    const usernamesSnapshot = await getDocs(usernamesQuery);

    if (!usernamesSnapshot.empty) {
      const existingUser = usernamesSnapshot.docs[0].data();
      if (existingUser.userId !== userId) {
        throw new Error("Username already taken");
      }
    }

    // Update username in RTDB
    await update(userRef, { username: newUsername });
    console.log("Username updated in RTDB");

    // Update displayName in Firebase Auth (server-side only)
    if (typeof window === 'undefined' && admin && admin.apps && admin.apps.length > 0) {
      try {
        await admin.auth().updateUser(userId, {
          displayName: newUsername
        });
        console.log("DisplayName updated in Firebase Auth");
      } catch (authError) {
        console.error("Error updating displayName in Auth:", authError);
        // Don't throw here, as RTDB update already succeeded
      }
    }

    // Update username in Firestore usernames collection
    try {
      // Remove old username entry
      const oldUsernameQuery = query(
        collection(db, "usernames"),
        where("userId", "==", userId)
      );

      const oldUsernameSnapshot = await getDocs(oldUsernameQuery);

      if (!oldUsernameSnapshot.empty) {
        // Delete old username entries
        for (const doc of oldUsernameSnapshot.docs) {
          await db.collection("usernames").doc(doc.id).delete();
        }
      }

      // Add new username entry
      await db.collection("usernames").doc(newUsername.toLowerCase()).set({
        userId,
        username: newUsername,
        createdAt: serverTimestamp()
      });

      console.log("Username updated in Firestore usernames collection");
    } catch (firestoreError) {
      console.error("Error updating username in Firestore:", firestoreError);
      // Don't throw here, as RTDB update already succeeded
    }

    // Record the username change in history
    await recordUsernameChange(userId, oldUsername, newUsername);

    return { success: true, message: "Username updated successfully" };
  } catch (error) {
    console.error("Error updating username:", error);
    throw error;
  }
};
