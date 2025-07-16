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
import { getEffectiveTier } from "../utils/subscriptionTiers";

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
  email?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
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

  console.log(`getBatchUserData: Fetching data for ${userIds.length} users via API`);

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



  // Use API endpoint to fetch user data with subscription information
  try {
    const response = await fetch('/api/users/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIds: uncachedIds }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const apiData = await response.json();

    // Process API response and update caches
    // The API returns data in format: { success: true, data: { users: { userId: userData }, count: number } }
    const usersData = apiData.data?.users || {};

    uncachedIds.forEach(userId => {
      const userData = usersData[userId];
      if (userData) {
        results[userId] = userData;

        // Update memory cache
        userDataMemoryCache.set(userId, {
          data: userData,
          timestamp: Date.now()
        });

        // Update localStorage cache
        const cacheKey = generateCacheKey('userData', userId);
        setCacheItem(cacheKey, userData, USER_DATA_CACHE_TTL);
      }
    });


    return results;

  } catch (error) {
    console.error('Error fetching user data via API:', error);

    // Create fallback user data for failed fetches
    uncachedIds.forEach(userId => {
      if (!results[userId]) {
        results[userId] = {
          uid: userId,
          username: 'Unknown User'
        };
      }
    });

    return results;
  }
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