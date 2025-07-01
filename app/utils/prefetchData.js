"use client";

import { db } from "../firebase/config";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { getFollowedPages } from "../firebase/follows";
import { generateCacheKey, setCacheItem } from "./cacheUtils";

/**
 * Prefetch critical data for the authenticated user
 * This function is called after successful authentication to preload data
 * that will be needed on the home page
 * 
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<void>}
 */
export const prefetchUserData = async (userId) => {
  if (!userId) return;
  
  console.log('Prefetching data for user:', userId);
  
  try {
    // Prefetch user's pages
    await prefetchUserPages(userId);
    
    // Prefetch recent activity
    await prefetchRecentActivity(userId);
    
    // Prefetch followed pages
    await prefetchFollowedPages(userId);
    
    console.log('Data prefetching complete for user:', userId);
  } catch (error) {
    console.error('Error prefetching user data:', error);
  }
};

/**
 * Prefetch the user's pages
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
const prefetchUserPages = async (userId) => {
  try {
    // Query to get the user's pages (exclude deleted pages)
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(pagesQuery);
    
    if (snapshot.empty) {
      return;
    }
    
    const publicPages = [];
    const privatePages = [];
    
    snapshot.forEach((doc) => {
      const pageData = { id: doc.id, ...doc.data() };
      
      if (pageData.isPublic) {
        publicPages.push(pageData);
      } else {
        privatePages.push(pageData);
      }
    });
    
    // Cache the results
    const cacheKey = generateCacheKey('pages', userId, 'all_' + userId);
    const cacheData = {
      public: publicPages,
      private: privatePages,
      hasMorePublic: publicPages.length >= 20,
      hasMorePrivate: privatePages.length >= 20
    };
    
    setCacheItem(cacheKey, cacheData, 5 * 60 * 1000); // Cache for 5 minutes
    
    console.log(`Prefetched ${publicPages.length} public and ${privatePages.length} private pages for user:`, userId);
  } catch (error) {
    console.error('Error prefetching user pages:', error);
  }
};

/**
 * Prefetch recent activity data
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
const prefetchRecentActivity = async (userId) => {
  try {
    // Query to get recent public pages (exclude deleted pages)
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(pagesQuery);
    
    if (snapshot.empty) {
      return;
    }
    
    // Process the results (simplified version of what useHomeRecentActivity does)
    const activities = snapshot.docs
      .map(doc => {
        const data = doc.data();

        // TEMPORARY FIX: Filter out deleted pages on the client side
        // since we removed the server-side filter to avoid failed-precondition errors
        if (data.deleted === true) return null;

        return {
          id: doc.id,
          pageId: doc.id,
          title: data.title || 'Untitled',
          content: data.content || '',
          userId: data.userId,
          authorName: data.authorName || 'Anonymous',
          lastModified: data.lastModified,
          isPublic: data.isPublic
        };
      })
      .filter(activity => activity !== null); // Remove null entries
    
    // Cache the results
    const cacheKey = `home_activity_${userId || 'anonymous'}_all_10`;
    setCacheItem(cacheKey, activities, (5 * 60 * 1000)); // Cache for 5 minutes
    
    console.log(`Prefetched ${activities.length} recent activities`);
  } catch (error) {
    console.error('Error prefetching recent activity:', error);
  }
};

/**
 * Prefetch the user's followed pages
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
const prefetchFollowedPages = async (userId) => {
  try {
    // Get the list of pages the user follows
    const followedPageIds = await getFollowedPages(userId);
    
    if (followedPageIds.length === 0) {
      return;
    }
    
    // Cache the followed page IDs
    const followCacheKey = `followed_pages_${userId}`;
    setCacheItem(followCacheKey, followedPageIds, 5 * 60 * 1000); // 5 minutes
    
    console.log(`Prefetched ${followedPageIds.length} followed page IDs for user:`, userId);
  } catch (error) {
    console.error('Error prefetching followed pages:', error);
  }
};

export default prefetchUserData;