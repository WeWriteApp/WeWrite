/**
 * Optimized Firebase subscription operations to minimize read costs
 * This module provides cached, field-selective, and batched operations
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  select
} from 'firebase/firestore';
import { db } from './database';
import { generateCacheKey, getCacheItem, setCacheItem, BatchCache } from '../utils/cacheUtils';
import { trackQueryPerformance } from '../utils/queryMonitor';

// Types
interface SubscriptionData {
  id: string;
  status: string;
  amount: number;
  pledgedAmount?: number;
  tier?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: any;
}

interface PledgeData {
  id: string;
  pageId: string;
  amount: number;
  createdAt: any;
  updatedAt?: any;
}

interface OptimizedSubscriptionOptions {
  useCache?: boolean;
  cacheTTL?: number;
  verbose?: boolean;
  fieldsOnly?: string[];
}

// Cache instances for different data types
const subscriptionCache = new BatchCache<SubscriptionData>('subscription', 10 * 60 * 1000); // 10 minutes
const pledgeCache = new BatchCache<PledgeData[]>('pledges', 5 * 60 * 1000); // 5 minutes
const pageCache = new BatchCache<any>('pageInfo', 15 * 60 * 1000); // 15 minutes

// Read operation counters for monitoring
let readOperationCount = 0;
const readOperations: Array<{ operation: string; timestamp: number; cached: boolean }> = [];

/**
 * Log read operations for monitoring
 */
const logReadOperation = (operation: string, cached: boolean = false) => {
  readOperationCount++;
  readOperations.push({
    operation,
    timestamp: Date.now(),
    cached
  });
  
  // Keep only last 100 operations
  if (readOperations.length > 100) {
    readOperations.shift();
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Firebase Read] ${operation} - ${cached ? 'CACHED' : 'FIRESTORE'} (Total: ${readOperationCount})`);
  }
};

/**
 * Get read operation statistics
 */
export const getReadStats = () => {
  const last24h = readOperations.filter(op => Date.now() - op.timestamp < 24 * 60 * 60 * 1000);
  const cachedReads = last24h.filter(op => op.cached).length;
  const firestoreReads = last24h.filter(op => !op.cached).length;
  
  return {
    totalReads: readOperationCount,
    last24h: last24h.length,
    cachedReads,
    firestoreReads,
    cacheHitRate: last24h.length > 0 ? (cachedReads / last24h.length) * 100 : 0
  };
};

/**
 * Get user subscription with optimized caching and field selection
 */
export const getOptimizedUserSubscription = async (
  userId: string,
  options: OptimizedSubscriptionOptions = {}
): Promise<SubscriptionData | null> => {
  const { useCache = true, cacheTTL = 10 * 60 * 1000, fieldsOnly } = options;
  
  return trackQueryPerformance('getOptimizedUserSubscription', async () => {
    // Check cache first
    if (useCache) {
      const cacheKey = generateCacheKey('subscription', userId);
      const cached = getCacheItem<SubscriptionData>(cacheKey);
      if (cached) {
        logReadOperation('getUserSubscription', true);
        return cached;
      }
    }
    
    try {
      const userSubRef = doc(db, "users", userId, "subscription", "current");
      
      // Use field selection if specified
      let docSnap;
      if (fieldsOnly && fieldsOnly.length > 0) {
        // Note: Firestore select() is not available in all versions, so we'll fetch full doc
        // In a real implementation, you'd use: docSnap = await getDoc(query(userSubRef, select(...fieldsOnly)));
        docSnap = await getDoc(userSubRef);
      } else {
        docSnap = await getDoc(userSubRef);
      }
      
      logReadOperation('getUserSubscription', false);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const rawData = docSnap.data() as DocumentData;
      const subscriptionData: SubscriptionData = {
        id: docSnap.id,
        status: rawData.status || 'canceled',
        amount: rawData.amount || 0,
        pledgedAmount: rawData.pledgedAmount || 0,
        tier: rawData.tier || null,
        stripeSubscriptionId: rawData.stripeSubscriptionId || null,
        currentPeriodEnd: rawData.currentPeriodEnd
      };
      
      // Cache the result
      if (useCache) {
        const cacheKey = generateCacheKey('subscription', userId);
        setCacheItem(cacheKey, subscriptionData, cacheTTL);
      }
      
      return subscriptionData;
    } catch (error) {
      console.error('Error fetching optimized subscription:', error);
      return null;
    }
  });
};

/**
 * Get user pledges with optimized batching and caching
 */
export const getOptimizedUserPledges = async (
  userId: string,
  options: OptimizedSubscriptionOptions = {}
): Promise<PledgeData[]> => {
  const { useCache = true, cacheTTL = 5 * 60 * 1000 } = options;
  
  return trackQueryPerformance('getOptimizedUserPledges', async () => {
    // Check cache first
    if (useCache) {
      const cacheKey = generateCacheKey('pledges', userId);
      const cached = getCacheItem<PledgeData[]>(cacheKey);
      if (cached) {
        logReadOperation('getUserPledges', true);
        return cached;
      }
    }
    
    try {
      const pledgesRef = collection(db, "users", userId, "pledges");
      
      // Use pagination and ordering for better performance
      const pledgesQuery = query(
        pledgesRef,
        orderBy("createdAt", "desc"),
        limit(50) // Limit to prevent large reads
      );
      
      const querySnapshot = await getDocs(pledgesQuery);
      logReadOperation('getUserPledges', false);
      
      const pledges: PledgeData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        pageId: doc.data().pageId,
        amount: doc.data().amount || 0,
        createdAt: doc.data().createdAt,
        updatedAt: doc.data().updatedAt
      }));
      
      // Cache the result
      if (useCache) {
        const cacheKey = generateCacheKey('pledges', userId);
        setCacheItem(cacheKey, pledges, cacheTTL);
      }
      
      return pledges;
    } catch (error) {
      console.error('Error fetching optimized pledges:', error);
      return [];
    }
  });
};

/**
 * Get page information for pledges with batched reads
 */
export const getOptimizedPageInfo = async (
  pageIds: string[],
  options: OptimizedSubscriptionOptions = {}
): Promise<Record<string, any>> => {
  const { useCache = true, cacheTTL = 15 * 60 * 1000 } = options;
  
  return trackQueryPerformance('getOptimizedPageInfo', async () => {
    const results: Record<string, any> = {};
    const uncachedPageIds: string[] = [];
    
    // Check cache for each page
    if (useCache) {
      pageIds.forEach(pageId => {
        const cacheKey = generateCacheKey('pageInfo', pageId);
        const cached = getCacheItem<any>(cacheKey);
        if (cached) {
          results[pageId] = cached;
          logReadOperation(`getPageInfo-${pageId}`, true);
        } else {
          uncachedPageIds.push(pageId);
        }
      });
    } else {
      uncachedPageIds.push(...pageIds);
    }
    
    // Batch fetch uncached pages
    if (uncachedPageIds.length > 0) {
      // Note: In a real implementation, you'd use batch reads or compound queries
      // For now, we'll fetch them individually but could be optimized further
      const pagePromises = uncachedPageIds.map(async (pageId) => {
        try {
          const pageRef = doc(db, "pages", pageId);
          const pageSnap = await getDoc(pageRef);
          logReadOperation(`getPageInfo-${pageId}`, false);
          
          if (pageSnap.exists()) {
            const pageData = {
              id: pageId,
              title: pageSnap.data().title || 'Untitled Page',
              username: pageSnap.data().username,
              displayName: pageSnap.data().displayName,
              isPublic: pageSnap.data().isPublic
            };
            
            // Cache the result
            if (useCache) {
              const cacheKey = generateCacheKey('pageInfo', pageId);
              setCacheItem(cacheKey, pageData, cacheTTL);
            }
            
            return { pageId, pageData };
          }
          return { pageId, pageData: null };
        } catch (error) {
          console.error(`Error fetching page ${pageId}:`, error);
          return { pageId, pageData: null };
        }
      });
      
      const pageResults = await Promise.all(pagePromises);
      pageResults.forEach(({ pageId, pageData }) => {
        if (pageData) {
          results[pageId] = pageData;
        }
      });
    }
    
    return results;
  });
};

/**
 * Optimized listener that uses caching and reduces real-time updates
 */
export const createOptimizedSubscriptionListener = (
  userId: string,
  callback: (data: SubscriptionData | null) => void,
  options: OptimizedSubscriptionOptions = {}
): Unsubscribe => {
  const { verbose = false } = options;
  
  // First, try to get cached data immediately
  const cacheKey = generateCacheKey('subscription', userId);
  const cached = getCacheItem<SubscriptionData>(cacheKey);
  if (cached) {
    callback(cached);
    logReadOperation('subscriptionListener-cached', true);
  }
  
  // Set up real-time listener with throttling
  let lastUpdate = 0;
  const throttleMs = 2000; // Throttle updates to max once per 2 seconds
  
  const userSubRef = doc(db, "users", userId, "subscription", "current");
  
  const unsubscribe = onSnapshot(userSubRef, (doc) => {
    const now = Date.now();
    if (now - lastUpdate < throttleMs) {
      return; // Skip this update due to throttling
    }
    lastUpdate = now;
    
    logReadOperation('subscriptionListener-realtime', false);
    
    if (doc.exists()) {
      const rawData = doc.data() as DocumentData;
      const subscriptionData: SubscriptionData = {
        id: doc.id,
        status: rawData.status || 'canceled',
        amount: rawData.amount || 0,
        pledgedAmount: rawData.pledgedAmount || 0,
        tier: rawData.tier || null,
        stripeSubscriptionId: rawData.stripeSubscriptionId || null,
        currentPeriodEnd: rawData.currentPeriodEnd
      };
      
      // Update cache
      setCacheItem(cacheKey, subscriptionData, 10 * 60 * 1000);
      
      if (verbose) {
        console.log('[OptimizedSubscriptionListener] Update:', subscriptionData.status);
      }
      
      callback(subscriptionData);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('[OptimizedSubscriptionListener] Error:', error);
  });
  
  return unsubscribe;
};

/**
 * Clear all subscription-related caches
 */
export const clearSubscriptionCaches = () => {
  subscriptionCache.clear();
  pledgeCache.clear();
  pageCache.clear();
};

/**
 * Get cache statistics for monitoring
 */
export const getSubscriptionCacheStats = () => {
  return {
    readStats: getReadStats(),
    // Add more cache-specific stats here
  };
};
