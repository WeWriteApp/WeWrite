/**
 * Utility functions for consistent formatting of links and titles
 * These functions ensure that page titles never have @ symbols
 * and usernames always have @ symbols
 */

/**
 * Format a page title to ensure it never has an @ symbol
 * @param {string} title - The page title to format
 * @returns {string} - The formatted page title
 */
export const formatPageTitle = (title) => {
  if (!title) return "Untitled";
  // Remove @ symbol if present at the beginning of page titles
  return title.startsWith('@') ? title.substring(1) : title;
};

/**
 * Format a username to ensure it always has an @ symbol
 * @param {string} username - The username to format
 * @returns {string} - The formatted username
 */
export const formatUsername = (username) => {
  if (!username) return "Anonymous";
  // Don't add @ symbol anymore - we're removing them from the UI
  return username.startsWith('@') ? username.substring(1) : username;
};

/**
 * Determine if a link is a user link based on its URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a user link, false otherwise
 */
export const isUserLink = (url) => {
  if (!url) return false;
  return url.includes('/user/') || url.includes('/u/');
};

/**
 * Determine if a link is a page link based on its URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a page link, false otherwise
 */
export const isPageLink = (url) => {
  if (!url) return false;
  // If it's not a user link, external link, or group link, it's a page link
  return !isUserLink(url) &&
         !isExternalLink(url) &&
         !url.includes('/group/') &&
         !url.includes('/g/');
};

/**
 * Determine if a link is an external link
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's an external link, false otherwise
 */
export const isExternalLink = (url) => {
  if (!url) return false;
  return url.startsWith('http://') ||
         url.startsWith('https://') ||
         url.startsWith('www.') ||
         url.includes('://');
};
