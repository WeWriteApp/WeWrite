"use client";

/**
 * Slate Path Fix Utility
 *
 * This file contains utilities to fix the "Cannot assign to read only property 'path'" error
 * that occurs in Slate editor when trying to modify the read-only path property.
 *
 * Instead of directly modifying the path property, we use a custom property called
 * 'paragraphIndex' to store the index information.
 *
 * IMPORTANT: Slate nodes are immutable (frozen objects), so we must create new nodes
 * instead of trying to modify existing ones.
 */

/**
 * Updates paragraph indices for all nodes in a Slate document
 * Creates new nodes instead of modifying existing ones to respect Slate's immutability
 *
 * @param {Array} value - The Slate editor value (array of nodes)
 * @returns {Array} - The updated value with custom paragraph indices
 */
export function updateParagraphIndices(value) {
  if (!Array.isArray(value)) {
    console.warn('updateParagraphIndices: value is not an array', value);
    return value;
  }

  try {
    // Create a new array with new node objects to respect immutability
    const updatedValue = value.map((node, index) => {
      if (!node) return node;

      if (node.type === 'paragraph' || !node.type) {
        // CRITICAL FIX: Deep clone the node to preserve all children including links
        const clonedNode = {
          ...node,
          // Preserve children array completely - this is critical for links
          children: node.children ? [...node.children] : [],
          custom: {
            ...(node.custom || {}),
            paragraphIndex: index
          }
        };

        // CRITICAL FIX: Ensure children are preserved exactly as they are
        // This prevents links from being lost during paragraph index updates
        if (node.children && Array.isArray(node.children)) {
          const linkCount = node.children.filter(child => child && child.type === 'link').length;
          if (linkCount > 0) {
            console.log(`LINK_PRESERVATION: Preserving ${linkCount} links in paragraph ${index}`);
          }

          clonedNode.children = node.children.map(child => {
            // If child is a link, preserve it completely
            if (child && child.type === 'link') {
              console.log('LINK_PRESERVATION: Preserving link in paragraph update:', {
                url: child.url,
                text: child.children?.[0]?.text
              });
              return {
                ...child,
                // Preserve link children (the text content)
                children: child.children ? [...child.children] : []
              };
            }
            // For non-link children, just clone them
            return { ...child };
          });
        }

        return clonedNode;
      }

      // Return unchanged node for non-paragraph types (but still clone to respect immutability)
      return { ...node };
    });

    return updatedValue;
  } catch (error) {
    console.error('Error updating paragraph indices:', error);
    return value; // Return original value on error
  }
}

/**
 * Gets the paragraph index for a Slate element
 * Tries multiple methods to determine the index without modifying the element
 *
 * @param {Object} element - The Slate element
 * @param {Object} editor - The Slate editor instance
 * @returns {number} - The paragraph index (0-based)
 */
export function getParagraphIndex(element, editor) {
  if (!element) return 0;

  try {
    // First check if we have our custom paragraphIndex
    if (element.custom && typeof element.custom.paragraphIndex === 'number') {
      return element.custom.paragraphIndex;
    }

    // Then try to get the path from element.path if it exists (for backward compatibility)
    if (element.path && Array.isArray(element.path)) {
      return element.path[0];
    }

    // Then try to use ReactEditor.findPath safely
    if (editor && editor.children) {
      try {
        const { ReactEditor } = require('slate-react');
        if (ReactEditor && typeof ReactEditor.findPath === 'function') {
          const path = ReactEditor.findPath(editor, element);
          if (path && Array.isArray(path)) {
            // Return the path index without modifying the element
            return path[0];
          }
        }
      } catch (pathError) {
        // Silently fail and try the next method
      }

      // Fallback: Find the element's position in the editor's children
      try {
        const nodes = editor.children;
        if (Array.isArray(nodes)) {
          const nodeIndex = nodes.findIndex(node => node === element);
          if (nodeIndex !== -1) {
            // Return the index without modifying the element
            return nodeIndex;
          }
        }
      } catch (fallbackError) {
        // Silently fail and try the next method
      }
    }

    // Default to 0 if all methods fail
    return 0;
  } catch (error) {
    console.error("Error calculating paragraph index:", error);
    return 0;
  }
}

export default {
  updateParagraphIndices,
  getParagraphIndex
};
