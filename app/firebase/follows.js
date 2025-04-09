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
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const pageData = pageDoc.data();

      // Check if followerCount field exists
      if (typeof pageData.followerCount === 'undefined') {
        // Initialize followerCount to 1 if it doesn't exist
        await updateDoc(pageRef, {
          followerCount: 1
        });

        // Update the page data with the new follower count
        pageData.followerCount = 1;
      } else {
        // Increment existing followerCount
        const newCount = pageData.followerCount + 1;
        await updateDoc(pageRef, {
          followerCount: newCount
        });

        // Update the page data with the new follower count
        pageData.followerCount = newCount;
      }

      // Dispatch a custom event to notify components that follower count has changed
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('followerCountChanged', {
          detail: {
            pageId,
            followerCount: pageData.followerCount
          }
        });
        window.dispatchEvent(event);
      }
    } else {
      // If the page document doesn't exist, we can't follow it
      throw new Error('Page not found');
    }

    // Add a record to the pageFollowers collection
    const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);

    // Check if the document already exists
    const pageFollowerDoc = await getDoc(pageFollowerRef);

    if (pageFollowerDoc.exists()) {
      // If it exists, update it to ensure it's not marked as deleted
      await updateDoc(pageFollowerRef, {
        deleted: false,
        followedAt: serverTimestamp()
      });
    } else {
      // Create a new document with deleted explicitly set to false
      await setDoc(pageFollowerRef, {
        pageId,
        userId,
        deleted: false,
        followedAt: serverTimestamp()
      });
    }

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

    // Check if the document exists first
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      await updateDoc(userFollowsRef, {
        followedPages: arrayRemove(pageId),
        updatedAt: serverTimestamp()
      });
    } else {
      console.warn('User follows document does not exist for user:', userId);
      // Create an empty document if it doesn't exist
      await setDoc(userFollowsRef, {
        followedPages: [],
        updatedAt: serverTimestamp()
      });
    }

    // Decrement the follower count for the page
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const pageData = pageDoc.data();

      // Check if followerCount field exists
      if (typeof pageData.followerCount === 'undefined' || pageData.followerCount <= 0) {
        // If followerCount doesn't exist or is already 0, set it to 0
        await updateDoc(pageRef, {
          followerCount: 0
        });

        // Update the page data with the new follower count
        pageData.followerCount = 0;
      } else {
        // Decrement existing followerCount
        const newCount = Math.max(0, pageData.followerCount - 1);
        await updateDoc(pageRef, {
          followerCount: newCount
        });

        // Update the page data with the new follower count
        pageData.followerCount = newCount;
      }

      // Dispatch a custom event to notify components that follower count has changed
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('followerCountChanged', {
          detail: {
            pageId,
            followerCount: pageData.followerCount
          }
        });
        window.dispatchEvent(event);
      }
    } else {
      // If the page document doesn't exist, we can't unfollow it
      throw new Error('Page not found');
    }

    // Remove the record from the pageFollowers collection
    try {
      const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);

      // Check if the document exists first
      const pageFollowerDoc = await getDoc(pageFollowerRef);

      // If it exists, mark as deleted; if not, create a new deleted record
      if (pageFollowerDoc.exists()) {
        await updateDoc(pageFollowerRef, {
          deleted: true,
          deletedAt: serverTimestamp()
        });
      } else {
        await setDoc(pageFollowerRef, {
          pageId,
          userId,
          deleted: true,
          deletedAt: serverTimestamp(),
          followedAt: serverTimestamp() // Add this for consistency
        });
      }
    } catch (err) {
      // Log but don't throw - we want the unfollow to succeed even if this part fails
      console.warn('Error updating pageFollowers record:', err);
    }

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
    // First check the userFollows collection
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    let isFollowing = false;

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data();
      isFollowing = data.followedPages && data.followedPages.includes(pageId);
    }

    // If not found in userFollows, also check the pageFollowers collection
    // This ensures consistency between the two collections
    if (!isFollowing) {
      const pageFollowerRef = doc(db, 'pageFollowers', `${pageId}_${userId}`);
      const pageFollowerDoc = await getDoc(pageFollowerRef);

      if (pageFollowerDoc.exists()) {
        const data = pageFollowerDoc.data();
        // Only consider it a follow if not marked as deleted
        isFollowing = data.deleted !== true;
      }
    }

    return isFollowing;
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
    // First check the pages collection for the cached follower count
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const data = pageDoc.data();
      // If we have a follower count and it's greater than 0, return it
      if (data.followerCount && data.followerCount > 0) {
        return data.followerCount;
      }
    }

    // If no followers found in the page document or count is 0,
    // check the userFollows collection to get an accurate count
    const userFollowsRef = collection(db, 'userFollows');
    const userFollowsQuery = query(userFollowsRef);
    const userFollowsSnapshot = await getDocs(userFollowsQuery);

    let count = 0;
    userFollowsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.followedPages && data.followedPages.includes(pageId)) {
        count++;
      }
    });

    // Update the page document with the accurate count
    if (pageDoc.exists() && count > 0) {
      await updateDoc(pageRef, {
        followerCount: count
      });
    }

    return count;
  } catch (error) {
    console.error('Error getting page follower count:', error);
    return 0;
  }
};

/**
 * Get the follower count for a page in the last 24 hours
 *
 * @param {string} pageId - The ID of the page
 * @returns {Promise<number>} - The number of followers in the last 24 hours
 */
export const getPageFollowerCount24h = async (pageId) => {
  if (!pageId) {
    return 0;
  }

  try {
    // For now, we'll return a simulated value that's a percentage of the total
    // In a real implementation, you would query the pageFollowers collection with a timestamp filter
    const totalCount = await getPageFollowerCount(pageId);
    // Return a random percentage (30-70%) of the total count to simulate 24h data
    const percentage = 0.3 + (Math.random() * 0.4); // Random between 0.3 and 0.7
    return Math.floor(totalCount * percentage);
  } catch (error) {
    console.error('Error getting 24h follower count:', error);
    return 0;
  }
};

/**
 * Get follower data for sparkline visualization
 * This is a simplified implementation that returns placeholder data
 * In a production environment, you would aggregate this data over time
 * @param {string} pageId - The ID of the page
 * @returns {Promise<Array<number>>} - Array of follower counts for visualization
 */
export const getFollowerSparklineData = async (pageId) => {
  try {
    // For now, we'll generate a simple upward trend based on the current count
    const count = await getPageFollowerCount(pageId);

    // Create an array with a slight upward trend
    const data = [];
    for (let i = 0; i < 24; i++) {
      // Start at around 70% of the current count and increase to the current count
      const factor = 0.7 + (0.3 * (i / 23));
      data.push(Math.max(1, Math.floor(count * factor)));
    }

    return data;
  } catch (error) {
    console.error('Error getting follower sparkline data:', error);
    return Array(24).fill(0);
  }
};

/**
 * Get follower data for the last 24 hours for sparkline visualization
 * @param {string} pageId - The ID of the page
 * @returns {Promise<Array<number>>} - Array of follower counts for the last 24 hours
 */
export const getFollowerSparklineData24h = async (pageId) => {
  try {
    // For now, we'll generate a simple fluctuating pattern based on the 24h count
    const count = await getPageFollowerCount24h(pageId);

    // Create an array with some random fluctuations
    const data = [];
    for (let i = 0; i < 24; i++) {
      // Add some random variation around the count
      const variation = 0.8 + (Math.random() * 0.4); // Random between 0.8 and 1.2
      data.push(Math.max(1, Math.floor(count * variation)));
    }

    return data;
  } catch (error) {
    console.error('Error getting 24h follower sparkline data:', error);
    return Array(24).fill(0);
  }
};

/**
 * Get the count of pages a user follows
 *
 * @param {string} userId - The ID of the user
 * @returns {Promise<number>} - The number of pages the user follows
 */
export const getUserFollowingCount = async (userId) => {
  if (!userId) {
    return 0;
  }

  try {
    const userFollowsRef = doc(db, 'userFollows', userId);
    const userFollowsDoc = await getDoc(userFollowsRef);

    if (userFollowsDoc.exists()) {
      const data = userFollowsDoc.data();
      return data.followedPages?.length || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting user following count:', error);
    return 0;
  }
};

/**
 * Get the count of followers for a user
 * This counts unique users who follow any page created by this user
 *
 * @param {string} userId - The ID of the user
 * @returns {Promise<number>} - The number of unique followers
 */
export const getUserFollowerCount = async (userId) => {
  if (!userId) {
    return 0;
  }

  try {
    // First get all pages created by this user
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    if (pagesSnapshot.empty) {
      return 0;
    }

    // Get all page IDs created by this user
    const pageIds = pagesSnapshot.docs.map(doc => doc.id);

    // For each page, get the followers
    const uniqueFollowers = new Set();

    // Query the pageFollowers collection for all followers of these pages
    // We need to do this in batches since Firestore 'in' queries are limited to 10 items
    const batchSize = 10;
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);

      // We can't query for undefined values in Firestore
      // Instead, we'll query for all followers and filter out deleted ones in code
      const followersQuery = query(
        collection(db, 'pageFollowers'),
        where('pageId', 'in', batch)
      );

      const followersSnapshot = await getDocs(followersQuery);

      // Add each unique follower to the set, filtering out deleted ones
      followersSnapshot.forEach(doc => {
        const data = doc.data();
        // Only count followers where:
        // 1. They have a valid userId
        // 2. It's not a self-follow
        // 3. The follow is not marked as deleted (deleted === false or deleted field doesn't exist)
        if (data.userId &&
            data.userId !== userId &&
            (data.deleted === false || data.deleted === undefined)) {
          uniqueFollowers.add(data.userId);
        }
      });
    }

    return uniqueFollowers.size;
  } catch (error) {
    console.error('Error getting user follower count:', error);
    return 0;
  }
};

/**
 * Unfollow all pages by a specific user
 * This is useful for removing self-follows
 *
 * @param {string} userId - The ID of the user
 * @returns {Promise<{success: boolean, count: number}>} - Result with success status and count of unfollowed pages
 */
export const unfollowAllPagesByUser = async (userId) => {
  if (!userId) {
    return { success: false, count: 0 };
  }

  try {
    // Get all pages the user is following
    const followedPages = await getFollowedPages(userId);

    if (followedPages.length === 0) {
      return { success: true, count: 0 };
    }

    // Get all pages created by this user
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);
    const userPageIds = pagesSnapshot.docs.map(doc => doc.id);

    // Find self-follows (pages created by the user that they are also following)
    const selfFollows = followedPages.filter(pageId => userPageIds.includes(pageId));

    if (selfFollows.length === 0) {
      return { success: true, count: 0 };
    }

    // Unfollow each self-followed page
    const unfollowPromises = selfFollows.map(pageId => unfollowPage(userId, pageId));
    await Promise.all(unfollowPromises);

    return { success: true, count: selfFollows.length };
  } catch (error) {
    console.error('Error unfollowing all pages by user:', error);
    return { success: false, count: 0 };
  }
};
