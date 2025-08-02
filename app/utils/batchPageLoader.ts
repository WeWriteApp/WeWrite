/**
 * EMERGENCY COST OPTIMIZATION: Batch Page Loader
 * 
 * This utility batches multiple page requests into single API calls
 * to dramatically reduce Firestore reads.
 */

// Cache for batch requests
const batchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Pending batch requests to avoid duplicate calls
const pendingBatches = new Map<string, Promise<any>>();

/**
 * Load multiple pages in a single batch request
 */
export async function loadPagesBatch(pageIds: string[]): Promise<Record<string, any>> {
  if (!pageIds || pageIds.length === 0) {
    return {};
  }

  // Remove duplicates and sort for consistent caching
  const uniquePageIds = [...new Set(pageIds)].sort();
  const cacheKey = `batch:${uniquePageIds.join(',')}`;

  // Check cache first
  const cached = batchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`🚀 BATCH LOADER: Returning cached batch (${uniquePageIds.length} pages)`);
    return cached.data.pages;
  }

  // Check if there's already a pending request for this batch
  if (pendingBatches.has(cacheKey)) {
    console.log(`🔄 BATCH LOADER: Waiting for pending batch request`);
    const result = await pendingBatches.get(cacheKey);
    return result.pages;
  }

  // Create new batch request
  const batchPromise = performBatchRequest(uniquePageIds, cacheKey);
  pendingBatches.set(cacheKey, batchPromise);

  try {
    const result = await batchPromise;
    return result.pages;
  } finally {
    // Clean up pending request
    pendingBatches.delete(cacheKey);
  }
}

/**
 * Perform the actual batch request
 */
async function performBatchRequest(pageIds: string[], cacheKey: string) {
  console.log(`🔥 BATCH LOADER: Loading ${pageIds.length} pages in batch`);

  const response = await fetch('/api/pages/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageIds }),
  });

  if (!response.ok) {
    throw new Error(`Batch request failed: ${response.status}`);
  }

  const data = await response.json();

  // Cache the result
  batchCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  console.log(`✅ BATCH LOADER: Loaded ${data.totalFound}/${data.totalRequested} pages in ${data.queryTime}ms`);

  return data;
}

/**
 * Load a single page (will be batched automatically if called multiple times quickly)
 */
export async function loadPageSingle(pageId: string): Promise<any> {
  const result = await loadPagesBatch([pageId]);
  return result[pageId] || null;
}

/**
 * Preload pages for a list of edits/items
 */
export async function preloadPagesForEdits(edits: Array<{ id: string }>): Promise<void> {
  const pageIds = edits.map(edit => edit.id).filter(Boolean);
  if (pageIds.length > 0) {
    console.log(`🚀 PRELOAD: Preloading ${pageIds.length} pages for edits`);
    await loadPagesBatch(pageIds);
  }
}

/**
 * Clear the batch cache (useful for testing or when data changes)
 */
export function clearBatchCache(): void {
  batchCache.clear();
  console.log('🧹 BATCH LOADER: Cache cleared');
}

/**
 * Get cache statistics
 */
export function getBatchCacheStats() {
  const now = Date.now();
  const entries = Array.from(batchCache.entries());
  
  return {
    totalEntries: entries.length,
    validEntries: entries.filter(([_, entry]) => (now - entry.timestamp) < CACHE_TTL).length,
    expiredEntries: entries.filter(([_, entry]) => (now - entry.timestamp) >= CACHE_TTL).length,
    cacheSize: entries.reduce((size, [key, entry]) => size + key.length + JSON.stringify(entry.data).length, 0)
  };
}

/**
 * Clean up expired cache entries
 */
export function cleanupBatchCache(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of batchCache.entries()) {
    if ((now - entry.timestamp) >= CACHE_TTL) {
      batchCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 BATCH LOADER: Cleaned up ${cleaned} expired cache entries`);
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupBatchCache, 5 * 60 * 1000);
