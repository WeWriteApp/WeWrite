"use client";

/**
 * Maximum number of recent searches to store
 */
const MAX_RECENT_SEARCHES = 10;

/**
 * Debounce timeout for saving recent searches
 */
let saveSearchTimeout = null;

/**
 * Add a search term to the recent searches list
 * OPTIMIZED: Primarily uses localStorage with periodic database sync to reduce reads
 * SMART FILTERING: Only saves meaningful searches, not incremental typing
 *
 * @param {string} searchTerm - The search term to add
 * @param {string} userId - The user ID (required for database storage)
 */
export const addRecentSearch = async (searchTerm, userId = null) => {
  if (!searchTerm || typeof window === 'undefined') return;

  // Trim the search term and ensure it's not empty
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm) return;

  // SMART FILTERING: Only save meaningful searches
  // 1. Must be at least 2 characters (avoid single character searches)
  if (trimmedTerm.length < 2) return;

  // 2. Don't save if it's just a common word or very short
  const commonWords = ['a', 'an', 'the', 'is', 'at', 'it', 'on', 'be', 'to', 'of', 'and', 'or'];
  if (commonWords.includes(trimmedTerm.toLowerCase())) return;

  // OPTIMIZATION: Always save to localStorage first for instant response
  const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

  try {
    // Get existing recent searches from localStorage
    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    // 3. SMART FILTERING: Don't save if it's just an incremental search
    // Check if this search term is a substring of a recent search or vice versa
    const isIncrementalSearch = recentSearches.some(item => {
      const existingTerm = item.term.toLowerCase();
      const newTerm = trimmedTerm.toLowerCase();

      // Don't save if the new term is a prefix of an existing term
      // e.g., don't save "tes" if "test" already exists
      if (existingTerm.startsWith(newTerm) && existingTerm.length > newTerm.length) {
        return true;
      }

      // Don't save if it's exactly the same (case insensitive)
      if (existingTerm === newTerm) {
        return true;
      }

      return false;
    });

    if (isIncrementalSearch) {
      console.log(`Skipping incremental search: "${trimmedTerm}"`);
      return;
    }

    // Remove this search term if it already exists (to avoid duplicates)
    // Also remove any terms that are prefixes of the new term
    recentSearches = recentSearches.filter(item => {
      const existingTerm = item.term.toLowerCase();
      const newTerm = trimmedTerm.toLowerCase();

      // Remove exact matches
      if (existingTerm === newTerm) return false;

      // Remove shorter terms that are prefixes of the new term
      // e.g., remove "tes" when adding "test"
      if (newTerm.startsWith(existingTerm) && newTerm.length > existingTerm.length) {
        console.log(`Removing prefix search: "${item.term}" (replaced by "${trimmedTerm}")`);
        return false;
      }

      return true;
    });

    // Add the new search term to the beginning with timestamp
    recentSearches.unshift({
      term: trimmedTerm,
      timestamp: Date.now(),
      synced: false // Mark as not synced to database
    });

    // Keep only the most recent searches
    recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);

    // Save to localStorage immediately
    localStorage.setItem(storageKey, JSON.stringify(recentSearches));

    // OPTIMIZATION: Only sync to database periodically to reduce writes
    if (userId) {
      // Check if we should sync (every 5 searches or every 5 minutes)
      const lastSync = localStorage.getItem(`lastSearchSync_${userId}`);
      const now = Date.now();
      const unsyncedCount = recentSearches.filter(item => !item.synced).length;

      const shouldSync = !lastSync ||
                        (now - parseInt(lastSync) > 5 * 60 * 1000) || // 5 minutes
                        unsyncedCount >= 5; // 5 unsynced searches

      if (shouldSync) {
        // Sync to database in background (don't await)
        syncRecentSearchesToDatabase(userId, recentSearches).catch(error => {
          console.warn('Background sync of recent searches failed:', error);
        });
      }
    }
  } catch (error) {
    console.error("Error adding recent search to localStorage:", error);
  }

  // Fallback to localStorage (for unauthenticated users or when API fails)
  try {
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

    // Get existing recent searches
    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    // Remove this search term if it already exists (to avoid duplicates)
    recentSearches = recentSearches.filter(item =>
      item.term.toLowerCase() !== trimmedTerm.toLowerCase()
    );

    // Add the new search term to the beginning with timestamp
    recentSearches.unshift({
      term: trimmedTerm,
      timestamp: Date.now()
    });

    // Keep only the most recent searches
    recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);

    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(recentSearches));
  } catch (error) {
    console.error("Error adding recent search to localStorage:", error);
  }
};

/**
 * Debounced version of addRecentSearch - only saves after user stops typing
 * This prevents saving every keystroke as a separate search
 *
 * @param {string} searchTerm - The search term to add
 * @param {string} userId - The user ID (required for database storage)
 * @param {number} delay - Debounce delay in milliseconds (default: 1000ms)
 */
export const addRecentSearchDebounced = (searchTerm, userId = null, delay = 1000) => {
  // Clear existing timeout
  if (saveSearchTimeout) {
    clearTimeout(saveSearchTimeout);
  }

  // Set new timeout
  saveSearchTimeout = setTimeout(() => {
    addRecentSearch(searchTerm, userId);
  }, delay);
};

/**
 * Get the list of recent searches
 * Now fetches from database for authenticated users with localStorage fallback
 *
 * @param {string} userId - The user ID (required for database storage)
 * @returns {Promise<Array>} - Array of recent search objects with term and timestamp
 */
export const getRecentSearches = async (userId = null) => {
  if (typeof window === 'undefined') return [];

  const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

  // OPTIMIZATION: Always load from localStorage first for instant response
  try {
    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    // OPTIMIZATION: Only sync from database on first load or periodically
    if (userId && recentSearches.length === 0) {
      // Try to load from database only if localStorage is empty
      try {
        const response = await fetch('/api/user-preferences/recent-searches');

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data.recentSearches)) {
            console.log('Recent searches loaded from database (first time)');
            // Save to localStorage for future instant access
            localStorage.setItem(storageKey, JSON.stringify(data.data.recentSearches));
            return data.data.recentSearches;
          }
        }
      } catch (error) {
        console.warn('Error fetching recent searches from database:', error);
      }
    }

    return recentSearches;
  } catch (error) {
    console.error("Error getting recent searches from localStorage:", error);
    return [];
  }
};

/**
 * OPTIMIZATION: Background sync function to reduce database writes
 */
async function syncRecentSearchesToDatabase(userId, recentSearches) {
  try {
    // Only sync unsynced items
    const unsyncedSearches = recentSearches.filter(item => !item.synced);

    if (unsyncedSearches.length === 0) {
      return; // Nothing to sync
    }

    console.log(`Syncing ${unsyncedSearches.length} recent searches to database`);

    // Sync the most recent search to database
    const mostRecent = unsyncedSearches[0];
    const response = await fetch('/api/user-preferences/recent-searches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ searchTerm: mostRecent.term }),
    });

    if (response.ok) {
      // Mark all items as synced in localStorage
      const storageKey = `recentSearches_${userId}`;
      const updatedSearches = recentSearches.map(item => ({ ...item, synced: true }));
      localStorage.setItem(storageKey, JSON.stringify(updatedSearches));
      localStorage.setItem(`lastSearchSync_${userId}`, Date.now().toString());
      console.log('Recent searches synced to database successfully');
    } else {
      console.warn('Failed to sync recent searches to database');
    }
  } catch (error) {
    console.error('Error syncing recent searches to database:', error);
  }
}

/**
 * Clear all recent searches
 * Now clears from database for authenticated users with localStorage fallback
 *
 * @param {string} userId - The user ID (required for database storage)
 */
export const clearRecentSearches = async (userId = null) => {
  if (typeof window === 'undefined') return;

  // If user is authenticated, clear from database
  if (userId) {
    try {
      const response = await fetch('/api/user-preferences/recent-searches', {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Recent searches cleared from database');
        // Also clear localStorage to keep them in sync
        const storageKey = `recentSearches_${userId}`;
        localStorage.removeItem(storageKey);
        return;
      } else {
        console.warn('Failed to clear recent searches from database, falling back to localStorage');
      }
    } catch (error) {
      console.warn('Error clearing recent searches from database, falling back to localStorage:', error);
    }
  }

  // Fallback to localStorage
  try {
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Error clearing recent searches from localStorage:", error);
  }
};

/**
 * Remove a specific search term from recent searches
 *
 * @param {string} searchTerm - The search term to remove
 * @param {string} userId - The user ID (required for database storage)
 */
export const removeRecentSearch = async (searchTerm, userId = null) => {
  if (!searchTerm || typeof window === 'undefined') return;

  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm) return;

  // If user is authenticated, remove from database
  if (userId) {
    try {
      const response = await fetch(`/api/user-preferences/recent-searches?term=${encodeURIComponent(trimmedTerm)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Recent search removed from database');
        return data.data.recentSearches || [];
      } else {
        console.warn('Failed to remove recent search from database, falling back to localStorage');
      }
    } catch (error) {
      console.warn('Error removing recent search from database, falling back to localStorage:', error);
    }
  }

  // Fallback to localStorage
  try {
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

    // Get existing recent searches
    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    // Filter out the specific search term
    recentSearches = recentSearches.filter(search =>
      search.term.toLowerCase() !== trimmedTerm.toLowerCase()
    );

    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(recentSearches));

    return recentSearches;
  } catch (error) {
    console.error("Error removing recent search from localStorage:", error);
    return [];
  }
};

/**
 * Maximum number of recently viewed pages to store
 */
const MAX_RECENT_PAGES = 20;

/**
 * Add a page ID to the recently viewed pages list
 *
 * @param {string} pageId - The page ID to add
 */
export const addRecentlyViewedPageId = (pageId) => {
  if (!pageId || typeof window === 'undefined') return;

  try {
    // Get existing recently viewed pages
    const existingPagesStr = localStorage.getItem('recentlyVisitedPages');
    let recentPages = existingPagesStr ? JSON.parse(existingPagesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(recentPages)) {
      recentPages = [];
    }

    // Remove this page if it already exists (to avoid duplicates and move to front)
    recentPages = recentPages.filter(id => id !== pageId);

    // Add the new page ID to the beginning
    recentPages.unshift(pageId);

    // Keep only the most recent pages
    recentPages = recentPages.slice(0, MAX_RECENT_PAGES);

    // Save back to localStorage
    localStorage.setItem('recentlyVisitedPages', JSON.stringify(recentPages));

    console.log('Added page to recently viewed:', pageId);
  } catch (error) {
    console.error("Error adding recently viewed page:", error);
  }
};

/**
 * Get recently viewed pages from localStorage
 *
 * @returns {Array} - Array of page IDs
 */
export const getRecentlyViewedPageIds = () => {
  if (typeof window === 'undefined') return [];

  try {
    const recentlyVisitedStr = localStorage.getItem('recentlyVisitedPages');
    return recentlyVisitedStr ? JSON.parse(recentlyVisitedStr) : [];
  } catch (error) {
    console.error("Error getting recently viewed pages:", error);
    return [];
  }
};