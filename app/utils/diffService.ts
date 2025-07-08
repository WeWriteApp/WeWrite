/**
 * Centralized Diff Service
 * 
 * This is the single source of truth for all diff operations in WeWrite.
 * All other diff implementations should be replaced with calls to this service.
 */

export interface DiffOperation {
  type: 'add' | 'remove' | 'equal';
  text: string;
  start: number;
}

export interface DiffResult {
  added: number;
  removed: number;
  operations: DiffOperation[];
  preview: DiffPreview | null;
  hasChanges: boolean;
}

export interface DiffPreview {
  beforeContext: string;
  addedText: string;
  removedText: string;
  afterContext: string;
  hasAdditions: boolean;
  hasRemovals: boolean;
}

// Cache for diff results to avoid redundant API calls
const diffCache = new Map<string, DiffResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  result: DiffResult;
  timestamp: number;
}

/**
 * Generate a cache key for diff operations
 */
function generateCacheKey(currentContent: any, previousContent: any): string {
  const current = typeof currentContent === 'string' ? currentContent : JSON.stringify(currentContent || '');
  const previous = typeof previousContent === 'string' ? previousContent : JSON.stringify(previousContent || '');
  
  // Create a hash-like key (simple but effective for caching)
  return `${current.length}:${previous.length}:${current.slice(0, 100)}:${previous.slice(0, 100)}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Main diff calculation function - uses centralized API
 * This replaces all other diff implementations in the codebase
 */
export async function calculateDiff(currentContent: any, previousContent: any): Promise<DiffResult> {
  // Check cache first
  const cacheKey = generateCacheKey(currentContent, previousContent);
  const cached = diffCache.get(cacheKey);
  
  if (cached && isCacheValid(cached)) {
    return cached.result;
  }

  try {
    const response = await fetch('/api/diff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentContent,
        previousContent
      })
    });

    if (!response.ok) {
      throw new Error(`Diff API error: ${response.status}`);
    }

    const result: DiffResult = await response.json();
    
    // Cache the result
    diffCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('Error calculating diff:', error);
    
    // Fallback to simple comparison
    return {
      added: 0,
      removed: 0,
      operations: [],
      preview: null,
      hasChanges: false
    };
  }
}

/**
 * Check if content has meaningful changes
 * This replaces hasContentChanged from contentNormalization
 */
export async function hasContentChanged(currentContent: any, previousContent: any): Promise<boolean> {
  const diff = await calculateDiff(currentContent, previousContent);
  return diff.hasChanges;
}

/**
 * Get diff statistics - the main function for getting diff statistics
 * This replaces all generateSimpleDiff functions with a clean, simple name
 */
export async function diff(currentContent: any, previousContent: any): Promise<{ added: number; removed: number }> {
  const result = await calculateDiff(currentContent, previousContent);
  return {
    added: result.added,
    removed: result.removed
  };
}

/**
 * Alias for diff() - kept for backward compatibility
 */
export async function getDiff(currentContent: any, previousContent: any): Promise<{ added: number; removed: number }> {
  return diff(currentContent, previousContent);
}

/**
 * @deprecated Use diff() instead
 * Backward compatibility alias for generateSimpleDiff
 */
export async function getSimpleDiff(currentContent: any, previousContent: any): Promise<{ added: number; removed: number }> {
  return diff(currentContent, previousContent);
}

/**
 * @deprecated Use diff() instead
 * Backward compatibility alias for generateSimpleDiff
 */
export async function generateSimpleDiff(currentContent: any, previousContent: any): Promise<{ added: number; removed: number }> {
  return diff(currentContent, previousContent);
}

/**
 * Get diff preview for display in activity cards
 * This replaces generateTextDiff and other preview functions
 */
export async function getDiffPreview(currentContent: any, previousContent: any): Promise<DiffPreview | null> {
  const diff = await calculateDiff(currentContent, previousContent);
  return diff.preview;
}

/**
 * Clear the diff cache (useful for testing or memory management)
 */
export function clearDiffCache(): void {
  diffCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getDiffCacheStats(): { size: number; entries: string[] } {
  return {
    size: diffCache.size,
    entries: Array.from(diffCache.keys())
  };
}

/**
 * Synchronous content comparison for cases where API calls aren't feasible
 * This is a simplified fallback that should only be used when absolutely necessary
 */
export function hasContentChangedSync(currentContent: any, previousContent: any): boolean {
  try {
    const current = typeof currentContent === 'string' ? currentContent : JSON.stringify(currentContent || '');
    const previous = typeof previousContent === 'string' ? previousContent : JSON.stringify(previousContent || '');
    
    // Simple string comparison as fallback
    return current.trim() !== previous.trim();
  } catch (error) {
    console.error('Error in sync content comparison:', error);
    return true; // Assume changes if we can't determine
  }
}

// Export types for use in other components
export type { DiffOperation, DiffResult, DiffPreview };
