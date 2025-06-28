"use client";

import { db, rtdb } from './config';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, sum } from 'firebase/firestore';
import { ref, get, set, onValue } from 'firebase/database';
import { getCacheItem, setCacheItem, generateCacheKey } from "../utils/cacheUtils";
import type { Counter, MemoryCacheEntry } from '../types/database';
import { AnalyticsAggregationService } from '../services/analyticsAggregation';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = (5 * 60 * 1000);

// OPTIMIZATION: Add in-memory cache for frequently accessed page counts
const pageCountMemoryCache = new Map<string, MemoryCacheEntry<number>>();
const MEMORY_CACHE_TTL = (2 * 60 * 1000); // 2 minutes in memory cache



/**
 * Get the page count for a user with caching
 *
 * @param userId - The user ID
 * @param viewerUserId - The ID of the user viewing the profile (optional)
 * @returns The page count
 */
export const getUserPageCount = async (userId: string, viewerUserId: string | null = null): Promise<number> => {
  if (!userId) return 0;

  try {
    // Determine if the viewer is the owner
    const isOwner = viewerUserId && userId === viewerUserId;

    // Create different cache keys for owner vs visitor views
    const cacheKey = `user_page_count_${userId}_${isOwner ? 'owner' : 'public'}`;

    // OPTIMIZATION: Check in-memory cache first (fastest)
    const memoryCacheEntry = pageCountMemoryCache.get(cacheKey);
    if (memoryCacheEntry && (Date.now() - memoryCacheEntry.timestamp) < MEMORY_CACHE_TTL) {
      return memoryCacheEntry.count;
    }

    // Check localStorage cache second
    const cachedCount = getCacheItem(cacheKey);
    if (cachedCount !== null) {
      // Store in memory cache for faster future access
      pageCountMemoryCache.set(cacheKey, { count: cachedCount as number, timestamp: Date.now() });
      return cachedCount as number;
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

    // Cache the result in both localStorage and memory
    setCacheItem(cacheKey, count, CACHE_TTL);
    pageCountMemoryCache.set(cacheKey, { count, timestamp: Date.now() });

    return count;
  } catch (error) {
    console.error('Error getting user page count:', error);
    return 0;
  }
};

/**
 * Get the follower count for a user with caching
 *
 * @param userId - The user ID
 * @returns The follower count
 */
export const getUserFollowerCount = async (userId: string): Promise<number> => {
  if (!userId) return 0;

  try {
    // Check cache first
    const cacheKey = `user_follower_count_${userId}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount as number;
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
 * @param userId - The user ID
 * @param isPublic - Whether the page is public
 */
export const incrementUserPageCount = async (userId: string, isPublic: boolean = true): Promise<void> => {
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

    // Update global analytics counters
    try {
      await AnalyticsAggregationService.incrementPageCreated(isPublic);
    } catch (analyticsError) {
      console.error('Error updating analytics counters (non-fatal):', analyticsError);
    }

    // Invalidate both localStorage and memory caches
    localStorage.removeItem(`user_page_count_${userId}_owner`);
    localStorage.removeItem(`user_page_count_${userId}_public`);
    pageCountMemoryCache.delete(`user_page_count_${userId}_owner`);
    pageCountMemoryCache.delete(`user_page_count_${userId}_public`);

  } catch (error: any) {
    // If the document doesn't exist, create it
    if (error.code === 'not-found') {
      const counterDocRef = doc(db, 'counters', `user_${userId}`);
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

      // Update global analytics counters for new counter creation
      try {
        await AnalyticsAggregationService.incrementPageCreated(isPublic);
      } catch (analyticsError) {
        console.error('Error updating analytics counters (non-fatal):', analyticsError);
      }
    } else {
      console.error('Error incrementing user page count:', error);
    }
  }
};

/**
 * Decrement the page count for a user
 *
 * @param userId - The user ID
 * @param wasPublic - Whether the deleted page was public
 */
export const decrementUserPageCount = async (userId: string, wasPublic: boolean = true): Promise<void> => {
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

    // Update global analytics counters
    try {
      await AnalyticsAggregationService.incrementPageDeleted(wasPublic);
    } catch (analyticsError) {
      console.error('Error updating analytics counters (non-fatal):', analyticsError);
    }

    // Invalidate both localStorage and memory caches
    localStorage.removeItem(`user_page_count_${userId}_owner`);
    localStorage.removeItem(`user_page_count_${userId}_public`);
    pageCountMemoryCache.delete(`user_page_count_${userId}_owner`);
    pageCountMemoryCache.delete(`user_page_count_${userId}_public`);


  } catch (error) {
    console.error('Error decrementing user page count:', error);
  }
};

/**
 * Update page count when a page's visibility changes
 *
 * @param userId - The user ID
 * @param wasPublic - Whether the page was previously public
 * @param isNowPublic - Whether the page is now public
 */
export const updateUserPageCountForVisibilityChange = async (
  userId: string,
  wasPublic: boolean,
  isNowPublic: boolean
): Promise<void> => {
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

    // Invalidate both localStorage and memory caches
    localStorage.removeItem(`user_page_count_${userId}_owner`);
    localStorage.removeItem(`user_page_count_${userId}_public`);
    pageCountMemoryCache.delete(`user_page_count_${userId}_owner`);
    pageCountMemoryCache.delete(`user_page_count_${userId}_public`);


  } catch (error: any) {
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

      const publicCounterDocRef = doc(db, 'counters', `user_${userId}_public`);
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
 * @param userId - The user ID
 * @returns The total view count
 */
export const getUserTotalViewCount = async (userId: string): Promise<number> => {
  if (!userId) return 0;

  try {
    // Check cache first
    const cacheKey = `user_view_count_${userId}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount as number;
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

/**
 * Get the contributor count for a user with caching
 * Contributors are unique users with active pledges to this user's pages
 *
 * @param userId - The user ID (page author)
 * @returns The contributor count
 */
export const getUserContributorCount = async (userId: string): Promise<number> => {
  if (!userId) return 0;

  try {
    // Check cache first
    const cacheKey = `user_contributor_count_${userId}`;
    const cachedCount = getCacheItem(cacheKey);

    if (cachedCount !== null) {
      return cachedCount as number;
    }

    // If not in cache, get from database
    // First check if we have a counter document
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    const counterDoc = await getDoc(counterDocRef);

    if (counterDoc.exists() && counterDoc.data().contributorCount !== undefined) {
      // We have a counter, use it
      const count = counterDoc.data().contributorCount;
      setCacheItem(cacheKey, count, CACHE_TTL);
      return count;
    }

    // No counter document, calculate contributors manually
    // Query pledges where this user is the recipient (page author)
    const pledgesQuery = query(
      collection(db, 'pledges'),
      where('metadata.authorUserId', '==', userId),
      where('status', 'in', ['active', 'completed'])
    );

    const pledgesSnapshot = await getDocs(pledgesQuery);

    if (pledgesSnapshot.empty) {
      setCacheItem(cacheKey, 0, CACHE_TTL);
      return 0;
    }

    // Count unique contributors (pledgers)
    const uniqueContributors = new Set();
    pledgesSnapshot.forEach(doc => {
      const pledgeData = doc.data();
      if (pledgeData.userId) {
        uniqueContributors.add(pledgeData.userId);
      }
    });

    const count = uniqueContributors.size;

    // Store the count in the counter document for future use
    await setDoc(counterDocRef, {
      contributorCount: count,
      lastUpdated: new Date()
    }, { merge: true });

    // Cache the result
    setCacheItem(cacheKey, count, CACHE_TTL);

    return count;
  } catch (error) {
    console.error('Error getting user contributor count:', error);
    return 0;
  }
};

/**
 * Recalculate and update the contributor count for a user
 * This should be called when pledges are added, removed, or status changes
 *
 * @param userId - The user ID (page author)
 */
export const updateUserContributorCount = async (userId: string): Promise<void> => {
  if (!userId) return;

  try {
    // Query pledges where this user is the recipient (page author)
    const pledgesQuery = query(
      collection(db, 'pledges'),
      where('metadata.authorUserId', '==', userId),
      where('status', 'in', ['active', 'completed'])
    );

    const pledgesSnapshot = await getDocs(pledgesQuery);

    // Count unique contributors (pledgers)
    const uniqueContributors = new Set();
    pledgesSnapshot.forEach(doc => {
      const pledgeData = doc.data();
      if (pledgeData.userId) {
        uniqueContributors.add(pledgeData.userId);
      }
    });

    const count = uniqueContributors.size;

    // Update the counter document
    const counterDocRef = doc(db, 'counters', `user_${userId}`);
    await setDoc(counterDocRef, {
      contributorCount: count,
      lastUpdated: new Date()
    }, { merge: true });

    // Invalidate cache
    const cacheKey = `user_contributor_count_${userId}`;
    localStorage.removeItem(cacheKey);

  } catch (error) {
    console.error('Error updating user contributor count:', error);
  }
};
