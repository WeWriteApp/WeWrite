"use client";

import { db } from './config';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc,
  setDoc,
  doc,
  type DocumentData,
  type QuerySnapshot,
  type DocumentReference
} from 'firebase/firestore';
import { getDatabase, ref, get, update, type Database, type DatabaseReference } from 'firebase/database';

// Type definitions for username history operations
interface UsernameHistoryRecord {
  userId: string;
  oldUsername: string;
  newUsername: string;
  changedAt: any;
}

interface UpdateUsernameResult {
  success: boolean;
  message: string;
}

// Only import admin in a server context
let admin: any;

// Only initialize Firebase Admin on the server
if (typeof window === 'undefined') {
  try {
    // Import our centralized Firebase Admin initialization
    const { getFirebaseAdmin } = require('./firebaseAdmin');

    // Get Firebase Admin instance
    admin = getFirebaseAdmin();
  } catch (initError) {
    console.error("Error initializing Firebase Admin:", initError);
  }
}

/**
 * Records a username change in the usernameHistory collection
 * @param userId - The user's ID
 * @param oldUsername - The previous username
 * @param newUsername - The new username
 * @returns The ID of the newly created history record
 */
export const recordUsernameChange = async (userId: string, oldUsername: string, newUsername: string): Promise<string> => {
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
 * @param userId - The user's ID
 * @returns Array of username change records
 */
export const getUsernameHistory = async (userId: string): Promise<UsernameHistoryRecord[]> => {
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
 * @param userId - The user's ID
 * @param newUsername - The new username
 * @returns Promise resolving to update result
 */
export const updateUsername = async (userId: string, newUsername: string): Promise<UpdateUsernameResult> => {
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
        for (const docSnapshot of oldUsernameSnapshot.docs) {
          await deleteDoc(doc(db, "usernames", docSnapshot.id));
        }
      }

      // Add new username entry
      await setDoc(doc(db, "usernames", newUsername.toLowerCase()), {
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
