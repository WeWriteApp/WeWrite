/**
 * Clean, maintainable link node data structure
 * 
 * This replaces the confusing mix of text, displayText, originalPageTitle, etc.
 * with a clear separation between auto-generated and custom text.
 */

export interface LinkNode {
  type: 'link';

  // Target information (for internal links)
  pageId?: string; // Optional for external links
  pageTitle?: string; // Current title of the target page (auto-updated)
  url: string; // URL path to the page or external URL

  // Display text logic
  isCustomText: boolean; // Whether user has set custom display text
  customText?: string; // User-provided custom text (only if isCustomText = true)

  // Slate.js structure
  children: Array<{ text: string }>; // The actual rendered text

  // Optional metadata
  isExternal?: boolean; // True for external links
  isPublic?: boolean;
  isOwned?: boolean;
}

/**
 * Helper functions for working with link nodes
 */
export class LinkNodeHelper {
  /**
   * Get the display text for a link node
   */
  static getDisplayText(link: LinkNode): string {
    if (link.isCustomText && link.customText) {
      return link.customText;
    }
    if (link.isExternal) {
      return link.url; // For external links without custom text, show URL
    }
    return link.pageTitle || 'Link';
  }
  
  /**
   * Create a new link node with auto-generated text
   */
  static createAutoLink(pageId: string, pageTitle: string, url: string): LinkNode {
    return {
      type: 'link',
      pageId,
      pageTitle,
      url,
      isCustomText: false,
      children: [{ text: pageTitle }]
      // Note: customText is omitted (not undefined) for auto-generated links
    };
  }

  /**
   * Create a new external link node with URL as display text
   */
  static createAutoExternalLink(url: string): LinkNode {
    return {
      type: 'link',
      url,
      isCustomText: false,
      isExternal: true,
      isPublic: true,
      isOwned: false,
      children: [{ text: url }]
    };
  }
  
  /**
   * Create a new link node with custom text
   */
  static createCustomLink(pageId: string, pageTitle: string, url: string, customText: string): LinkNode {
    return {
      type: 'link',
      pageId,
      pageTitle,
      url,
      isCustomText: true,
      customText,
      children: [{ text: customText }]
    };
  }

  /**
   * Create a new external link node with custom text
   */
  static createCustomExternalLink(url: string, customText: string): LinkNode {
    return {
      type: 'link',
      url,
      isCustomText: true,
      customText,
      isExternal: true,
      isPublic: true,
      isOwned: false,
      children: [{ text: customText }]
    };
  }
  
  /**
   * Update a link node's page title (for auto-generated links only)
   */
  static updatePageTitle(link: LinkNode, newPageTitle: string): LinkNode {
    const updated: any = { ...link, pageTitle: newPageTitle };

    if (!link.isCustomText) {
      // Auto-generated link - update display text too
      updated.children = [{ text: newPageTitle }];
      // Ensure no undefined customText field
      delete updated.customText;
    }
    // Custom text links keep their display text unchanged

    return updated;
  }
  
  /**
   * Convert a link to use custom text
   */
  static setCustomText(link: LinkNode, customText: string): LinkNode {
    return {
      ...link,
      isCustomText: true,
      customText,
      children: [{ text: customText }]
    };
  }
  
  /**
   * Convert a link back to auto-generated text
   */
  static removeCustomText(link: LinkNode): LinkNode {
    const result: any = {
      ...link,
      isCustomText: false,
      children: [{ text: link.pageTitle }]
    };

    // Remove customText field entirely to avoid undefined values
    delete result.customText;

    return result;
  }
  
  /**
   * Check if a link should be updated when page title changes
   */
  static shouldUpdateOnTitleChange(link: LinkNode): boolean {
    return !link.isCustomText;
  }
}

/**
 * Migration helper for old link formats
 */
export class LinkMigrationHelper {
  /**
   * Convert old messy link format to clean LinkNode
   */
  static migrateOldLink(oldLink: any): LinkNode {
    const url = oldLink.url || '';
    const displayText = oldLink.children?.[0]?.text || oldLink.displayText || oldLink.text || '';

    // Check if this is an external link
    if (oldLink.isExternal || (!oldLink.pageId && url && (url.startsWith('http') || url.startsWith('www')))) {
      // External link
      const isCustomText = displayText && displayText !== url;

      if (isCustomText) {
        return LinkNodeHelper.createCustomExternalLink(url, displayText);
      } else {
        return LinkNodeHelper.createAutoExternalLink(url);
      }
    } else {
      // Internal page link
      const pageId = oldLink.pageId || '';
      const pageTitle = oldLink.pageTitle || oldLink.originalPageTitle || '';
      const internalUrl = url || `/${pageId}`;

      // Try to detect if this was custom text
      const isCustomText = displayText !== pageTitle && displayText !== oldLink.originalPageTitle;

      if (isCustomText) {
        return LinkNodeHelper.createCustomLink(pageId, pageTitle, internalUrl, displayText);
      } else {
        return LinkNodeHelper.createAutoLink(pageId, pageTitle, internalUrl);
      }
    }
  }
}
