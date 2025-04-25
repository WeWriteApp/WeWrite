"use client";

/**
 * Centralized search rules for the application
 * This module defines the rules for searching pages and users
 * and can be imported by any component that needs to perform searches
 */

/**
 * Get the base search rules for pages
 * @returns {Object} The base search rules
 */
export const getBasePageSearchRules = () => {
  return {
    // Minimum characters required to trigger a search
    minCharacters: 2,
    
    // Maximum results to return
    maxResults: 20,
    
    // Whether to include private pages in search results
    // This will be overridden based on the user's permissions
    includePrivate: false,
    
    // Whether to use scoring to rank results
    useScoring: true,
    
    // Fields to search in
    searchFields: ['title'],
    
    // Order results by
    orderBy: 'lastModified',
    
    // Order direction
    orderDirection: 'desc'
  };
};

/**
 * Get search rules for a specific user's pages
 * @param {string} userId - The ID of the user whose pages to search
 * @param {string} currentUserId - The ID of the current user
 * @returns {Object} The search rules for the user's pages
 */
export const getUserPageSearchRules = (userId, currentUserId) => {
  const baseRules = getBasePageSearchRules();
  
  // If the user is searching their own pages, include private pages
  const includePrivate = userId === currentUserId;
  
  return {
    ...baseRules,
    includePrivate,
    filterByUserId: userId
  };
};

/**
 * Apply privacy filtering to search results
 * @param {Array} results - The search results to filter
 * @param {string} currentUserId - The ID of the current user
 * @returns {Array} The filtered search results
 */
export const applyPrivacyFiltering = (results, currentUserId) => {
  if (!results || !Array.isArray(results)) return [];
  
  return results.filter(item => {
    // If the item has no privacy setting, assume it's public
    if (item.isPublic === undefined) return true;
    
    // If the item is public, include it
    if (item.isPublic === true) return true;
    
    // If the item is private, only include it if the current user is the owner
    return item.userId === currentUserId;
  });
};

/**
 * Build a search query URL with the appropriate parameters
 * @param {Object} options - The search options
 * @param {string} options.userId - The ID of the current user
 * @param {string} options.searchTerm - The search term
 * @param {Array} options.groupIds - The IDs of the groups the user belongs to
 * @param {string} options.filterByUserId - The ID of the user to filter by (optional)
 * @param {boolean} options.useScoring - Whether to use scoring to rank results
 * @returns {string} The search query URL
 */
export const buildSearchQueryUrl = (options) => {
  const {
    userId,
    searchTerm,
    groupIds = [],
    filterByUserId = null,
    useScoring = true
  } = options;
  
  let url = `/api/search?userId=${userId}&searchTerm=${encodeURIComponent(searchTerm)}`;
  
  // Add group IDs if available
  if (groupIds && groupIds.length > 0) {
    url += `&groupIds=${groupIds.join(',')}`;
  }
  
  // Add filter by user ID if available
  if (filterByUserId) {
    url += `&filterByUserId=${filterByUserId}`;
  }
  
  // Add scoring parameter
  url += `&useScoring=${useScoring}`;
  
  return url;
};
