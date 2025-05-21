/**
 * Link Validator Utility
 *
 * This module provides functions for validating and standardizing link data structures
 * to ensure compatibility between different versions of the editor.
 *
 * CRITICAL FIX: This utility addresses a compatibility issue between old and new link formats.
 *
 * Problem:
 * - Links created with older versions of the editor had properties like `className` and `isPageLink`
 * - Links created with newer versions were missing these properties
 * - The view component expected these properties to be present
 * - This caused links to be invisible or improperly rendered in view mode
 *
 * Solution:
 * - This utility standardizes all link objects to include all required properties
 * - It works with both old and new link formats
 * - It adds version tracking to help with future compatibility
 * - It provides consistent methods for extracting link text and page IDs
 *
 * Usage:
 * - When creating or updating links, pass them through validateLink()
 * - When extracting text from links, use getLinkDisplayText()
 * - When extracting page IDs from URLs, use extractPageIdFromUrl()
 */

/**
 * Validates and standardizes a link object to ensure it has all required properties
 * for both the editor and view components.
 *
 * @param {Object} linkData - The link data to validate
 * @returns {Object} - A standardized link object with all required properties
 */
export function validateLink(linkData) {
  if (!linkData) return null;

  // Create a copy to avoid modifying the original
  const link = { ...linkData };

  // Ensure type is set
  if (!link.type) {
    link.type = 'link';
  }

  // Extract pageId from URL if not provided
  if (!link.pageId && link.url && link.url.includes('/pages/')) {
    const match = link.url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
    if (match) {
      link.pageId = match[1];
    }
  }

  // Determine link type based on available properties
  const isUserLink = link.isUser || link.userId || (link.url && link.url.startsWith('/user/'));
  const isPageLink = link.isPageLink || link.pageId || (link.url && (link.url.startsWith('/pages/') || link.url.match(/^\/[a-zA-Z0-9-_]+$/)));
  const isExternalLink = link.isExternal || (!isUserLink && !isPageLink && link.url && (link.url.startsWith('http://') || link.url.startsWith('https://')));

  // Set missing properties based on link type
  if (isUserLink) {
    link.isUser = true;
    if (!link.className) link.className = 'user-link';
  } else if (isPageLink) {
    link.isPageLink = true;
    if (!link.className) link.className = 'page-link';
  } else if (isExternalLink) {
    link.isExternal = true;
    if (!link.className) link.className = 'external-link';
  }

  // Ensure children array exists
  if (!link.children || !Array.isArray(link.children) || link.children.length === 0) {
    // Create default text from available properties
    let text = '';
    if (isPageLink && link.pageTitle) {
      text = link.pageTitle;
    } else if (isUserLink && link.username) {
      text = link.username;
    } else if (link.displayText) {
      text = link.displayText;
    } else if (link.url) {
      text = link.url;
    } else {
      text = 'Link';
    }

    link.children = [{ text }];
  }

  // Add version tracking for future compatibility
  if (!link.linkVersion) {
    link.linkVersion = 2;
  }

  return link;
}

/**
 * Extracts the display text from a link object
 *
 * @param {Object} linkData - The link data
 * @returns {string} - The display text for the link
 */
export function getLinkDisplayText(linkData) {
  if (!linkData) return 'Link';

  // First check for pageTitle as it's the most reliable source for page links
  if (linkData.pageTitle) {
    return linkData.pageTitle;
  }

  // Then check for explicit display text
  if (linkData.displayText) {
    return linkData.displayText;
  }

  // Check for text in children
  if (linkData.children && Array.isArray(linkData.children) && linkData.children.length > 0) {
    // Check for direct text in first child
    if (linkData.children[0].text) {
      return linkData.children[0].text;
    }

    // Try to find any child with text
    for (const child of linkData.children) {
      if (child.text) {
        return child.text;
      }
    }
  }

  // Use URL as fallback
  if (linkData.url) {
    return linkData.url;
  }

  // Last resort
  return 'Link';
}

/**
 * Extracts a page ID from a URL
 *
 * @param {string} url - The URL to extract from
 * @returns {string|null} - The extracted page ID or null if not found
 */
export function extractPageIdFromUrl(url) {
  if (!url) return null;

  // Check for /pages/{id} format
  const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];

  // Check for /{id} format (direct page ID)
  const directMatch = url.match(/^\/([a-zA-Z0-9-_]+)$/);
  if (directMatch) return directMatch[1];

  return null;
}
