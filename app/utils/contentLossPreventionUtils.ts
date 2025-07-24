/**
 * Utility functions for preventing content loss during navigation
 */

export interface EditorNode {
  type: string;
  children: any[];
  [key: string]: any;
}

/**
 * Check if editor content has meaningful text content
 * @param content - The editor content to check
 * @returns true if there is meaningful content, false otherwise
 */
export const hasUnsavedContent = (content: EditorNode[] | string | null | undefined): boolean => {
  if (!content) {
    return false;
  }

  // Handle string content
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return hasUnsavedContent(parsed);
    } catch {
      // If it's not JSON, treat as plain text
      return content.trim().length > 0;
    }
  }

  // Handle array content (editor nodes)
  if (Array.isArray(content)) {
    return content.some(node => hasContentInNode(node));
  }

  // Handle single node
  if (typeof content === 'object' && content !== null) {
    return hasContentInNode(content);
  }

  return false;
};

/**
 * Check if a single editor node has meaningful content
 * @param node - The editor node to check
 * @returns true if the node has meaningful content
 */
const hasContentInNode = (node: any): boolean => {
  if (!node || typeof node !== 'object') {
    return false;
  }

  // Check for text content
  if (node.text && typeof node.text === 'string') {
    return node.text.trim().length > 0;
  }

  // Check for link content (pill links)
  if (node.type === 'link' && node.pageId) {
    return true; // Links are considered meaningful content
  }

  // Check children recursively
  if (node.children && Array.isArray(node.children)) {
    return node.children.some((child: any) => hasContentInNode(child));
  }

  return false;
};

/**
 * Check if content is just empty paragraphs or whitespace
 * @param content - The editor content to check
 * @returns true if content is effectively empty
 */
export const isContentEmpty = (content: EditorNode[] | string | null | undefined): boolean => {
  return !hasUnsavedContent(content);
};

/**
 * Get a preview of the content for display purposes
 * @param content - The editor content
 * @param maxLength - Maximum length of the preview (default: 100)
 * @returns A string preview of the content
 */
export const getContentPreview = (
  content: EditorNode[] | string | null | undefined,
  maxLength: number = 100
): string => {
  if (!content) {
    return '';
  }

  // Handle string content
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return getContentPreview(parsed, maxLength);
    } catch {
      // If it's not JSON, treat as plain text
      return content.trim().substring(0, maxLength);
    }
  }

  // Handle array content (editor nodes)
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    
    for (const node of content) {
      const nodeText = extractTextFromNode(node);
      if (nodeText) {
        textParts.push(nodeText);
      }
    }
    
    const fullText = textParts.join(' ').trim();
    return fullText.length > maxLength 
      ? fullText.substring(0, maxLength) + '...'
      : fullText;
  }

  // Handle single node
  if (typeof content === 'object' && content !== null) {
    const nodeText = extractTextFromNode(content);
    return nodeText.length > maxLength 
      ? nodeText.substring(0, maxLength) + '...'
      : nodeText;
  }

  return '';
};

/**
 * Extract text content from a single editor node
 * @param node - The editor node
 * @returns The text content of the node
 */
const extractTextFromNode = (node: any): string => {
  if (!node || typeof node !== 'object') {
    return '';
  }

  // Direct text content
  if (node.text && typeof node.text === 'string') {
    return node.text;
  }

  // Link content
  if (node.type === 'link' && node.title) {
    return `[${node.title}]`;
  }

  // Children content
  if (node.children && Array.isArray(node.children)) {
    return node.children
      .map((child: any) => extractTextFromNode(child))
      .filter(Boolean)
      .join('');
  }

  return '';
};

/**
 * Content loss prevention hook state interface
 */
export interface ContentLossPreventionState {
  hasUnsavedContent: boolean;
  showDuplicateModal: boolean;
  showContentWarningModal: boolean;
  pendingNavigation: {
    pageId: string;
    title: string;
  } | null;
}

/**
 * Initial state for content loss prevention
 */
export const initialContentLossPreventionState: ContentLossPreventionState = {
  hasUnsavedContent: false,
  showDuplicateModal: false,
  showContentWarningModal: false,
  pendingNavigation: null
};
