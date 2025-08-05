"use client";

/**
 * Maximum number of recent searches to store
 */
const MAX_RECENT_SEARCHES = 10;

/**
 * Add a search term to the recent searches list
 * Now uses database storage for authenticated users with localStorage fallback
 *
 * @param {string} searchTerm - The search term to add
 * @param {string} userId - The user ID (required for database storage)
 */
export const addRecentSearch = async (searchTerm, userId = null) => {
  if (!searchTerm || typeof window === 'undefined') return;

  // Trim the search term and ensure it's not empty
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm) return;

  // If user is authenticated, save to database
  if (userId) {
    try {
      const response = await fetch('/api/user-preferences/recent-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: trimmedTerm }),
      });

      if (response.ok) {
        console.log('Recent search saved to database');
        return;
      } else {
        console.warn('Failed to save recent search to database, falling back to localStorage');
      }
    } catch (error) {
      console.warn('Error saving recent search to database, falling back to localStorage:', error);
    }
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
 * Get the list of recent searches
 * Now fetches from database for authenticated users with localStorage fallback
 *
 * @param {string} userId - The user ID (required for database storage)
 * @returns {Promise<Array>} - Array of recent search objects with term and timestamp
 */
export const getRecentSearches = async (userId = null) => {
  if (typeof window === 'undefined') return [];

  // If user is authenticated, try to get from database first
  if (userId) {
    try {
      const response = await fetch('/api/user-preferences/recent-searches');

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data.recentSearches)) {
          return data.data.recentSearches;
        }
      } else {
        console.warn('Failed to fetch recent searches from database, falling back to localStorage');
      }
    } catch (error) {
      console.warn('Error fetching recent searches from database, falling back to localStorage:', error);
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
      return [];
    }

    return recentSearches;
  } catch (error) {
    console.error("Error getting recent searches from localStorage:", error);
    return [];
  }
};

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