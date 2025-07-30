"use client";

/**
 * Maximum number of recent searches to store
 */
const MAX_RECENT_SEARCHES = 10;

/**
 * Add a search term to the recent searches list
 * 
 * @param {string} searchTerm - The search term to add
 * @param {string} userId - The user ID (optional)
 */
export const addRecentSearch = (searchTerm, userId = null) => {
  if (!searchTerm || typeof window === 'undefined') return;
  
  // Trim the search term and ensure it's not empty
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm) return;
  
  try {
    // Create a storage key that's specific to the user if provided
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
    console.error("Error adding recent search:", error);
  }
};

/**
 * Get the list of recent searches
 * 
 * @param {string} userId - The user ID (optional)
 * @returns {Array} - Array of recent search objects with term and timestamp
 */
export const getRecentSearches = (userId = null) => {
  if (typeof window === 'undefined') return [];
  
  try {
    // Create a storage key that's specific to the user if provided
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
    console.error("Error getting recent searches:", error);
    return [];
  }
};

/**
 * Clear all recent searches
 * 
 * @param {string} userId - The user ID (optional)
 */
export const clearRecentSearches = (userId = null) => {
  if (typeof window === 'undefined') return;
  
  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';
    
    // Remove the item from localStorage
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Error clearing recent searches:", error);
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