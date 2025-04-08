"use client";

/**
 * Reply Manager
 *
 * This module centralizes all reply-related functionality to ensure consistent behavior
 * across the application and make future maintenance easier.
 */

import { createReplyAttribution } from './linkUtils';
import { getUsernameById } from './userUtils';
import { fetchUsernameFromApi } from './apiUtils';

/**
 * Fetches the original page and creates the reply content with proper attribution
 *
 * @param {string} pageId - ID of the page being replied to
 * @returns {Promise<Object>} - Object containing the reply content and original page data
 */
export const prepareReplyContent = async (pageId) => {
  if (!pageId) {
    throw new Error("No page ID provided for reply");
  }

  try {
    // Import the database module to get page details
    const { getPageById } = await import('../firebase/database');
    const { pageData, versionData } = await getPageById(pageId);

    if (!pageData) {
      throw new Error("Could not find the original page");
    }

    // Get username from the page or user record
    let displayUsername = await fetchUsernameForPage(pageData);

    console.log("Final username to use in reply attribution:", displayUsername);

    // Create reply content with attribution
    const replyContent = [
      createReplyAttribution({
        pageId: pageData.id,
        pageTitle: pageData.title,
        userId: pageData.userId,
        username: displayUsername
      })
    ];

    return {
      replyContent,
      originalPage: pageData,
      originalVersion: versionData
    };
  } catch (error) {
    console.error("Error preparing reply content:", error);
    throw error;
  }
};

/**
 * Fetches the username for a page using multiple sources
 *
 * @param {Object} pageData - The page data object
 * @returns {Promise<string>} - The username or "Anonymous" if not found
 */
export const fetchUsernameForPage = async (pageData) => {
  if (!pageData) return "Anonymous";

  let displayUsername = "Anonymous";

  // First check if the page object already has a username
  if (pageData.username && pageData.username !== "Anonymous") {
    displayUsername = pageData.username;
    console.log("Using username from page object:", displayUsername);
    return displayUsername;
  }

  if (!pageData.userId) return "Anonymous";

  // Try to get the username from the API first (most reliable)
  try {
    const apiUsername = await fetchUsernameFromApi(pageData.userId);
    if (apiUsername && apiUsername !== "Anonymous") {
      displayUsername = apiUsername;
      console.log("Using username from API:", displayUsername);
      return displayUsername;
    }
  } catch (apiError) {
    console.error("Error fetching username from API:", apiError);
  }

  try {
    // Use the utility function to get the username
    const fetchedUsername = await getUsernameById(pageData.userId);
    if (fetchedUsername && fetchedUsername !== "Anonymous") {
      displayUsername = fetchedUsername;
      console.log("Fetched username from utility:", displayUsername);
      return displayUsername;
    }

    // If still Anonymous, try to get username from RTDB directly
    try {
      const { getDatabase, ref, get } = await import('firebase/database');
      const { app } = await import('../firebase/config');
      const rtdb = getDatabase(app);
      const rtdbUserRef = ref(rtdb, `users/${pageData.userId}`);
      const rtdbSnapshot = await get(rtdbUserRef);

      if (rtdbSnapshot.exists()) {
        const rtdbUserData = rtdbSnapshot.val();
        if (rtdbUserData.username) {
          displayUsername = rtdbUserData.username;
          console.log("Using username from RTDB:", displayUsername);
          return displayUsername;
        }
        if (rtdbUserData.displayName) {
          displayUsername = rtdbUserData.displayName;
          console.log("Using displayName from RTDB:", displayUsername);
          return displayUsername;
        }
      }
    } catch (rtdbError) {
      console.error("Error fetching username from RTDB:", rtdbError);
    }

    // Try to get the username from the users collection
    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../firebase/database');

      const usersQuery = query(collection(db, "users"), where("uid", "==", pageData.userId));
      const usersSnapshot = await getDocs(usersQuery);

      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        if (userData.username) {
          displayUsername = userData.username;
          console.log("Found username in users collection:", displayUsername);
          return displayUsername;
        } else if (userData.displayName) {
          displayUsername = userData.displayName;
          console.log("Found displayName in users collection:", displayUsername);
          return displayUsername;
        }
      }
    } catch (firestoreError) {
      console.error("Error fetching username from Firestore:", firestoreError);
    }

    // Try to get the username from the auth object
    try {
      const { auth } = await import('../firebase/auth');
      if (auth.currentUser && auth.currentUser.uid === pageData.userId) {
        if (auth.currentUser.displayName) {
          displayUsername = auth.currentUser.displayName;
          console.log("Using displayName from auth:", displayUsername);
          return displayUsername;
        }
      }
    } catch (authError) {
      console.error("Error fetching username from auth:", authError);
    }
  } catch (error) {
    console.error("Error in fetchUsernameForPage:", error);
  }

  return displayUsername;
};

/**
 * Validates and protects the reply content to ensure the attribution line is preserved
 *
 * @param {Array} originalContent - The original content with attribution
 * @param {Array} newContent - The potentially modified content
 * @returns {Array} - The validated content with attribution preserved
 */
export const validateReplyContent = (originalContent, newContent) => {
  if (!originalContent || !newContent) return newContent;

  if (originalContent.length > 0 && newContent.length > 0) {
    // Always preserve the attribution line (first paragraph)
    if (JSON.stringify(newContent[0]) !== JSON.stringify(originalContent[0])) {
      console.log('Protecting attribution line from changes');
      newContent[0] = originalContent[0];
    }
  }

  return newContent;
};
