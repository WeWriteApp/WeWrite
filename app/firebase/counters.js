"use client";

import { db, rtdb } from './config';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, sum } from 'firebase/firestore';
import { ref, get, set, onValue } from 'firebase/database';
import { getCacheItem, setCacheItem, generateCacheKey } from '../utils/cacheUtils';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Invalidate TopUsers cache to ensure fresh data after page count changes
 */
const invalidateTopUsersCache = () => {
  try {
    // Clear TopUsers cache for all users (anonymous and authenticated)
    const anonymousCacheKey = generateCacheKey('topUsers', 'anonymous');
    setCacheItem(anonymousCacheKey, null, 0);

    // Clear cache for any authenticated users (we can't know all user IDs, but this covers the most common case)
    // The cache will naturally refresh when users visit the page
    console.log('TopUsers cache invalidated due to page count change');
  } catch (error) {
    console.error('Error invalidating TopUsers cache:', error);
  }
};

/**
 * Get the page count for a user with caching
 *
 * @param {string} userId - The user ID
 * @param {string} viewerUserId - The ID of the user viewing the profile (optional)
 * @returns {Promise<number>} - The page count
 */
export const getUserPageCount = async (userId, viewerUserId = null) => {
  if (!userId) return 0;

  try {
    // Determine if the viewer is the owner
    const isOwner = viewerUserId && userId === viewerUserId;

    // Create different cache keys for owner vs visitor views
    const cacheKey = `user_page_count_${userId}_${isOwner ? 'owner' : 'public'}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount;
    }

    // If not in cache, get from database
    let count = 0;

    if (isOwner) {
      // For owners, show total count (public + private)
      // First check if we have a counter document for total count
      const counterDocRef = doc(db, 'counters', `user_${userId}`);
      const counterDoc = await getDoc(counterDocRef);

      if (counterDoc.exists() && counterDoc.data().pageCount !== undefined) {
        // We have a counter, use it
        count = counterDoc.data().pageCount;
      } else {
        // No counter document, count all pages manually
        const pagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId)
        );

        const pagesSnapshot = await getDocs(pagesQuery);
        count = pagesSnapshot.size;

        // Store the total count in the counter document for future use
        await setDoc(counterDocRef, {
          pageCount: count,
          lastUpdated: new Date()
        }, { merge: true });
      }
    } else {
      // For visitors, show only public page count
      // Check if we have a public counter document
      const publicCounterDocRef = doc(db, 'counters', `user_${userId}_public`);
      const publicCounterDoc = await getDoc(publicCounterDocRef);

      if (publicCounterDoc.exists() && publicCounterDoc.data().pageCount !== undefined) {
        // We have a public counter, use it
        count = publicCounterDoc.data().pageCount;
      } else {
        // No public counter document, count public pages manually
        const publicPagesQuery = query(
          collection(db, 'pages'),
          where('userId', '==', userId),
          where('isPublic', '==', true)
        );

        const publicPagesSnapshot = await getDocs(publicPagesQuery);
        count = publicPagesSnapshot.size;

        // Store the public count in a separate counter document
        await setDoc(publicCounterDocRef, {
          pageCount: count,
          lastUpdated: new Date()
        }, { merge: true });
      }
    }

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
 * @param {boolean} isPublic - Whether the page is public
 * @returns {Promise<void>}
 */
export const incrementUserPageCount = async (userId, isPublic = true) => {
  if (!userId) return;

  try {
    // Always increment the total counter
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    await updateDoc(counterDocRef, {
      pageCount: increment(1),
      lastUpdated: new Date()
    });

    // If the page is public, also increment the public counter
    if (isPublic) {
      const publicCounterDocRef = doc(db, 'counters', `user_${userId}_public`);
      await updateDoc(publicCounterDocRef, {
        pageCount: increment(1),
        lastUpdated: new Date()
      });
    }

    // Invalidate both caches
    localStorage.removeItem(`user_page_count_${userId}_owner`);
    localStorage.removeItem(`user_page_count_${userId}_public`);

    // Invalidate TopUsers cache since page counts changed
    invalidateTopUsersCache();
  } catch (error) {
    // If the document doesn't exist, create it
    if (error.code === 'not-found') {
      await setDoc(counterDocRef, {
        pageCount: 1,
        lastUpdated: new Date()
      });

      // Also create public counter if the page is public
      if (isPublic) {
        const publicCounterDocRef = doc(db, 'counters', `user_${userId}_public`);
        await setDoc(publicCounterDocRef, {
          pageCount: 1,
          lastUpdated: new Date()
        });
      }

      // Invalidate TopUsers cache since page counts changed
      invalidateTopUsersCache();
    } else {
      console.error('Error incrementing user page count:', error);
    }
  }
};

/**
 * Decrement the page count for a user
 *
 * @param {string} userId - The user ID
 * @param {boolean} wasPublic - Whether the deleted page was public
 * @returns {Promise<void>}
 */
export const decrementUserPageCount = async (userId, wasPublic = true) => {
  if (!userId) return;

  try {
    // Always decrement the total counter
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    await updateDoc(counterDocRef, {
      pageCount: increment(-1),
      lastUpdated: new Date()
    });

    // If the page was public, also decrement the public counter
    if (wasPublic) {
      const publicCounterDocRef = doc(db, 'counters', `user_${userId}_public`);
      await updateDoc(publicCounterDocRef, {
        pageCount: increment(-1),
        lastUpdated: new Date()
      });
    }

    // Invalidate both caches
    localStorage.removeItem(`user_page_count_${userId}_owner`);
    localStorage.removeItem(`user_page_count_${userId}_public`);

    // Invalidate TopUsers cache since page counts changed
    invalidateTopUsersCache();
  } catch (error) {
    console.error('Error decrementing user page count:', error);
  }
};

/**
 * Update page count when a page's visibility changes
 *
 * @param {string} userId - The user ID
 * @param {boolean} wasPublic - Whether the page was previously public
 * @param {boolean} isNowPublic - Whether the page is now public
 * @returns {Promise<void>}
 */
export const updateUserPageCountForVisibilityChange = async (userId, wasPublic, isNowPublic) => {
  if (!userId || wasPublic === isNowPublic) return; // No change needed

  try {
    const publicCounterDocRef = doc(db, 'counters', `user_${userId}_public`);

    if (wasPublic && !isNowPublic) {
      // Page was made private - decrement public counter
      await updateDoc(publicCounterDocRef, {
        pageCount: increment(-1),
        lastUpdated: new Date()
      });
    } else if (!wasPublic && isNowPublic) {
      // Page was made public - increment public counter
      await updateDoc(publicCounterDocRef, {
        pageCount: increment(1),
        lastUpdated: new Date()
      });
    }

    // Invalidate both caches
    localStorage.removeItem(`user_page_count_${userId}_owner`);
    localStorage.removeItem(`user_page_count_${userId}_public`);

    // Invalidate TopUsers cache since page counts changed
    invalidateTopUsersCache();
  } catch (error) {
    // If the document doesn't exist, create it with the appropriate count
    if (error.code === 'not-found' && isNowPublic) {
      // Count existing public pages and create the counter
      const publicPagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', userId),
        where('isPublic', '==', true)
      );

      const publicPagesSnapshot = await getDocs(publicPagesQuery);
      const count = publicPagesSnapshot.size;

      await setDoc(publicCounterDocRef, {
        pageCount: count,
        lastUpdated: new Date()
      });
    } else {
      console.error('Error updating user page count for visibility change:', error);
    }
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
