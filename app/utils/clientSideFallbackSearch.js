/**
 * Client-side fallback search utility
 * This provides a fallback when the server-side search returns no results
 */

// Empty arrays for fallback search
const samplePageTitles = [];
const sampleUsernames = [];

/**
 * Generate a fallback search result for a given search term
 * We no longer provide fallback results to ensure only real content is shown
 * @param {string} searchTerm - The search term to match against
 * @param {string} userId - The current user's ID
 * @returns {Object} - Empty object with empty pages and users arrays
 */
export function generateFallbackSearchResults(searchTerm, userId) {
  // Always return empty arrays
  return { pages: [], users: [] };
}

/**
 * Check if a search term should trigger the fallback search
 * We no longer use fallback search to ensure only real content is shown
 * @param {string} searchTerm - The search term to check
 * @returns {boolean} - Always returns false
 */
export function shouldUseFallbackForTerm(searchTerm) {
  // Always return false to disable fallback search
  return false;
}
