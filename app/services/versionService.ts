/**
 * Unified Version Service
 * 
 * This is the single source of truth for all page version operations in WeWrite.
 * All other version implementations should be replaced with calls to this service.
 * 
 * This service automatically handles:
 * - Environment-aware API calls (development uses API, production uses Firebase)
 * - Proper error handling and fallbacks
 * - Consistent data formatting
 * - Caching for performance
 */

import { PageVersion } from '../types/database';

// Cache for version data to avoid repeated API calls
const versionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = process.env.NODE_ENV === 'development' ? 30000 : 300000; // 30 seconds in dev, 5 minutes in prod (reduced for better UX)

/**
 * Get all versions for a page
 * This is the unified function that replaces getPageVersions, getVersionsByPageId, etc.
 */
export async function getPageVersions(pageId: string, limit: number = 10): Promise<PageVersion[]> {
  if (!pageId) {
    console.error('getPageVersions called with invalid pageId:', pageId);
    return [];
  }

  const cacheKey = `versions-${pageId}-${limit}`;
  const cached = versionCache.get(cacheKey);
  
  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {

    // In development or when Firebase is offline, use API endpoint
    const shouldUseAPI = process.env.NODE_ENV === 'development' || 
                        typeof window !== 'undefined' && !navigator.onLine;

    let versions: PageVersion[] = [];

    if (shouldUseAPI || typeof window !== 'undefined') {
      // Use API endpoint (works in both client and server environments)
      try {
        const response = await fetch(`/api/pages/${pageId}/versions?limit=${limit}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          versions = result.versions || [];
        } else {
          console.warn(`⚠️ [VERSION_SERVICE] API error ${response.status}, falling back to Firebase`);
          throw new Error(`API error: ${response.status}`);
        }
      } catch (apiError) {
        console.warn('⚠️ [VERSION_SERVICE] API call failed, falling back to Firebase:', apiError);
        // Fall back to Firebase if API fails
        versions = await getVersionsFromFirebase(pageId, limit);
      }
    } else {
      // Use Firebase directly (server-side or when API is not available)
      versions = await getVersionsFromFirebase(pageId, limit);
    }

    // Normalize and sort versions
    const normalizedVersions = versions.map(version => normalizeVersion(version));
    normalizedVersions.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Newest first
    });

    // Cache the result
    versionCache.set(cacheKey, {
      data: normalizedVersions,
      timestamp: Date.now()
    });

    return normalizedVersions;

  } catch (error) {
    console.error('❌ [VERSION_SERVICE] Error fetching versions:', error);
    return [];
  }
}

/**
 * Get a specific version by ID
 */
export async function getPageVersionById(pageId: string, versionId: string): Promise<PageVersion | null> {
  try {
    const versions = await getPageVersions(pageId, 50); // Get more versions to find the specific one
    const version = versions.find(v => v.id === versionId);

    if (version) {
      return version;
    } else {
      return null;
    }
  } catch (error) {
    console.error('❌ [VERSION_SERVICE] Error fetching version by ID:', error);
    return null;
  }
}

/**
 * Save a new version (this delegates to the existing saveNewVersion function)
 */
export async function savePageVersion(pageId: string, data: any): Promise<any> {
  try {
    // Import the existing saveNewVersion function
    const { saveNewVersion } = await import('../firebase/database/versions');
    const result = await saveNewVersion(pageId, data);
    
    // Clear cache for this page
    clearPageVersionCache(pageId);
    
    return result;
  } catch (error) {
    console.error('❌ [VERSION_SERVICE] Error saving version:', error);
    throw error;
  }
}

/**
 * Clear cache for a specific page
 */
export function clearPageVersionCache(pageId: string): void {
  const keysToDelete = Array.from(versionCache.keys()).filter(key => key.startsWith(`versions-${pageId}-`));
  keysToDelete.forEach(key => versionCache.delete(key));
}

/**
 * Clear all version cache
 */
export function clearAllVersionCache(): void {
  versionCache.clear();
}

// Private helper functions

/**
 * Get versions from Firebase (fallback method)
 */
async function getVersionsFromFirebase(pageId: string, limit: number): Promise<PageVersion[]> {
  try {
    // Import Firebase functions only when needed
    const { collection, doc, getDocs } = await import('firebase/firestore');
    const { db } = await import('../firebase/database/core');
    const { getCollectionName } = await import('../utils/environmentConfig');

    const pageRef = doc(db, getCollectionName("pages"), pageId);
    const versionsRef = collection(pageRef, "versions");
    const versionsSnap = await getDocs(versionsRef);

    if (versionsSnap.empty) {
      return [];
    }

    const versions = versionsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PageVersion));

    return versions.slice(0, limit);

  } catch (error) {
    console.error('❌ [VERSION_SERVICE] Firebase error:', error);
    return [];
  }
}

/**
 * Normalize version data to ensure consistent format
 */
function normalizeVersion(version: any): PageVersion {
  return {
    id: version.id || '',
    content: version.content || '',
    createdAt: normalizeDate(version.createdAt),
    userId: version.userId || 'anonymous',
    username: version.username || 'Anonymous',
    groupId: version.groupId || null,
    previousVersionId: version.previousVersionId || null,
    isNoOp: version.isNoOp || false,
    // Include any additional fields
    ...version
  };
}

/**
 * Normalize date to ISO string format
 */
function normalizeDate(date: any): string {
  if (!date) return new Date().toISOString();
  
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate().toISOString();
  }
  
  // Handle Date object
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  // Handle string
  if (typeof date === 'string') {
    return date;
  }
  
  // Fallback
  return new Date().toISOString();
}
