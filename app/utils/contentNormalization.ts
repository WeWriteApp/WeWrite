/**
 * Content Normalization Utilities for WeWrite
 * 
 * Provides consistent content comparison and normalization across the application
 * to prevent false positive "no changes" activities and version creation.
 */

export interface ContentComparisonResult {
  hasChanges: boolean;
  normalizedCurrent: string;
  normalizedPrevious: string;
  details: {
    currentLength: number;
    previousLength: number;
    normalizedCurrentLength: number;
    normalizedPreviousLength: number;
  };
}

/**
 * Normalizes content structure to handle editor formatting differences
 * This ensures consistent comparison by removing empty text nodes and standardizing format
 */
export function normalizeContent(content: any): string {
  try {
    if (!content) return JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
    
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentString);
    
    if (!Array.isArray(parsed)) {
      return contentString;
    }
    
    // Deep normalization of content structure
    const normalized = parsed.map(node => {
      if (node.type === 'paragraph' && node.children) {
        // Filter and normalize children
        const filteredChildren = node.children
          .filter(child => {
            // Keep non-text nodes
            if (child.text === undefined) return true;
            // Remove completely empty text nodes
            return child.text.trim() !== '';
          })
          .map(child => {
            // Normalize text nodes by removing extra formatting and whitespace
            if (child.text !== undefined) {
              return { text: child.text.trim() };
            }
            return child;
          });
        
        // If no meaningful content, keep one empty text node
        if (filteredChildren.length === 0) {
          return { type: 'paragraph', children: [{ text: '' }] };
        }
        
        return { type: 'paragraph', children: filteredChildren };
      }
      return node;
    });
    
    // Remove completely empty paragraphs except if it's the only content
    const meaningfulContent = normalized.filter(node => {
      if (node.type === 'paragraph' && node.children) {
        return node.children.some(child => 
          child.text !== undefined && child.text.trim() !== ''
        );
      }
      return true;
    });
    
    // If no meaningful content, keep one empty paragraph
    if (meaningfulContent.length === 0) {
      return JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
    }
    
    return JSON.stringify(meaningfulContent);
  } catch (e) {
    console.error('Error normalizing content:', e);
    return typeof content === 'string' ? content : JSON.stringify(content || [{ type: "paragraph", children: [{ text: "" }] }]);
  }
}

/**
 * Compares two content structures and determines if there are meaningful changes
 * Returns detailed comparison results including normalized versions
 */
export function compareContent(currentContent: any, previousContent: any): ContentComparisonResult {
  const currentString = typeof currentContent === 'string' ? currentContent : JSON.stringify(currentContent || "");
  const previousString = typeof previousContent === 'string' ? previousContent : JSON.stringify(previousContent || "");

  const normalizedCurrent = normalizeContent(currentContent);
  const normalizedPrevious = normalizeContent(previousContent);

  const hasChanges = normalizedCurrent !== normalizedPrevious;

  // Simplified: Remove debug logging for cleaner console

  return {
    hasChanges,
    normalizedCurrent,
    normalizedPrevious,
    details: {
      currentLength: currentString.length,
      previousLength: previousString.length,
      normalizedCurrentLength: normalizedCurrent.length,
      normalizedPreviousLength: normalizedPrevious.length
    }
  };
}

/**
 * Checks if metadata has changed between two page states
 */
export function compareMetadata(
  current: { title?: string; isPublic?: boolean; location?: string; groupId?: string },
  previous: { title?: string; isPublic?: boolean; location?: string; groupId?: string }
): boolean {
  return (
    current.title !== previous.title ||
    current.isPublic !== previous.isPublic ||
    current.location !== previous.location ||
    current.groupId !== previous.groupId
  );
}

/**
 * Comprehensive change detection for pages
 * Checks both content and metadata changes
 */
export function detectPageChanges(
  currentPage: {
    title?: string;
    isPublic?: boolean;
    location?: string;
    groupId?: string;
    content?: any;
  },
  previousPage: {
    title?: string;
    isPublic?: boolean;
    location?: string;
    groupId?: string;
    content?: any;
  }
): {
  hasContentChanges: boolean;
  hasMetadataChanges: boolean;
  hasAnyChanges: boolean;
  contentComparison: ContentComparisonResult;
} {
  const contentComparison = compareContent(currentPage.content, previousPage.content);
  const hasMetadataChanges = compareMetadata(currentPage, previousPage);
  
  return {
    hasContentChanges: contentComparison.hasChanges,
    hasMetadataChanges,
    hasAnyChanges: contentComparison.hasChanges || hasMetadataChanges,
    contentComparison
  };
}

/**
 * Simplified content comparison for bio and about pages
 * Returns true if content has meaningful changes
 */
export function hasContentChanged(currentContent: any, previousContent: any): boolean {
  const comparison = compareContent(currentContent, previousContent);
  return comparison.hasChanges;
}
