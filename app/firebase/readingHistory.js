import { db } from "./config";
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Track a page view in the user's reading history
 * 
 * @param {string} userId - The ID of the user
 * @param {string} pageId - The ID of the page
 * @param {string} pageTitle - The title of the page
 * @param {string} pageOwnerId - The ID of the page owner
 * @param {string} pageOwnerName - The name of the page owner
 * @returns {Promise<string>} - The ID of the created history item
 */
export const trackPageView = async (userId, pageId, pageTitle, pageOwnerId, pageOwnerName) => {
  if (!userId || !pageId) return null;

  try {
    // Check if this page is already in the user's recent history
    const historyRef = collection(db, "readingHistory");
    const existingQuery = query(
      historyRef,
      where("userId", "==", userId),
      where("pageId", "==", pageId),
      limit(1)
    );

    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      // Update the existing history item with a new timestamp
      const existingDoc = existingSnapshot.docs[0];
      await updateDoc(doc(db, "readingHistory", existingDoc.id), {
        timestamp: serverTimestamp(),
        pageTitle: pageTitle || "Untitled", // Update title in case it changed
        pageOwnerName: pageOwnerName || "Anonymous" // Update owner name in case it changed
      });

      return existingDoc.id;
    }

    // Create a new history item
    const historyItem = {
      userId,
      pageId,
      pageTitle: pageTitle || "Untitled",
      pageOwnerId: pageOwnerId || "",
      pageOwnerName: pageOwnerName || "Anonymous",
      timestamp: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "readingHistory"), historyItem);
    return docRef.id;
  } catch (error) {
    console.error("Error tracking page view in history:", error);
    return null;
  }
};

/**
 * Get the user's reading history
 * 
 * @param {string} userId - The ID of the user
 * @param {number} limit - The maximum number of items to return
 * @returns {Promise<Array>} - The user's reading history
 */
export const getReadingHistory = async (userId, itemLimit = 50) => {
  if (!userId) return [];

  try {
    const historyRef = collection(db, "readingHistory");
    const historyQuery = query(
      historyRef,
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(itemLimit)
    );

    const snapshot = await getDocs(historyQuery);
    
    if (snapshot.empty) {
      return [];
    }

    // Convert the snapshot to history items
    return snapshot.docs.map(doc => ({
      id: doc.id,
      pageId: doc.data().pageId,
      pageTitle: doc.data().pageTitle || "Untitled",
      pageOwnerId: doc.data().pageOwnerId || "",
      pageOwnerName: doc.data().pageOwnerName || "Anonymous",
      timestamp: doc.data().timestamp?.toDate() || new Date()
    }));
  } catch (error) {
    console.error("Error getting reading history:", error);
    return [];
  }
};

/**
 * Remove an item from the user's reading history
 * 
 * @param {string} historyItemId - The ID of the history item to remove
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export const removeFromHistory = async (historyItemId) => {
  if (!historyItemId) return false;

  try {
    await deleteDoc(doc(db, "readingHistory", historyItemId));
    return true;
  } catch (error) {
    console.error("Error removing history item:", error);
    return false;
  }
};

/**
 * Clear all reading history for a user
 * 
 * @param {string} userId - The ID of the user
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export const clearReadingHistory = async (userId) => {
  if (!userId) return false;

  try {
    // Get all history items for this user
    const historyRef = collection(db, "readingHistory");
    const historyQuery = query(
      historyRef,
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(historyQuery);
    
    if (snapshot.empty) {
      return true; // No history to clear
    }

    // Delete all history items
    const deletePromises = snapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error("Error clearing reading history:", error);
    return false;
  }
};
