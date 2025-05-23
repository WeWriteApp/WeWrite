/**
 * Client-side fallback search utility
 * This provides a fallback when the server-side search returns no results
 */

// Sample data for fallback search - these will be suggested when no real results are found
const samplePageTitles = [
  'Getting Started',
  'Documentation',
  'User Guide',
  'FAQ',
  'Help',
  'About',
  'Contact',
  'Privacy Policy',
  'Terms of Service',
  'Tutorial'
];

const sampleUsernames = [
  'admin',
  'support',
  'help'
];

/**
 * Generate a fallback search result for a given search term
 * Temporarily disabled to focus on fixing real search results
 * @param {string} searchTerm - The search term to match against
 * @param {string} userId - The current user's ID
 * @returns {Object} - Empty object to force real search results only
 */
export function generateFallbackSearchResults(searchTerm, userId) {
  console.log(`Fallback search called for "${searchTerm}" but returning empty results to focus on real data`);
  return { pages: [], users: [] };
}

/**
 * Check if a search term should trigger the fallback search
 * Temporarily disabled to focus on fixing real search results
 * @param {string} searchTerm - The search term to check
 * @returns {boolean} - Always returns false to disable fallback
 */
export function shouldUseFallbackForTerm(searchTerm) {
  return false; // Disabled to focus on real search results
}
