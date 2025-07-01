/**
 * Utility functions for managing saved searches
 */

// Maximum number of saved searches to store
const MAX_SAVED_SEARCHES = 20;

interface SavedSearch {
  term: string;
  timestamp: number;
}

/**
 * Save a search query
 */
export const saveSearchQuery = (searchTerm: string, userId: string | null = null): boolean => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return false;
  }

  // Trim the search term
  const trimmedTerm = searchTerm.trim();

  // Don't save empty searches
  if (!trimmedTerm) {
    return false;
  }

  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `savedSearches_${userId}` : 'savedSearches';

    // Get existing saved searches
    const existingSearchesStr = localStorage.getItem(storageKey);
    let savedSearches: SavedSearch[] = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(savedSearches)) {
      savedSearches = [];
    }

    // Check if this search term already exists
    const existingIndex = savedSearches.findIndex(item =>
      item.term.toLowerCase() === trimmedTerm.toLowerCase()
    );

    // If it already exists, don't add it again
    if (existingIndex !== -1) {
      return false;
    }

    // Add the new search term with timestamp
    savedSearches.push({
      term: trimmedTerm,
      timestamp: Date.now()
    });

    // Keep only the maximum number of saved searches
    if (savedSearches.length > MAX_SAVED_SEARCHES) {
      savedSearches = savedSearches.slice(-MAX_SAVED_SEARCHES);
    }

    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(savedSearches));
    return true;
  } catch (error) {
    console.error("Error saving search query:", error);
    return false;
  }
};

/**
 * Get the list of saved searches
 */
export const getSavedSearches = (userId: string | null = null): SavedSearch[] => {
  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `savedSearches_${userId}` : 'savedSearches';

    // Get saved searches from localStorage
    const savedSearchesStr = localStorage.getItem(storageKey);
    let savedSearches: SavedSearch[] = savedSearchesStr ? JSON.parse(savedSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(savedSearches)) {
      return [];
    }

    return savedSearches;
  } catch (error) {
    console.error("Error getting saved searches:", error);
    return [];
  }
};

/**
 * Delete a saved search by index
 */
export const deleteSavedSearch = (index: number, userId: string | null = null): boolean => {
  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `savedSearches_${userId}` : 'savedSearches';

    // Get existing saved searches
    const existingSearchesStr = localStorage.getItem(storageKey);
    let savedSearches: SavedSearch[] = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    // Ensure it's an array
    if (!Array.isArray(savedSearches) || index < 0 || index >= savedSearches.length) {
      return false;
    }

    // Remove the search at the specified index
    savedSearches.splice(index, 1);

    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(savedSearches));
    return true;
  } catch (error) {
    console.error("Error deleting saved search:", error);
    return false;
  }
};

/**
 * Clear all saved searches
 */
export const clearSavedSearches = (userId: string | null = null): boolean => {
  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `savedSearches_${userId}` : 'savedSearches';

    // Clear saved searches
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    console.error("Error clearing saved searches:", error);
    return false;
  }
};