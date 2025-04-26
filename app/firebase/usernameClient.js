/**
 * Client-side username management functions
 * This file contains only client-safe code with no Firebase Admin dependencies
 */

import { db } from './config';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getDatabase, ref, get, update } from 'firebase/database';

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
 * Updates a user's username in RTDB and Firestore
 * Note: This is the client-side version that doesn't use Firebase Admin
 * @param {string} userId - The user's ID
 * @param {string} newUsername - The new username
 * @returns {Promise<Object>} - Result of the operation
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
      await addDoc(collection(db, "usernames"), {
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
    
    // Call the server API to update Firebase Auth displayName
    try {
      const response = await fetch('/api/username/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newUsername
        }),
      });
      
      if (!response.ok) {
        console.warn('Server-side username update failed, but client-side update succeeded');
      }
    } catch (apiError) {
      console.error('Error calling username update API:', apiError);
      // Don't throw here, as client-side updates already succeeded
    }
    
    return { success: true, message: "Username updated successfully" };
  } catch (error) {
    console.error("Error updating username:", error);
    throw error;
  }
};
