/**
 * Advanced text extraction utilities for editor content
 * Handles complex editor formats including Slate, Lexical, and compound links
 */

/**
 * Extracts text content from a JSON string of editor content
 * Supports multiple editor formats and complex link structures
 */
export function extractTextContent(contentJsonString: string | object): string {
  try {
    if (!contentJsonString) return '';

    // If it's already a string and not JSON, return it
    if (typeof contentJsonString === 'string' &&
        (contentJsonString.trim()[0] !== '{' && contentJsonString.trim()[0] !== '[')) {
      return contentJsonString;
    }

    // Handle empty content
    if (contentJsonString === '' || contentJsonString === '[]' || contentJsonString === '{}') {
      return '';
    }

    // Parse JSON if it's a string
    let content;
    if (typeof contentJsonString === 'string') {
      try {
        // Sanitize the JSON string before parsing
        // Remove any non-printable characters and ensure proper JSON formatting
        const sanitizedJson = contentJsonString
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/\\(?!["\\/bfnrt])/g, '\\\\'); // Escape backslashes properly

        content = JSON.parse(sanitizedJson);
      } catch (e) {
        console.warn("JSON parsing failed, treating as plain text:", e.message);
        // If parsing fails, it might be a plain text string
        return contentJsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Return sanitized text
      }
    } else {
      // It's already an object
      content = contentJsonString;
    }

    // Handle different content structures

    // If it's an array (like Slate or Lexical might use)
    if (Array.isArray(content)) {
      return cleanupText(extractTextFromNodes(content));
    }

    // For Lexical-like structure
    if (content.root && content.root.children) {
      return cleanupText(extractTextFromLexicalNodes(content.root.children));
    }

    // If it has a blocks property (another common format)
    if (content.blocks) {
      const text = content.blocks.map(block => block.text || '').join(', ');
      return cleanupText(text);
    }

    // If it has a content property
    if (content.content) {
      if (typeof content.content === 'string') return cleanupText(content.content);
      if (Array.isArray(content.content)) {
        const text = content.content.map(item => {
          if (typeof item === 'string') return item;
          return item.text || '';
        }).join(', ');
        return cleanupText(text);
      }
    }

    // If it has a text property
    if (content.text) return cleanupText(content.text);

    // Plain text
    if (typeof content === 'string') {
      return cleanupText(content);
    }

    // Last resort: stringify the object and return
    return cleanupText(JSON.stringify(content));
  } catch (error) {
    console.error("Error extracting text content:", error);
    return '';
  }
}

/**
 * Extract text from Slate-style nodes
 */
function extractTextFromNodes(nodes: any[]): string {
  let text = '';
  if (!nodes) return text;

  nodes.forEach((node, index) => {
    if (typeof node === 'string') {
      text += node;
    } else if (node.text) {
      text += node.text;
    } else if (node.type === 'link') {
      text += extractLinkText(node);
    } else if (node.children) {
      text += extractTextFromNodes(node.children);
    } else if (node.content) {
      if (typeof node.content === 'string') {
        text += node.content;
      } else if (Array.isArray(node.content)) {
        text += extractTextFromNodes(node.content);
      }
    }

    // Add separator between block-level elements (paragraphs, headings, etc.)
    if (node.type && ['paragraph', 'heading', 'blockquote', 'list-item'].includes(node.type) && index < nodes.length - 1) {
      text += ', ';
    }
  });

  return text;
}

/**
 * Extract text from Lexical-style nodes
 */
function extractTextFromLexicalNodes(nodes: any[]): string {
  let text = '';
  if (!nodes) return text;

  nodes.forEach((node, index) => {
    if (node.text) {
      text += node.text;
    } else if (node.type === 'link' || node.type === 'custom-link') {
      text += extractLexicalLinkText(node);
    } else if (node.children) {
      text += extractTextFromLexicalNodes(node.children);
    }

    // Add separator between block-level elements (paragraphs, headings, etc.)
    if (node.type && ['paragraph', 'heading', 'blockquote', 'listitem'].includes(node.type) && index < nodes.length - 1) {
      text += ', ';
    }
  });

  return text;
}

/**
 * Extract text from Slate-style link nodes with compound link support
 */
function extractLinkText(node: any): string {
  let linkText = '';

  // Handle compound links with author attribution
  if (node.showAuthor && node.authorUsername && node.pageId) {
    // Determine the base text for compound links
    let baseText = '';

    // Check for custom text first
    if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
      baseText = node.displayText;
    } else if (node.children) {
      const childText = extractTextFromNodes(node.children);
      if (childText && childText !== 'Link' && childText.trim()) {
        baseText = childText;
      }
    }

    // Fall back to page title if no custom text
    if (!baseText) {
      baseText = node.pageTitle || node.originalPageTitle || 'Page';
    }

    // Remove @ symbol from username if present
    const cleanUsername = node.authorUsername.replace(/^@/, '');
    linkText = `${baseText} by ${cleanUsername}`;
  }
  // Handle standalone user links (link to /user/[userId])
  else if (node.url && node.url.startsWith('/user/')) {
    // Extract username from the link data
    if (node.username) {
      // Remove @ symbol from username if present
      linkText = node.username.replace(/^@/, '');
    } else if (node.children) {
      const childText = extractTextFromNodes(node.children);
      // Check if the child text looks like a user ID (long alphanumeric string)
      // If so, use the node data instead
      if (childText && childText.length > 20 && /^[a-zA-Z0-9]+$/.test(childText)) {
        // This looks like a user ID, try to get username from node data
        linkText = node.displayText || node.username || childText;
      } else {
        linkText = childText;
      }
    } else {
      linkText = node.displayText || node.username || node.url;
    }
  }
  // Handle regular links
  else {
    // Check for custom text first
    if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
      linkText = node.displayText;
    } else if (node.children) {
      linkText = extractTextFromNodes(node.children);
    } else if (node.pageTitle) {
      linkText = node.pageTitle;
    } else if (node.url) {
      linkText = node.url;
    }
  }

  // Add the link text with special markers to indicate it's a link
  return `[${linkText}]`;
}

/**
 * Extract text from Lexical-style link nodes with compound link support
 */
function extractLexicalLinkText(node: any): string {
  let linkText = '';

  // Handle compound links with author attribution
  if (node.showAuthor && node.authorUsername && (node.pageId || node.__pageId)) {
    // Determine the base text for compound links
    let baseText = '';

    // Check for custom text first
    if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
      baseText = node.displayText;
    } else if (node.children) {
      const childText = extractTextFromLexicalNodes(node.children);
      if (childText && childText !== 'Link' && childText.trim()) {
        baseText = childText;
      }
    }

    // Fall back to page title if no custom text
    if (!baseText) {
      baseText = node.pageTitle || node.originalPageTitle || node.__pageTitle || 'Page';
    }

    // Remove @ symbol from username if present
    const cleanUsername = node.authorUsername.replace(/^@/, '');
    linkText = `${baseText} by ${cleanUsername}`;
  }
  // Handle standalone user links (link to /user/[userId])
  else if ((node.url || node.__url) && (node.url || node.__url).startsWith('/user/')) {
    // Extract username from the link data
    if (node.username || node.__username) {
      // Remove @ symbol from username if present
      linkText = (node.username || node.__username).replace(/^@/, '');
    } else if (node.children) {
      const childText = extractTextFromLexicalNodes(node.children);
      // Check if the child text looks like a user ID (long alphanumeric string)
      // If so, use the node data instead
      if (childText && childText.length > 20 && /^[a-zA-Z0-9]+$/.test(childText)) {
        // This looks like a user ID, try to get username from node data
        linkText = node.displayText || node.__displayText || node.username || node.__username || childText;
      } else {
        linkText = childText;
      }
    } else {
      linkText = node.displayText || node.__displayText || node.username || node.__username || node.url || node.__url;
    }
  }
  // Handle regular links
  else {
    // Check for custom text first
    if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
      linkText = node.displayText;
    } else if (node.children) {
      linkText = extractTextFromLexicalNodes(node.children);
    } else if (node.pageTitle || node.__pageTitle) {
      linkText = node.pageTitle || node.__pageTitle;
    } else if (node.url || node.__url) {
      linkText = node.url || node.__url;
    }
  }

  // Add the link text with special markers to indicate it's a link
  return `[${linkText}]`;
}

/**
 * Clean up extracted text by replacing newlines with commas for better readability in diffs
 */
function cleanupText(text: string): string {
  if (!text) return '';

  return text
    // Replace newlines and carriage returns with commas
    .replace(/[\r\n]+/g, ', ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim()
    // Clean up multiple commas
    .replace(/,\s*,+/g, ', ')
    // Remove trailing comma
    .replace(/,\s*$/, '');
}

// Compatibility exports for existing code
export const extractTextFromEditor = extractTextContent;
export const extractTextFromSlate = extractTextContent;
export const extractDescription = extractTextContent;