"use client";

// Removed Firebase imports - now using API endpoints
import { UNIFIED_CACHE_TTL } from '../utils/unifiedCache';

// Cache configuration - using unified cache TTL
const CACHE_EXPIRY = UNIFIED_CACHE_TTL.PAGE_DATA; // Use unified page data TTL
const CACHE_KEY_PREFIX = 'wewrite_pages_';

/**
 * In-memory cache for pages data
 * Structure:
 * {
 *   [cacheKey]: {
 *     data: Array<PageData>,
 *     timestamp: number,
 *     lastKey: DocumentSnapshot | null
 *   }
 * }
 */
const memoryCache = {};

/**
 * Generate a cache key based on query parameters
 */
const generateCacheKey = (userId, isPublic = null, isOwner = false, pageLimit = 20) => {
  return `${CACHE_KEY_PREFIX}${userId}_${isPublic === null ? 'all' : isPublic ? 'public' : 'private'}_${isOwner ? 'owner' : 'visitor'}_${pageLimit}`;
};

/**
 * Check if cache is valid (exists and not expired)
 */
const isCacheValid = (cacheKey) => {
  const cacheEntry = memoryCache[cacheKey];
  if (!cacheEntry) return false;

  const now = Date.now();
  return (now - cacheEntry.timestamp) < CACHE_EXPIRY;
};

/**
 * Store data in both memory cache and localStorage
 */
const cacheData = (cacheKey, data, lastKey = null) => {
  // Store in memory cache
  memoryCache[cacheKey] = {
    data,
    timestamp: Date.now(),
    lastKey
  };

  // Also store in localStorage for persistence across page refreshes
  try {
    const storageData = {
      data,
      timestamp: Date.now(),
      // We can't store the lastKey in localStorage as it's a complex object
      hasMore: !!lastKey
    };
    localStorage.setItem(cacheKey, JSON.stringify(storageData));
  } catch (e) {
    console.warn('Failed to cache pages data in localStorage:', e);
  }
};

/**
 * Get cached data from memory or localStorage
 */
const getCachedData = (cacheKey) => {
  // First try memory cache
  if (memoryCache[cacheKey]) {
    return memoryCache[cacheKey];
  }

  // Then try localStorage
  try {
    const storedData = localStorage.getItem(cacheKey);
    if (storedData) {
      const parsed = JSON.parse(storedData);
      // Check if the data is still valid
      if ((Date.now() - parsed.timestamp) < CACHE_EXPIRY) {
        // We can't restore the lastKey from localStorage, but we can indicate if there's more
        return {
          data: parsed.data,
          timestamp: parsed.timestamp,
          lastKey: null, // Can't restore this from localStorage
          hasMore: parsed.hasMore
        };
      }
    }
  } catch (e) {
    console.warn('Failed to retrieve cached pages from localStorage:', e);
  }

  return null;
};

/**
 * Fetch pages with optimized caching - now using API endpoint
 */
export const fetchPages = async (userId, isPublic = null, currentUserId = null, pageLimit = 20, startAfterDoc = null) => {
  // Determine if current user is the owner
  const isOwner = currentUserId && userId === currentUserId;

  // Generate cache key
  const cacheKey = generateCacheKey(userId, isPublic, isOwner, pageLimit);

  // If we're not paginating and cache is valid, return cached data
  if (!startAfterDoc && isCacheValid(cacheKey)) {
    console.log('Using cached pages data');
    return getCachedData(cacheKey);
  }

  try {
    // Build API query parameters
    const params = new URLSearchParams({
      userId: userId,
      limit: pageLimit.toString(),
      orderBy: 'lastModified',
      orderDirection: 'desc'
    });

    // Set filter based on ownership and isPublic parameter
    if (!isOwner && isPublic !== null) {
      params.append('isPublic', 'true');
    }

    // Add pagination cursor if provided
    if (startAfterDoc?.id) {
      params.append('startAfter', startAfterDoc.id);
    }

    // Call API endpoint to get pages
    console.log(`fetchPages: Fetching ${isOwner ? 'all pages' : 'public pages'} for user ${userId}...`);
    const response = await fetch(`/api/pages?${params.toString()}`, {
      credentials: 'include' // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const pagesArray = data.pages || [];
    const pagination = data.pagination || {};

    // Cache the results if this is not a pagination request
    if (!startAfterDoc) {
      cacheData(cacheKey, pagesArray, pagination.lastPageId ? { id: pagination.lastPageId } : null);
    }

    return {
      data: pagesArray,
      timestamp: Date.now(),
      lastKey: pagination.lastPageId ? { id: pagination.lastPageId } : null,
      hasMore: pagination.hasMore || false
    };
  } catch (error) {
    console.error('Error fetching pages:', error);
    throw error;
  }
};



/**
 * Clear cache for a specific user or all cache
 */
export const clearPagesCache = (userId = null) => {
  if (userId) {
    // Clear only cache for this user
    const keyPrefix = `${CACHE_KEY_PREFIX}${userId}`;

    // Clear memory cache
    Object.keys(memoryCache).forEach(key => {
      if (key.startsWith(keyPrefix)) {
        delete memoryCache[key];
      }
    });

    // Clear localStorage cache
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(keyPrefix)) {
          localStorage.removeItem(key);
        }
      });
    }
  } else {
    // Clear all cache
    Object.keys(memoryCache).forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        delete memoryCache[key];
      }
    });

    // Clear localStorage cache
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  }
};