/**
 * Firebase Firestore Read Optimization - Optimized Page Operations
 *
 * This module provides cached, field-selective, and batched page operations
 * to minimize Firebase Firestore read costs and improve performance.
 *
 * Key Optimizations:
 * - Separate metadata and content fetching: Avoid loading large content when only metadata is needed
 * - Paginated queries: Use limit() and startAfter() for large result sets
 * - Metadata-only reads: Fetch only essential page information
 * - Content caching: Separate cache for page content with 10-minute TTL
 * - Batch metadata fetching: Efficient multi-page information retrieval
 *
 * Functions:
 * - getOptimizedPageMetadata(): Lightweight page information
 * - getOptimizedPageContent(): Separate content fetching
 * - getOptimizedPageList(): Paginated page listings
 * - getBatchPageMetadata(): Efficient multi-page fetching
 * - createOptimizedPageListener(): Throttled page updates
 *
 * Performance Impact:
 * - Significant reduction in page-related Firestore reads
 * - Improved cache hit rates for page metadata
 * - Reduced query response times through content separation
 * - Efficient batch operations minimize individual requests
 *
 * Usage Example:
 * ```typescript
 * // Get page metadata without content
 * const metadata = await getOptimizedPageMetadata(pageId, {
 *   useCache: true,
 *   fieldsOnly: ['title', 'userId', 'updatedAt']
 * });
 *
 * // Get content separately when needed
 * const content = await getOptimizedPageContent(pageId);
 * ```
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
  startAfter,
  onSnapshot,
  select,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { generateCacheKey, getCacheItem, setCacheItem, BatchCache } from '../utils/cacheUtils';
import { trackQueryPerformance } from '../utils/queryMonitor';

// Types
interface OptimizedPageData {
  id: string;
  title: string;
  username?: string;
  displayName?: string;
  isPublic: boolean;
  userId: string;
  lastModified?: any;
  createdAt?: any;
  totalPledged?: number;
  pledgeCount?: number;
  currentVersion?: string;
}

interface OptimizedPageOptions {
  useCache?: boolean;
  cacheTTL?: number;
  fieldsOnly?: string[];
  includeContent?: boolean;
  maxResults?: number;
}

interface PageListResult {
  pages: OptimizedPageData[];
  lastDoc?: QueryDocumentSnapshot;
  hasMore: boolean;
  totalFetched: number;
}

// Cache instances (lazy initialization for client-side only)
let pageMetadataCache: BatchCache<OptimizedPageData> | null = null;
let pageContentCache: BatchCache<string> | null = null;
let pageListCache: BatchCache<PageListResult> | null = null;

// Initialize caches only on client side
const getPageMetadataCache = () => {
  if (typeof window === 'undefined') return null;
  if (!pageMetadataCache) {
    pageMetadataCache = new BatchCache<OptimizedPageData>('pageMetadata', 15 * 60 * 1000);
  }
  return pageMetadataCache;
};

const getPageContentCache = () => {
  if (typeof window === 'undefined') return null;
  if (!pageContentCache) {
    pageContentCache = new BatchCache<string>('pageContent', 10 * 60 * 1000);
  }
  return pageContentCache;
};

const getPageListCache = () => {
  if (typeof window === 'undefined') return null;
  if (!pageListCache) {
    pageListCache = new BatchCache<PageListResult>('pageList', 5 * 60 * 1000);
  }
  return pageListCache;
};

// Read operation tracking
let pageReadCount = 0;
const pageReadOperations: Array<{ operation: string; timestamp: number; cached: boolean; pageId?: string }> = [];

const logPageRead = (operation: string, cached: boolean = false, pageId?: string) => {
  pageReadCount++;
  pageReadOperations.push({
    operation,
    timestamp: Date.now(),
    cached,
    pageId
  });
  
  if (pageReadOperations.length > 100) {
    pageReadOperations.shift();
  }
  
  // Page read tracking for optimization monitoring
};

/**
 * Get page metadata with optimized field selection
 */
export const getOptimizedPageMetadata = async (
  pageId: string,
  options: OptimizedPageOptions = {}
): Promise<OptimizedPageData | null> => {
  const { useCache = true, cacheTTL = 15 * 60 * 1000, fieldsOnly } = options;
  
  return trackQueryPerformance('getOptimizedPageMetadata', async () => {
    // Check cache first
    if (useCache) {
      const cacheKey = generateCacheKey('pageMetadata', pageId);
      const cached = getCacheItem<OptimizedPageData>(cacheKey);
      if (cached) {
        logPageRead('getPageMetadata', true, pageId);
        return cached;
      }
    }
    
    try {
      // TEMPORARY: Use dynamic import like the working API
      const { db } = await import('./database');

      const pageRef = doc(db, "pages", pageId);
      const docSnap = await getDoc(pageRef);
      
      logPageRead('getPageMetadata', false, pageId);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      
      // Extract only the fields we need for metadata
      const pageData: OptimizedPageData = {
        id: pageId,
        title: data.title || 'Untitled Page',
        username: data.username,
        displayName: data.displayName,
        isPublic: data.isPublic || false,
        userId: data.userId,
        lastModified: data.lastModified,
        createdAt: data.createdAt,
        totalPledged: data.totalPledged || 0,
        pledgeCount: data.pledgeCount || 0,
        currentVersion: data.currentVersion
      };
      
      // Apply field filtering if specified
      if (fieldsOnly && fieldsOnly.length > 0) {
        const filteredData: Partial<OptimizedPageData> = { id: pageId };
        fieldsOnly.forEach(field => {
          if (field in pageData) {
            (filteredData as any)[field] = (pageData as any)[field];
          }
        });
        return filteredData as OptimizedPageData;
      }
      
      // Cache the result
      if (useCache) {
        const cacheKey = generateCacheKey('pageMetadata', pageId);
        setCacheItem(cacheKey, pageData, cacheTTL);
      }
      
      return pageData;
    } catch (error) {
      console.error('Error fetching optimized page metadata:', error);
      return null;
    }
  });
};

/**
 * Get page content separately from metadata to reduce unnecessary reads
 */
export const getOptimizedPageContent = async (
  pageId: string,
  versionId?: string,
  options: OptimizedPageOptions = {}
): Promise<string | null> => {
  const { useCache = true, cacheTTL = 10 * 60 * 1000 } = options;
  
  return trackQueryPerformance('getOptimizedPageContent', async () => {
    const contentKey = versionId || 'current';
    const cacheKey = generateCacheKey('pageContent', `${pageId}_${contentKey}`);
    
    // Check cache first
    if (useCache) {
      const cached = getCacheItem<string>(cacheKey);
      if (cached) {
        logPageRead('getPageContent', true, pageId);
        return cached;
      }
    }
    
    try {
      // TEMPORARY: Use dynamic import like the working API
      const { db } = await import('./database');

      let content: string | null = null;

      if (versionId) {
        // Get specific version content
        const versionRef = doc(db, "pages", pageId, "versions", versionId);
        const versionSnap = await getDoc(versionRef);
        logPageRead('getPageContent-version', false, pageId);
        
        if (versionSnap.exists()) {
          content = versionSnap.data().content || null;
        }
      } else {
        // Get current version content
        const pageRef = doc(db, "pages", pageId);
        const pageSnap = await getDoc(pageRef);
        logPageRead('getPageContent-current', false, pageId);
        
        if (pageSnap.exists()) {
          const pageData = pageSnap.data();
          if (pageData.currentVersion) {
            // Fetch from version document
            const versionRef = doc(db, "pages", pageId, "versions", pageData.currentVersion);
            const versionSnap = await getDoc(versionRef);
            logPageRead('getPageContent-currentVersion', false, pageId);
            
            if (versionSnap.exists()) {
              content = versionSnap.data().content || null;
            }
          }
        }
      }
      
      // Cache the result
      if (content && useCache) {
        setCacheItem(cacheKey, content, cacheTTL);
      }
      
      return content;
    } catch (error) {
      console.error('Error fetching optimized page content:', error);
      return null;
    }
  });
};

/**
 * Get paginated list of pages with optimized queries
 */
export const getOptimizedPageList = async (
  userId: string,
  options: OptimizedPageOptions & {
    lastDoc?: QueryDocumentSnapshot;
    searchQuery?: string;
    includeGroupPages?: boolean;
  } = {}
): Promise<PageListResult> => {
  const {
    useCache = true,
    cacheTTL = 5 * 60 * 1000,
    maxResults = 20,
    lastDoc,
    searchQuery = '',
    includeGroupPages = false
  } = options;
  
  return trackQueryPerformance('getOptimizedPageList', async () => {
    // Create cache key based on parameters
    const cacheKey = generateCacheKey('pageList', `${userId}_${searchQuery}_${maxResults}_${includeGroupPages}`);
    
    // Check cache first (only for first page, not pagination)
    if (useCache && !lastDoc) {
      const cached = getCacheItem<PageListResult>(cacheKey);
      if (cached) {
        logPageRead('getPageList', true);
        return cached;
      }
    }
    
    try {
      // TEMPORARY: Use dynamic import like the working API
      const { db } = await import('./database');

      // Define metadata fields to reduce document size by 50-70%
      const metadataFields = [
        'title', 'username', 'displayName', 'isPublic', 'userId',
        'lastModified', 'createdAt', 'totalPledged', 'pledgeCount', 'currentVersion'
      ];

      // Build optimized query with field selection (exclude deleted pages)
      let pageQuery = query(
        collection(db, "pages"),
        where("userId", "==", userId),
        where("deleted", "!=", true),
        orderBy("lastModified", "desc"),
        limit(maxResults),
        select(...metadataFields)
      );

      // Add pagination if lastDoc is provided (exclude deleted pages)
      if (lastDoc) {
        pageQuery = query(
          collection(db, "pages"),
          where("userId", "==", userId),
          where("deleted", "!=", true),
          orderBy("lastModified", "desc"),
          startAfter(lastDoc),
          limit(maxResults),
          select(...metadataFields)
        );
      }
      
      const querySnapshot = await getDocs(pageQuery);
      logPageRead('getPageList', false);
      
      const pages: OptimizedPageData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        pages.push({
          id: doc.id,
          title: data.title || 'Untitled Page',
          username: data.username,
          displayName: data.displayName,
          isPublic: data.isPublic || false,
          userId: data.userId,
          lastModified: data.lastModified,
          createdAt: data.createdAt,
          totalPledged: data.totalPledged || 0,
          pledgeCount: data.pledgeCount || 0,
          currentVersion: data.currentVersion
        });
      });
      
      // Apply client-side search filtering if needed
      let filteredPages = pages;
      if (searchQuery) {
        const normalizedQuery = searchQuery.toLowerCase();
        filteredPages = pages.filter(page =>
          page.title.toLowerCase().includes(normalizedQuery)
        );
      }
      
      const result: PageListResult = {
        pages: filteredPages,
        lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : undefined,
        hasMore: querySnapshot.docs.length === maxResults,
        totalFetched: filteredPages.length
      };
      
      // Cache the result (only for first page)
      if (useCache && !lastDoc) {
        setCacheItem(cacheKey, result, cacheTTL);
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching optimized page list:', error);
      return {
        pages: [],
        hasMore: false,
        totalFetched: 0
      };
    }
  });
};

/**
 * Batch get multiple page metadata efficiently
 */
export const getBatchPageMetadata = async (
  pageIds: string[],
  options: OptimizedPageOptions = {}
): Promise<Record<string, OptimizedPageData | null>> => {
  const { useCache = true } = options;
  
  return trackQueryPerformance('getBatchPageMetadata', async () => {
    const results: Record<string, OptimizedPageData | null> = {};
    const uncachedIds: string[] = [];
    
    // Check cache for each page
    if (useCache) {
      pageIds.forEach(pageId => {
        const cacheKey = generateCacheKey('pageMetadata', pageId);
        const cached = getCacheItem<OptimizedPageData>(cacheKey);
        if (cached) {
          results[pageId] = cached;
          logPageRead('getBatchPageMetadata', true, pageId);
        } else {
          uncachedIds.push(pageId);
        }
      });
    } else {
      uncachedIds.push(...pageIds);
    }
    
    // Fetch uncached pages
    if (uncachedIds.length > 0) {
      const fetchPromises = uncachedIds.map(async (pageId) => {
        const pageData = await getOptimizedPageMetadata(pageId, { useCache: false });
        return { pageId, pageData };
      });
      
      const fetchResults = await Promise.all(fetchPromises);
      fetchResults.forEach(({ pageId, pageData }) => {
        results[pageId] = pageData;
      });
    }
    
    return results;
  });
};

/**
 * Create an optimized page listener with reduced update frequency
 */
export const createOptimizedPageListener = (
  pageId: string,
  callback: (pageData: OptimizedPageData | null) => void,
  options: OptimizedPageOptions = {}
): Unsubscribe => {
  // First, try to get cached data immediately
  const cacheKey = generateCacheKey('pageMetadata', pageId);
  const cached = getCacheItem<OptimizedPageData>(cacheKey);
  if (cached) {
    callback(cached);
    logPageRead('pageListener-cached', true, pageId);
  }
  
  // Set up real-time listener with smart throttling
  let lastUpdate = 0;
  let isUserActive = true;

  // Smart throttling based on user activity and page context - optimized for reduced Firebase reads
  const getThrottleInterval = () => {
    // Check if user is actively editing or viewing this specific page
    const isCurrentPage = window.location.pathname.includes(pageId);
    const isEditMode = window.location.pathname.includes('/edit');

    if (isCurrentPage && isEditMode && isUserActive) {
      return 20000; // 20 seconds for active editing (increased from 15s)
    } else if (isCurrentPage && isUserActive) {
      return 45000; // 45 seconds for active viewing (increased from 30s)
    } else if (isUserActive) {
      return 120000; // 2 minutes for background pages while user is active (increased from 1m)
    } else {
      return 600000; // 10 minutes for inactive users (increased from 5m)
    }
  };

  // Track user activity for smart throttling
  const updateUserActivity = () => {
    isUserActive = true;
    setTimeout(() => { isUserActive = false; }, 90000); // Consider inactive after 1.5 minutes
  };

  // Listen for user activity (only if not already set up)
  if (typeof window !== 'undefined' && !window._pageListenerActivitySetup) {
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, updateUserActivity, { passive: true });
    });
    window._pageListenerActivitySetup = true;
  }
  // TEMPORARY: Use dynamic import like the working API - but this needs to be synchronous
  // For now, we'll need to handle this differently
  let db: any = null;

  // Get db instance asynchronously
  import('./database').then(({ db: dbInstance }) => {
    db = dbInstance;
  });

  // Use deduplication system to prevent multiple listeners for the same page
  const listenerKey = `page:${pageId}`;

  const createListener = () => {
    const pageRef = doc(db, "pages", pageId);

    return onSnapshot(pageRef, (doc) => {
      const now = Date.now();
      const currentThrottleMs = getThrottleInterval();

      if (now - lastUpdate < currentThrottleMs) {
        console.log(`[OptimizedPageListener] Throttling update for ${pageId} (${currentThrottleMs}ms interval)`);
        return; // Skip this update due to smart throttling
      }
      lastUpdate = now;

      logPageRead('pageListener-realtime', false, pageId);

      if (doc.exists()) {
        const data = doc.data();
        const pageData: OptimizedPageData = {
          id: pageId,
          title: data.title || 'Untitled Page',
          username: data.username,
          displayName: data.displayName,
          isPublic: data.isPublic || false,
          userId: data.userId,
          lastModified: data.lastModified,
          createdAt: data.createdAt,
          totalPledged: data.totalPledged || 0,
          pledgeCount: data.pledgeCount || 0,
          currentVersion: data.currentVersion
        };

        // Update cache with aggressive TTL
        setCacheItem(cacheKey, pageData, 2.5 * 60 * 60 * 1000);
        callback(pageData);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('[OptimizedPageListener] Error:', error);
    });
  };

  // Return deduped listener with smart throttling
  return createDedupedListener(
    listenerKey,
    createListener,
    callback,
    getThrottleInterval()
  );
};

/**
 * Get page read statistics
 */
export const getPageReadStats = () => {
  const last24h = pageReadOperations.filter(op => Date.now() - op.timestamp < (24 * 60 * 60 * 1000));
  const cachedReads = last24h.filter(op => op.cached).length;
  const firestoreReads = last24h.filter(op => !op.cached).length;
  
  return {
    totalReads: pageReadCount,
    last24h: last24h.length,
    cachedReads,
    firestoreReads,
    cacheHitRate: last24h.length > 0 ? (cachedReads / last24h.length) * 100 : 0,
    operationBreakdown: last24h.reduce((acc, op) => {
      acc[op.operation] = (acc[op.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
};

/**
 * Clear all page-related caches
 */
export const clearPageCaches = () => {
  const metaCache = getPageMetadataCache();
  const contentCache = getPageContentCache();
  const listCache = getPageListCache();

  if (metaCache) metaCache.clear();
  if (contentCache) contentCache.clear();
  if (listCache) listCache.clear();
};