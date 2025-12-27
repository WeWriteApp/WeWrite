/**
 * Utility functions for consistent formatting of links and titles
 *
 * Design Decision: Usernames are displayed WITHOUT the @ symbol.
 * Users are differentiated by their subscription tier badge, not by @.
 * This applies to pills, badges, and all username displays.
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
 * Format a username - strips any @ symbol prefix
 * Users are differentiated by subscription tier badge, not @
 */
export const formatUsername = (username: string): string => {
  if (!username) return "Anonymous";
  // Strip @ symbol if present - usernames are identified by tier badge
  return username.startsWith('@') ? username.substring(1) : username;
};

/**
 * Determine if a link is a user link based on its URL
 */
export const isUserLink = (url: string): boolean => {
  if (!url) return false;
  // Support both new /u/ route and legacy /user/ route
  return url.includes('/u/') || url.includes('/user/');
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