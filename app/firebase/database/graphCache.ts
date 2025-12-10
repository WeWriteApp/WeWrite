/**
 * Graph Cache System
 *
 * Pre-computes and stores page connection graph data in Firestore
 * for instant retrieval. Updated when pages are saved.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config';
import { getCollectionName } from '../../utils/environmentConfig';

export interface CachedPageConnection {
  id: string;
  title: string;
  username: string;
  lastModified?: any;
  linkText?: string;
}

export interface PageGraphCacheData {
  pageId: string;
  pageTitle: string;
  username: string;

  // Direct connections
  incoming: CachedPageConnection[];
  outgoing: CachedPageConnection[];
  bidirectional: CachedPageConnection[];

  // Multi-hop connections
  secondHopConnections: CachedPageConnection[];
  thirdHopConnections: CachedPageConnection[];

  // Stats for quick access
  stats: {
    incomingCount: number;
    outgoingCount: number;
    bidirectionalCount: number;
    secondHopCount: number;
    thirdHopCount: number;
    totalConnections: number;
  };

  // Cache metadata
  cachedAt: any;
  version: number;
}

const CACHE_VERSION = 1;

/**
 * Get cached graph data for a page
 * Returns null if cache doesn't exist or is invalid
 */
export async function getPageGraphCache(pageId: string): Promise<PageGraphCacheData | null> {
  try {
    const cacheRef = doc(db, getCollectionName('pageGraphCache'), pageId);
    const cacheDoc = await getDoc(cacheRef);

    if (!cacheDoc.exists()) {
      console.log(`📊 [GRAPH_CACHE] No cache found for page ${pageId}`);
      return null;
    }

    const data = cacheDoc.data() as PageGraphCacheData;

    // Check cache version
    if (data.version !== CACHE_VERSION) {
      console.log(`📊 [GRAPH_CACHE] Cache version mismatch for page ${pageId}, needs rebuild`);
      return null;
    }

    console.log(`📊 [GRAPH_CACHE] Cache hit for page ${pageId}`, data.stats);
    return data;

  } catch (error) {
    console.error(`📊 [GRAPH_CACHE] Error reading cache for page ${pageId}:`, error);
    return null;
  }
}

/**
 * Save computed graph data to cache
 */
export async function setPageGraphCache(
  pageId: string,
  data: Omit<PageGraphCacheData, 'cachedAt' | 'version'>
): Promise<void> {
  try {
    const cacheRef = doc(db, getCollectionName('pageGraphCache'), pageId);

    const cacheData: PageGraphCacheData = {
      ...data,
      cachedAt: serverTimestamp(),
      version: CACHE_VERSION
    };

    await setDoc(cacheRef, cacheData);

    console.log(`📊 [GRAPH_CACHE] Saved cache for page ${pageId}`, cacheData.stats);

  } catch (error) {
    console.error(`📊 [GRAPH_CACHE] Error saving cache for page ${pageId}:`, error);
    throw error;
  }
}

/**
 * Invalidate (delete) cache for a page
 */
export async function invalidatePageGraphCache(pageId: string): Promise<void> {
  try {
    const cacheRef = doc(db, getCollectionName('pageGraphCache'), pageId);
    await deleteDoc(cacheRef);
    console.log(`📊 [GRAPH_CACHE] Invalidated cache for page ${pageId}`);
  } catch (error) {
    console.error(`📊 [GRAPH_CACHE] Error invalidating cache for page ${pageId}:`, error);
    // Don't throw - cache invalidation failure shouldn't block operations
  }
}

/**
 * Invalidate cache for multiple pages (used when a page save affects other pages' graphs)
 */
export async function invalidateMultiplePageGraphCaches(pageIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(pageIds)];

  console.log(`📊 [GRAPH_CACHE] Invalidating cache for ${uniqueIds.length} pages`);

  // Invalidate in parallel
  await Promise.allSettled(
    uniqueIds.map(pageId => invalidatePageGraphCache(pageId))
  );
}

/**
 * Check if cache exists and is recent enough
 * @param maxAgeMs Maximum age in milliseconds (default 1 hour)
 */
export async function isCacheValid(pageId: string, maxAgeMs: number = 60 * 60 * 1000): Promise<boolean> {
  try {
    const cacheRef = doc(db, getCollectionName('pageGraphCache'), pageId);
    const cacheDoc = await getDoc(cacheRef);

    if (!cacheDoc.exists()) {
      return false;
    }

    const data = cacheDoc.data();

    // Check version
    if (data.version !== CACHE_VERSION) {
      return false;
    }

    // Check age
    if (data.cachedAt) {
      const cachedAt = data.cachedAt instanceof Timestamp
        ? data.cachedAt.toMillis()
        : new Date(data.cachedAt).getTime();
      const age = Date.now() - cachedAt;
      return age < maxAgeMs;
    }

    return true;

  } catch (error) {
    console.error(`📊 [GRAPH_CACHE] Error checking cache validity for page ${pageId}:`, error);
    return false;
  }
}
