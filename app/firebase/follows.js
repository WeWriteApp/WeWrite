"use client";

import { db } from './database';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  increment,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Follow a page
 * 
 * @param {string} userId - The ID of the user following the page
 * @param {string} pageId - The ID of the page to follow
 * @returns {Promise<void>}
 */
export const followPage = async (userId, pageId) => {
  if (!userId || !pageId) {
    throw new Error('User ID and Page ID are required');
  }

  try {
    // Add the page to the user's followed pages
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      // Update existing document
      await updateDoc(userFollowsRef, {
        followedPages: arrayUnion(pageId),
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await setDoc(userFollowsRef, {
        userId,
        followedPages: [pageId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Increment the follower count for the page
    const pageRef = doc(db, 'pages', pageId);
    await updateDoc(pageRef, {
      followerCount: increment(1)
    });

    // Add a record to the pageFollowers collection
    const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);
    await setDoc(pageFollowerRef, {
      pageId,
      userId,
      followedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error following page:', error);
    throw error;
  }
};

/**
 * Unfollow a page
 * 
 * @param {string} userId - The ID of the user unfollowing the page
 * @param {string} pageId - The ID of the page to unfollow
 * @returns {Promise<void>}
 */
export const unfollowPage = async (userId, pageId) => {
  if (!userId || !pageId) {
    throw new Error('User ID and Page ID are required');
  }

  try {
    // Remove the page from the user's followed pages
    const userFollowsRef = doc(db, 'userFollows', userId);
    await updateDoc(userFollowsRef, {
      followedPages: arrayRemove(pageId),
      updatedAt: serverTimestamp()
    });

    // Decrement the follower count for the page
    const pageRef = doc(db, 'pages', pageId);
    await updateDoc(pageRef, {
      followerCount: increment(-1)
    });

    // Remove the record from the pageFollowers collection
    const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);
    await setDoc(pageFollowerRef, {
      deleted: true,
      deletedAt: serverTimestamp()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Error unfollowing page:', error);
    throw error;
  }
};

/**
 * Check if a user is following a page
 * 
 * @param {string} userId - The ID of the user
 * @param {string} pageId - The ID of the page
 * @returns {Promise<boolean>} - True if the user is following the page
 */
export const isFollowingPage = async (userId, pageId) => {
  if (!userId || !pageId) {
    return false;
  }

  try {
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data();
      return data.followedPages && data.followedPages.includes(pageId);
    }

    return false;
  } catch (error) {
    console.error('Error checking if following page:', error);
    return false;
  }
};

/**
 * Get all pages followed by a user
 * 
 * @param {string} userId - The ID of the user
 * @returns {Promise<Array<string>>} - Array of page IDs
 */
export const getFollowedPages = async (userId) => {
  if (!userId) {
    return [];
  }

  try {
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data();
      return data.followedPages || [];
    }

    return [];
  } catch (error) {
    console.error('Error getting followed pages:', error);
    return [];
  }
};

/**
 * Get the follower count for a page
 * 
 * @param {string} pageId - The ID of the page
 * @returns {Promise<number>} - The number of followers
 */
export const getPageFollowerCount = async (pageId) => {
  if (!pageId) {
    return 0;
  }

  try {
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const data = pageDoc.data();
      return data.followerCount || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting page follower count:', error);
    return 0;
  }
};
