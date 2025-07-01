/**
 * Utility functions to extract text content from editor nodes
 * This helps generate meaningful descriptions for OpenGraph metadata
 */

/**
 * Extracts plain text from a node tree (compatible with our editor format)
 * @param {Object|Array} nodes - The node or array of nodes to extract text from
 * @param {Number} maxLength - Maximum length of text to extract
 * @returns {String} The extracted text
 */
export function extractTextContent(nodes, maxLength = 200) {
  if (!nodes) return '';
  
  // Handle case where nodes is an object with a children property
  const nodeArray = Array.isArray(nodes) ? nodes : 
                   (nodes.children ? nodes.children : [nodes]);
  
  let text = '';
  
  // Process each node
  for (const node of nodeArray) {
    // If the node has text, add it
    if (typeof node.text === 'string') {
      text += node.text + ' ';
    }
    
    // Recursively process children
    if (node.children && node.children.length > 0) {
      text += extractTextContent(node.children, maxLength) + ' ';
    }
    
    // Break if we've reached max length
    if (text.length >= maxLength) {
      break;
    }
  }
  
  // Cleanup and trim the text
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength) + (text.length > maxLength ? '...' : '');
}

/**
 * Creates a page description from page content
 * @param {Object} pageData - The page data including content
 * @param {Number} maxLength - Maximum description length
 * @returns {String} A formatted description
 */
export function createPageDescription(pageData, maxLength = 160) {
  if (!pageData) return 'A WeWrite page';
  
  // Start with the title
  let description = pageData.title ? `${pageData.title}` : 'A WeWrite page';
  
  // Add author if available
  if (pageData.username) {
    description += ` by ${pageData.username}`;
  }
  
  // Add content excerpt if available
  if (pageData.content) {
    const contentText = extractTextContent(pageData.content, maxLength - description.length - 3);
    if (contentText.trim().length > 0) {
      description += `: ${contentText}`;
    }
  }
  
  return description.substring(0, maxLength) + (description.length > maxLength ? '...' : '');
}
