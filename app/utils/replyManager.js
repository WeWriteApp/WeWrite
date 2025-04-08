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
    let displayUsername = "Anonymous";

    // Try to get the username from the API first (most reliable)
    try {
      if (pageData.userId) {
        const apiUsername = await fetchUsernameFromApi(pageData.userId);
        if (apiUsername && apiUsername !== "Anonymous") {
          displayUsername = apiUsername;
          console.log("Using username from API for reply attribution:", displayUsername);
        }
      }
    } catch (apiError) {
      console.error("Error fetching username from API:", apiError);
    }

    // If still Anonymous, try the utility function
    if (displayUsername === "Anonymous" && pageData.userId) {
      try {
        const utilityUsername = await getUsernameById(pageData.userId);
        if (utilityUsername && utilityUsername !== "Anonymous") {
          displayUsername = utilityUsername;
          console.log("Using username from utility for reply attribution:", displayUsername);
        }
      } catch (utilityError) {
        console.error("Error fetching from utility:", utilityError);
      }
    }

    // If still Anonymous, use the username from the page data if available
    if (displayUsername === "Anonymous" && pageData.username) {
      displayUsername = pageData.username;
      console.log("Using username from page data for reply attribution:", displayUsername);
    }

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

  // Ensure we have the original content to work with
  if (!originalContent.length) return newContent;

  // Get the original attribution line
  const attributionLine = originalContent[0];

  // Check if the attribution line is missing or modified
  if (newContent.length === 0) {
    // If content is empty, restore the attribution line
    console.log('Content empty, restoring attribution line');
    return [attributionLine];
  }

  // Check if the first line is the attribution line
  const firstLine = newContent[0];
  const isFirstLineAttribution =
    firstLine &&
    firstLine.type === 'paragraph' &&
    firstLine.children &&
    firstLine.children.some(child =>
      child.type === 'link' && (child.pageId || child.isUser)
    );

  if (!isFirstLineAttribution) {
    // Attribution line is missing, add it back
    console.log('Attribution line missing, restoring it');
    return [attributionLine, ...newContent];
  }

  // If the attribution line exists but might be modified, restore the original
  if (JSON.stringify(firstLine) !== JSON.stringify(attributionLine)) {
    console.log('Attribution line modified, restoring original');
    newContent[0] = attributionLine;
  }

  return newContent;
};
