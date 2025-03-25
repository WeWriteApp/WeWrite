/**
 * Utilities for consistent user data management across the application
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { auth } from "../firebase/auth";

/**
 * Gets the username for a given user ID
 * Handles all the logic to ensure consistent username display throughout the app
 * @param {string} userId - The user ID to get the username for
 * @returns {Promise<string>} - The username or "Anonymous" if not found
 */
export const getUsernameById = async (userId) => {
  if (!userId) return "Anonymous";
  
  try {
    // Try to get user from Firestore users collection
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.username || "Anonymous";
    }
    
    return "Anonymous";
  } catch (error) {
    console.error("Error fetching username by ID:", error);
    return "Anonymous";
  }
};

/**
 * Gets the current authenticated user's username
 * @returns {Promise<string>} - The current user's username or "Anonymous" if not logged in
 */
export const getCurrentUsername = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return "Anonymous";
  
  return getUsernameById(currentUser.uid);
};

/**
 * Ensures a page's data has a valid username
 * If the page doesn't have a username, fetches it from the user profile
 * @param {Object} pageData - The page data object
 * @returns {Promise<Object>} - The enriched page data with valid username
 */
export const ensurePageUsername = async (pageData) => {
  if (!pageData) return null;
  
  // If page already has a valid username, return as is
  if (pageData.username && pageData.username !== "Anonymous") {
    return pageData;
  }
  
  // Otherwise, try to fetch the username based on userId
  if (pageData.userId) {
    try {
      const username = await getUsernameById(pageData.userId);
      return {
        ...pageData,
        username
      };
    } catch (error) {
      console.error("Error ensuring page username:", error);
    }
  }
  
  return pageData;
};
