/**
 * Utility functions for consistent formatting of links and titles
 * These functions ensure that page titles never have @ symbols
 * and usernames always have @ symbols
 */

/**
 * Format a page title to ensure it never has an @ symbol
 */
export const formatPageTitle = (title: string): string => {
  if (!title) return "Untitled";
  // Remove @ symbol if present at the beginning of page titles
  return title.startsWith('@') ? title.substring(1) : title;
};

/**
 * Format a username to ensure it always has an @ symbol
 */
export const formatUsername = (username: string): string => {
  if (!username) return "Anonymous";
  // Don't add @ symbol anymore - we're removing them from the UI
  return username.startsWith('@') ? username.substring(1) : username;
};

/**
 * Determine if a link is a user link based on its URL
 */
export const isUserLink = (url: string): boolean => {
  if (!url) return false;
  return url.includes('/user/');
};

/**
 * Determine if a link is a group link based on its URL
 */
export const isGroupLink = (url: string): boolean => {
  if (!url) return false;
  return url.includes('/group/') || url.includes('/g/');
};

/**
 * Determine if a link is a page link based on its URL
 */
export const isPageLink = (url: string): boolean => {
  if (!url) return false;
  // If it's not a user link, external link, or group link, it's a page link
  return !isUserLink(url) &&
         !isExternalLink(url) &&
         !isGroupLink(url);
};

/**
 * Determine if a link is an external link
 */
export const isExternalLink = (url: string): boolean => {
  if (!url) return false;
  return url.startsWith('http://') ||
         url.startsWith('https://') ||
         url.startsWith('www.') ||
         url.includes('://');
};