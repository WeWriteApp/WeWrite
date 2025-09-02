/**
 * Page utilities for fetching page data and titles
 */

import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getCollectionName } from './environmentConfig';

// Cache for page titles to avoid repeated API calls
const pageTitleCache = new Map<string, string>();
const cacheTTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Get page title by page ID, with caching
 */
export async function getPageTitle(pageId: string): Promise<string | null> {
  if (!pageId) return null;

  // Check cache first
  const cached = pageTitleCache.get(pageId);
  const cacheTime = cacheTimestamps.get(pageId);
  
  if (cached && cacheTime && (Date.now() - cacheTime < cacheTTL)) {
    return cached;
  }

  try {
    const pageRef = doc(db, getCollectionName('pages'), pageId);
    const pageDoc = await getDoc(pageRef);
    
    if (pageDoc.exists()) {
      const pageData = pageDoc.data();
      const title = pageData.title || 'Untitled';
      
      // Cache the result
      pageTitleCache.set(pageId, title);
      cacheTimestamps.set(pageId, Date.now());
      
      return title;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching page title:', error);
    return null;
  }
}

/**
 * Clear the page title cache for a specific page
 */
export function clearPageTitleCache(pageId: string): void {
  pageTitleCache.delete(pageId);
  cacheTimestamps.delete(pageId);
}

/**
 * Clear all page title cache
 */
export function clearAllPageTitleCache(): void {
  pageTitleCache.clear();
  cacheTimestamps.clear();
}
