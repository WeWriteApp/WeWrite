/**
 * Utility functions for managing saved searches
 */

// Maximum number of saved searches to store
const MAX_SAVED_SEARCHES = 20;

/**
 * Save a search query
 * 
 * @param {string} searchTerm - The search term to save
 * @param {string} userId - The user ID (optional)
 * @returns {boolean} - Whether the search was saved successfully
 */
export const saveSearchQuery = (searchTerm, userId = null) => {
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
    let savedSearches = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];
    
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
 * 
 * @param {string} userId - The user ID (optional)
 * @returns {Array} - Array of saved searches
 */
export const getSavedSearches = (userId = null) => {
  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `savedSearches_${userId}` : 'savedSearches';
    
    // Get saved searches from localStorage
    const savedSearchesStr = localStorage.getItem(storageKey);
    let savedSearches = savedSearchesStr ? JSON.parse(savedSearchesStr) : [];
    
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
 * 
 * @param {number} index - The index of the search to delete
 * @param {string} userId - The user ID (optional)
 * @returns {boolean} - Whether the search was deleted successfully
 */
export const deleteSavedSearch = (index, userId = null) => {
  try {
    // Create a storage key that's specific to the user if provided
    const storageKey = userId ? `savedSearches_${userId}` : 'savedSearches';
    
    // Get existing saved searches
    const existingSearchesStr = localStorage.getItem(storageKey);
    let savedSearches = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];
    
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
 * 
 * @param {string} userId - The user ID (optional)
 * @returns {boolean} - Whether the searches were cleared successfully
 */
export const clearSavedSearches = (userId = null) => {
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
