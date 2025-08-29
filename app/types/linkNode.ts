/**
 * Clean, maintainable link node data structure
 * 
 * This replaces the confusing mix of text, displayText, originalPageTitle, etc.
 * with a clear separation between auto-generated and custom text.
 */

export interface LinkNode {
  type: 'link';
  
  // Target page information
  pageId: string;
  pageTitle: string; // Current title of the target page (auto-updated)
  url: string; // URL path to the page
  
  // Display text logic
  isCustomText: boolean; // Whether user has set custom display text
  customText?: string; // User-provided custom text (only if isCustomText = true)
  
  // Slate.js structure
  children: Array<{ text: string }>; // The actual rendered text
  
  // Optional metadata
  isExternal?: boolean;
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
    return link.pageTitle;
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
    const pageId = oldLink.pageId || '';
    const pageTitle = oldLink.pageTitle || oldLink.originalPageTitle || '';
    const url = oldLink.url || `/${pageId}`;
    
    // Try to detect if this was custom text
    const displayText = oldLink.children?.[0]?.text || oldLink.displayText || oldLink.text || '';
    const isCustomText = displayText !== pageTitle && displayText !== oldLink.originalPageTitle;
    
    if (isCustomText) {
      return LinkNodeHelper.createCustomLink(pageId, pageTitle, url, displayText);
    } else {
      return LinkNodeHelper.createAutoLink(pageId, pageTitle, url);
    }
  }
}
