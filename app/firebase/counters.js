"use client";

import { db, rtdb } from './config';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, sum } from 'firebase/firestore';
import { ref, get, set, onValue } from 'firebase/database';
import { getCacheItem, setCacheItem } from '../utils/cacheUtils';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get the page count for a user with caching
 *
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - The page count
 */
export const getUserPageCount = async (userId) => {
  if (!userId) return 0;

  try {
    // Check cache first
    const cacheKey = `user_page_count_${userId}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount;
    }

    // If not in cache, get from database
    // First check if we have a counter document
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    const counterDoc = await getDoc(counterDocRef);

    if (counterDoc.exists() && counterDoc.data().pageCount !== undefined) {
      // We have a counter, use it
      const count = counterDoc.data().pageCount;
      setCacheItem(cacheKey, count, CACHE_TTL);
      return count;
    }

    // No counter document, count pages manually
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);
    const count = pagesSnapshot.size;

    // Store the count in the counter document for future use
    await setDoc(counterDocRef, {
      pageCount: count,
      lastUpdated: new Date()
    }, { merge: true });

    // Cache the result
    setCacheItem(cacheKey, count, CACHE_TTL);

    return count;
  } catch (error) {
    console.error('Error getting user page count:', error);
    return 0;
  }
};

/**
 * Get the follower count for a user with caching
 *
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - The follower count
 */
export const getUserFollowerCount = async (userId) => {
  if (!userId) return 0;

  try {
    // Check cache first
    const cacheKey = `user_follower_count_${userId}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount;
    }

    // If not in cache, get from database
    // First check if we have a counter document
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    const counterDoc = await getDoc(counterDocRef);

    if (counterDoc.exists() && counterDoc.data().followerCount !== undefined) {
      // We have a counter, use it
      const count = counterDoc.data().followerCount;
      setCacheItem(cacheKey, count, CACHE_TTL);
      return count;
    }

    // No counter document, count followers manually
    // First get all pages created by this user
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    if (pagesSnapshot.empty) {
      setCacheItem(cacheKey, 0, CACHE_TTL);
      return 0;
    }

    // Get all page IDs created by this user
    const pageIds = pagesSnapshot.docs.map(doc => doc.id);

    // For each page, get the followers
    const uniqueFollowers = new Set();

    for (const pageId of pageIds) {
      const followersRef = collection(db, 'pages', pageId, 'followers');
      const followersSnapshot = await getDocs(followersRef);

      followersSnapshot.forEach(doc => {
        uniqueFollowers.add(doc.id);
      });
    }

    const count = uniqueFollowers.size;

    // Store the count in the counter document for future use
    await setDoc(counterDocRef, {
      followerCount: count,
      lastUpdated: new Date()
    }, { merge: true });

    // Cache the result
    setCacheItem(cacheKey, count, CACHE_TTL);

    return count;
  } catch (error) {
    console.error('Error getting user follower count:', error);
    return 0;
  }
};

/**
 * Increment the page count for a user
 *
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export const incrementUserPageCount = async (userId) => {
  if (!userId) return;

  try {
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    await updateDoc(counterDocRef, {
      pageCount: increment(1),
      lastUpdated: new Date()
    });

    // Invalidate cache
    localStorage.removeItem(`user_page_count_${userId}`);
  } catch (error) {
    // If the document doesn't exist, create it
    if (error.code === 'not-found') {
      await setDoc(counterDocRef, {
        pageCount: 1,
        lastUpdated: new Date()
      });
    } else {
      console.error('Error incrementing user page count:', error);
    }
  }
};

/**
 * Decrement the page count for a user
 *
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export const decrementUserPageCount = async (userId) => {
  if (!userId) return;

  try {
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    await updateDoc(counterDocRef, {
      pageCount: increment(-1),
      lastUpdated: new Date()
    });

    // Invalidate cache
    localStorage.removeItem(`user_page_count_${userId}`);
  } catch (error) {
    console.error('Error decrementing user page count:', error);
  }
};

/**
 * Get the total view count for a user with caching
 *
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - The total view count
 */
export const getUserTotalViewCount = async (userId) => {
  if (!userId) return 0;

  try {
    // Check cache first
    const cacheKey = `user_view_count_${userId}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount;
    }

    // If not in cache, get from database
    // First check if we have a counter document
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    const counterDoc = await getDoc(counterDocRef);

    if (counterDoc.exists() && counterDoc.data().viewCount !== undefined) {
      // We have a counter, use it
      const count = counterDoc.data().viewCount;
      setCacheItem(cacheKey, count, CACHE_TTL);
      return count;
    }

    // No counter document, calculate total views manually
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId)
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    if (pagesSnapshot.empty) {
      setCacheItem(cacheKey, 0, CACHE_TTL);
      return 0;
    }

    // Sum up the view counts of all pages
    let totalViews = 0;
    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();
      totalViews += pageData.viewCount || 0;
    });

    // Store the count in the counter document for future use
    await setDoc(counterDocRef, {
      viewCount: totalViews,
      lastUpdated: new Date()
    }, { merge: true });

    // Cache the result
    setCacheItem(cacheKey, totalViews, CACHE_TTL);

    return totalViews;
  } catch (error) {
    console.error('Error getting user total view count:', error);
    return 0;
  }
};
