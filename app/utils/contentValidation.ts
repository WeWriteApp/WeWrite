/**
 * Content Validation Utilities
 *
 * Ensures all content follows our established architecture:
 * - Pages store content as Slate.js node arrays (objects)
 * - Versions store content as Slate.js node arrays (objects)
 * - Never store content as JSON strings
 *
 * Based on our PAGE_DATA_AND_VERSIONS.md and CONTENT_DISPLAY_ARCHITECTURE.md
 */

export interface SlateNode {
  type: string;
  children?: SlateNode[];
  text?: string;
  [key: string]: any;
}

export type ContentArray = SlateNode[];

// Legacy types for existing functions
interface ContentItem {
  id?: string;
  pageId?: string;
  userId?: string;
  username?: string;
  pageName?: string;
  [key: string]: any;
}

/**
 * Checks if a content item has valid username data
 */
export const hasValidUsernameData = (contentItem: ContentItem | null, logMissingData: boolean = true): boolean => {
  if (!contentItem) return false;
  
  // Check if the content item has a userId but missing username
  const hasMissingUsername = contentItem.userId && 
    (!contentItem.username || 
     contentItem.username === 'undefined' || 
     contentItem.username === 'null' || 
     contentItem.username === 'Missing username');
  
  // Log missing data for debugging if enabled
  if (hasMissingUsername && logMissingData) {
    console.warn(`Content item with missing username data:`, {
      id: contentItem.id || contentItem.pageId,
      userId: contentItem.userId,
      username: contentItem.username,
      type: contentItem.pageName ? 'activity' : 'page'
    });
  }
  
  // Return true if the content has a userId and a valid username, or if it's anonymous content (no userId)
  return !hasMissingUsername;
};

/**
 * Filters an array of content items to remove those with missing username data
 */
export const filterContentWithValidUsernames = (contentItems: ContentItem[] | null, logMissingData: boolean = true): ContentItem[] => {
  if (!contentItems || !Array.isArray(contentItems)) return [];
  
  const filteredItems = contentItems.filter(item => hasValidUsernameData(item, logMissingData));
  
  // Log how many items were filtered out
  if (logMissingData && filteredItems.length < contentItems.length) {
    console.warn(`Filtered out ${contentItems.length - filteredItems.length} content items with missing username data`);
  }
  
  return filteredItems;
};

/**
 * NEW CONTENT VALIDATION FUNCTIONS
 * Based on our established architecture documentation
 */

/**
 * Validates and normalizes content to proper Slate.js format
 */
export function validateAndNormalizeContent(content: any): ContentArray {
  // Handle null/undefined content
  if (!content) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // Handle array content (correct format)
  if (Array.isArray(content)) {
    if (content.length === 0) {
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }
    return content.map(node => validateSlateNode(node));
  }

  // Handle string content (needs parsing or conversion)
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        console.log('🔧 CONTENT_VALIDATION: Converted JSON string to array');
        return validateAndNormalizeContent(parsed);
      }
    } catch (e) {
      // Not valid JSON, treat as plain text
    }

    console.log('🔧 CONTENT_VALIDATION: Converted plain text to paragraph');
    return [{ type: "paragraph", children: [{ text: content }] }];
  }

  // Fallback
  console.log('🔧 CONTENT_VALIDATION: Unknown content type, creating default');
  return [{ type: "paragraph", children: [{ text: String(content) }] }];
}

function validateSlateNode(node: any): SlateNode {
  if (!node || typeof node !== 'object') {
    return { type: "paragraph", children: [{ text: String(node || '') }] };
  }

  const validatedNode: SlateNode = {
    type: node.type || "paragraph",
    ...node
  };

  if (node.children && Array.isArray(node.children)) {
    validatedNode.children = node.children.map(child => validateSlateNode(child));
  } else if (node.type !== "text" && !node.text) {
    validatedNode.children = [{ text: node.text || "" }];
  }

  return validatedNode;
}

/**
 * Checks if content is stored as a JSON string (incorrect format)
 */
export function isJsonStringContent(content: any): boolean {
  if (typeof content !== 'string') return false;

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * EMERGENCY: Fix content that's stored as JSON string
 */
export function emergencyFixJsonStringContent(content: string): ContentArray | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      console.log('🚨 EMERGENCY_FIX: Converted JSON string content to array');
      return validateAndNormalizeContent(parsed);
    }
  } catch (e) {
    console.error('🚨 EMERGENCY_FIX: Failed to parse JSON string content:', e);
  }

  return null;
}