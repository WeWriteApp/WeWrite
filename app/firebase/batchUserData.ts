"use client";

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  DocumentData 
} from "firebase/firestore";
import { db } from "./config";
import { rtdb } from "./rtdb";
import { ref, get } from "firebase/database";
import { getCacheItem, setCacheItem, generateCacheKey } from "../utils/cacheUtils";

// Cache TTL for user data (10 minutes)
const USER_DATA_CACHE_TTL = 10 * 60 * 1000;

// In-memory cache for frequently accessed user data
const userDataMemoryCache = new Map<string, {
  data: UserData;
  timestamp: number;
}>();

const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface UserData {
  uid: string;
  username?: string;
  displayName?: string;
  email?: string;
  tier?: string;
  subscriptionStatus?: string;
  pageCount?: number;
  followerCount?: number;
  viewCount?: number;
}

/**
 * Batch fetch user data for multiple users efficiently
 * Uses Firestore batch queries with fallback to RTDB
 */
export const getBatchUserData = async (userIds: string[]): Promise<Record<string, UserData>> => {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  console.log(`getBatchUserData: Fetching data for ${userIds.length} users`);
  
  const results: Record<string, UserData> = {};
  const uncachedIds: string[] = [];
  
  // Check memory cache first
  userIds.forEach(userId => {
    const cached = userDataMemoryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
      results[userId] = cached.data;
    } else {
      uncachedIds.push(userId);
    }
  });

  if (uncachedIds.length === 0) {
    console.log('getBatchUserData: All data found in memory cache');
    return results;
  }

  console.log(`getBatchUserData: ${uncachedIds.length} users not in memory cache`);

  // Check localStorage cache
  const stillUncachedIds: string[] = [];
  
  for (const userId of uncachedIds) {
    const cacheKey = generateCacheKey('userData', userId);
    const cachedData = getCacheItem(cacheKey);
    
    if (cachedData) {
      results[userId] = cachedData;
      // Also update memory cache
      userDataMemoryCache.set(userId, {
        data: cachedData,
        timestamp: Date.now()
      });
    } else {
      stillUncachedIds.push(userId);
    }
  }

  if (stillUncachedIds.length === 0) {
    console.log('getBatchUserData: All remaining data found in localStorage cache');
    return results;
  }

  console.log(`getBatchUserData: Fetching ${stillUncachedIds.length} users from database`);

  // Batch fetch from Firestore (max 10 per query due to 'in' limitation)
  const batchSize = 10;
  
  for (let i = 0; i < stillUncachedIds.length; i += batchSize) {
    const batch = stillUncachedIds.slice(i, i + batchSize);
    
    try {
      // Fetch user profiles from Firestore
      const usersQuery = query(
        collection(db, 'users'),
        where('__name__', 'in', batch)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      // Fetch subscription data in parallel using correct path
      const subscriptionPromises = batch.map(async (userId) => {
        try {
          const subDoc = await getDoc(doc(db, 'users', userId, 'subscription', 'current'));
          return {
            userId,
            subscription: subDoc.exists() ? subDoc.data() : null
          };
        } catch (error) {
          console.warn(`Error fetching subscription for user ${userId}:`, error);
          return { userId, subscription: null };
        }
      });
      
      const subscriptionResults = await Promise.all(subscriptionPromises);
      const subscriptionMap = new Map(
        subscriptionResults.map(result => [result.userId, result.subscription])
      );

      // Process Firestore results
      const firestoreUserIds = new Set<string>();
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const subscription = subscriptionMap.get(doc.id);
        
        const user: UserData = {
          uid: doc.id,
          username: userData.username,
          displayName: userData.displayName,
          email: userData.email,
          tier: subscription?.tier,
          subscriptionStatus: subscription?.status,
          pageCount: userData.pageCount || 0,
          followerCount: userData.followerCount || 0,
          viewCount: userData.viewCount || 0
        };
        
        results[doc.id] = user;
        firestoreUserIds.add(doc.id);
        
        // Cache the result
        const cacheKey = generateCacheKey('userData', doc.id);
        setCacheItem(cacheKey, user, USER_DATA_CACHE_TTL);
        
        // Update memory cache
        userDataMemoryCache.set(doc.id, {
          data: user,
          timestamp: Date.now()
        });
      });

      // Fallback to RTDB for users not found in Firestore
      const rtdbUserIds = batch.filter(id => !firestoreUserIds.has(id));
      
      if (rtdbUserIds.length > 0) {
        console.log(`getBatchUserData: Falling back to RTDB for ${rtdbUserIds.length} users`);
        
        const rtdbPromises = rtdbUserIds.map(async (userId) => {
          try {
            const userRef = ref(rtdb, `users/${userId}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
              const userData = snapshot.val();
              const user: UserData = {
                uid: userId,
                username: userData.username || userData.displayName || 
                         (userData.email ? userData.email.split('@')[0] : undefined),
                displayName: userData.displayName,
                email: userData.email,
                pageCount: userData.pageCount || 0,
                followerCount: userData.followerCount || 0,
                viewCount: userData.viewCount || 0
              };
              
              return { userId, user };
            }
            
            return { userId, user: null };
          } catch (error) {
            console.warn(`Error fetching user ${userId} from RTDB:`, error);
            return { userId, user: null };
          }
        });
        
        const rtdbResults = await Promise.all(rtdbPromises);
        
        rtdbResults.forEach(({ userId, user }) => {
          if (user) {
            results[userId] = user;

            // Cache the result
            const cacheKey = generateCacheKey('userData', userId);
            setCacheItem(cacheKey, user, USER_DATA_CACHE_TTL);

            // Update memory cache
            userDataMemoryCache.set(userId, {
              data: user,
              timestamp: Date.now()
            });
          }
        });
      }
      
    } catch (error) {
      console.error(`Error fetching batch ${i}-${i + batchSize}:`, error);
      
      // Create fallback user data for failed fetches
      batch.forEach(userId => {
        if (!results[userId]) {
          results[userId] = {
            uid: userId,
            username: 'Unknown User'
          };
        }
      });
    }
  }

  console.log(`getBatchUserData: Successfully fetched data for ${Object.keys(results).length} users`);
  return results;
};

/**
 * Get single user data with caching
 */
export const getSingleUserData = async (userId: string): Promise<UserData | null> => {
  if (!userId) return null;
  
  const batchResult = await getBatchUserData([userId]);
  return batchResult[userId] || null;
};

/**
 * Clear user data cache (useful for testing or when user data changes)
 */
export const clearUserDataCache = (userId?: string) => {
  if (userId) {
    userDataMemoryCache.delete(userId);
    const cacheKey = generateCacheKey('userData', userId);
    localStorage.removeItem(cacheKey);
  } else {
    userDataMemoryCache.clear();
    // Clear all user data from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('wewrite_userData_')) {
        localStorage.removeItem(key);
      }
    });
  }
};

/**
 * Preload user data for better performance
 */
export const preloadUserData = async (userIds: string[]) => {
  // Fire and forget - don't wait for the result
  getBatchUserData(userIds).catch(error => {
    console.warn('Error preloading user data:', error);
  });
};