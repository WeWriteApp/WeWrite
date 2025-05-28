"use client";

/**
 * Generate a simple diff between two text contents
 * @param {string} currentContent - The current content
 * @param {string} previousContent - The previous content
 * @returns {Object} Object with added and removed counts
 */
export function generateSimpleDiff(currentContent = '', previousContent = '') {
  const current = currentContent || '';
  const previous = previousContent || '';
  
  const currentLength = current.length;
  const previousLength = previous.length;
  
  const added = Math.max(0, currentLength - previousLength);
  const removed = Math.max(0, previousLength - currentLength);
  
  return { added, removed };
}

/**
 * Generate a text diff for display purposes
 * @param {string} currentContent - The current content
 * @param {string} previousContent - The previous content
 * @returns {Array} Array of diff objects
 */
export function generateTextDiff(currentContent = '', previousContent = '') {
  // Simple implementation for now
  const current = currentContent || '';
  const previous = previousContent || '';
  
  if (current === previous) {
    return [];
  }
  
  // Return a simple diff representation
  return [
    { type: 'removed', content: previous },
    { type: 'added', content: current }
  ];
}

/**
 * Extract text content from rich content
 * @param {string} content - The content to extract text from
 * @returns {string} Plain text content
 */
export function extractTextContent(content = '') {
  // Simple text extraction - remove HTML tags if any
  return content.replace(/<[^>]*>/g, '').trim();
}
