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

  // Add more robust error handling
  try {
    // Additional safety check for circular references
    if (linkData === linkData.children || linkData === linkData.link) {
      console.warn('Circular reference detected in link data');
      return null;
    }
    // Create a deep copy to avoid modifying the original
    let link;
    try {
      link = JSON.parse(JSON.stringify(linkData));
    } catch (copyError) {
      // Use shallow copy as fallback
      link = { ...linkData };
    }

    // CRITICAL FIX: Ensure type is set
    if (!link.type) {
      link.type = 'link';
    }

    // CRITICAL FIX: Handle malformed links that might be nested objects
    // Sometimes links can be nested inside other objects due to serialization issues
    if (link.link && typeof link.link === 'object') {
      // Merge the nested link properties with the parent
      Object.assign(link, link.link);
      // Remove the nested link to avoid duplication
      delete link.link;
    }

    // CRITICAL FIX: Ensure the link has a unique ID
    // This helps React with keying and prevents rendering issues
    if (!link.id) {
      link.id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // CRITICAL FIX: Ensure children array exists and has at least one text node
    if (!link.children || !Array.isArray(link.children) || link.children.length === 0) {
      // Create a default text node if none exists
      const displayText = link.displayText || link.text || (link.pageTitle ? link.pageTitle : 'Link');
      link.children = [{ text: displayText }];
    }

    // CRITICAL FIX: Ensure all children have text property
    link.children = link.children.map(child => {
      if (typeof child === 'string') {
        return { text: child };
      }
      if (!child.text && child.displayText) {
        return { text: child.displayText };
      }
      if (!child.text) {
        return { text: 'Link' };
      }
      return child;
    });

    // CRITICAL FIX: Handle links that might be in a data property
    if (link.data && typeof link.data === 'object') {
      // Check if data contains link properties
      if (link.data.url || link.data.href || link.data.pageId || link.data.displayText) {
        // Merge the data properties with the parent
        Object.assign(link, link.data);
      }
    }

    // CRITICAL FIX: Ensure URL is set
    if (!link.url) {
      // Try to extract URL from href or other properties
      link.url = link.href || '#';
    }

    // CRITICAL FIX: Ensure displayText is set and preserve originalPageTitle
    if (!link.displayText) {
      // Try to extract displayText from various properties
      link.displayText = link.text || link.pageTitle || 'Link';
    }

    // CRITICAL FIX: Preserve originalPageTitle for immediate display
    if (link.pageTitle && !link.originalPageTitle) {
      link.originalPageTitle = link.pageTitle;
    }

    // CRITICAL FIX: Ensure children array exists and has proper structure
    if (!link.children || !Array.isArray(link.children) || link.children.length === 0) {
      // Create a default child with text from displayText or a fallback
      const text = link.displayText || link.text || link.pageTitle || 'Link';
      link.children = [{ text }];
    } else {
      // Ensure each child has a text property
      link.children = link.children.map(child => {
        if (!child) {
          return { text: link.displayText || 'Link' };
        }
        if (typeof child === 'string') {
          return { text: child };
        }
        if (!child.text && typeof child === 'object') {
          return { ...child, text: link.displayText || 'Link' };
        }
        return child;
      }).filter(Boolean); // Remove any null/undefined children

      // If we ended up with an empty array after filtering, add a default child
      if (link.children.length === 0) {
        link.children = [{ text: link.displayText || 'Link' }];
      }
    }

    // CRITICAL FIX: Extract pageId from URL if not provided - handle both formats
    if (!link.pageId && link.url) {
      // Handle /pages/{id} format
      let match = link.url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
      if (match) {
        link.pageId = match[1];
      } else {
        // Handle /{id} format (direct page ID) - FIXED: More flexible pattern
        match = link.url.match(/^\/([a-zA-Z0-9-_]+)$/);
        if (match) {
          link.pageId = match[1];
        }
      }
    }

    // Determine link type based on available properties
    const isUserLink = link.isUser || link.userId || (link.url && link.url.startsWith('/user/'));
    const isPageLink = link.isPageLink || link.pageId || (link.url && (link.url.startsWith('/pages/') || link.url.match(/^\/[a-zA-Z0-9-_]+$/)));
    const isExternalLink = link.isExternal || (!isUserLink && !isPageLink && link.url && (link.url.startsWith('http://') || link.url.startsWith('https://')));

    // Set missing properties based on link type
    if (isUserLink) {
      link.isUser = true;
      // Don't set className for inline links in Slate editor
    } else if (isPageLink) {
      link.isPageLink = true;
      // Don't set className for inline links in Slate editor

      // CRITICAL FIX: Ensure pageId is always set for page links
      if (!link.pageId && link.url) {
        // Try to extract pageId from URL again with a more flexible pattern
        const match = link.url.match(/\/pages\/([a-zA-Z0-9-_]+)/) || link.url.match(/\/([a-zA-Z0-9-_]+)$/);
        if (match) {
          link.pageId = match[1];
        }
      }

      // CRITICAL FIX: Preserve originalPageTitle for page links
      if (link.pageTitle && !link.originalPageTitle) {
        link.originalPageTitle = link.pageTitle;
      }
    } else if (isExternalLink) {
      link.isExternal = true;
      // Don't set className for inline links in Slate editor
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

    // CRITICAL FIX: Ensure displayText is set for compatibility with both renderers
    if (!link.displayText) {
      // Try to extract display text from children
      if (link.children && Array.isArray(link.children) && link.children.length > 0) {
        const firstChild = link.children[0];
        if (firstChild.text) {
          link.displayText = firstChild.text;
        }
      }

      // If still no display text, use pageTitle or a fallback
      if (!link.displayText) {
        if (isPageLink && link.pageTitle) {
          link.displayText = link.pageTitle;
          // Also preserve as originalPageTitle if not already set
          if (!link.originalPageTitle) {
            link.originalPageTitle = link.pageTitle;
          }
        } else if (isUserLink && link.username) {
          link.displayText = link.username;
        } else if (link.url) {
          link.displayText = link.url;
        } else {
          link.displayText = 'Link';
        }
      }
    }

    // CRITICAL FIX: Preserve compound link properties
    // These properties are used for rendering compound links with author information
    if (linkData.showAuthor !== undefined) {
      link.showAuthor = linkData.showAuthor;
    }
    if (linkData.authorUsername !== undefined) {
      link.authorUsername = linkData.authorUsername;
    }

    // Add version tracking for future compatibility
    if (!link.linkVersion) {
      link.linkVersion = 3; // Increment version to indicate the new format
    }

    return link;
  } catch (error) {
    // Create a minimal valid link as fallback with a unique ID
    const fallbackDisplayText = linkData?.displayText || linkData?.pageTitle || linkData?.children?.[0]?.text || 'Link (Error)';
    return {
      type: 'link',
      url: linkData?.url || '#',
      children: [{ text: fallbackDisplayText }],
      displayText: fallbackDisplayText,
      originalPageTitle: linkData?.pageTitle || linkData?.originalPageTitle || null,
      pageId: linkData?.pageId || null,
      // Preserve compound link properties in fallback
      showAuthor: linkData?.showAuthor || false,
      authorUsername: linkData?.authorUsername || null,
      linkVersion: 3,
      isError: true,
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }
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