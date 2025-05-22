// Import the character diff calculation function from the consolidated utility
import { calculateCharacterDiff, extractTextContent } from './generateTextDiff';

/**
 * Generates a simple diff between two content strings
 * Now uses accurate character-level diff algorithm that properly tracks additions and deletions
 *
 * @param {string} currentContent - Current content JSON string
 * @param {string} previousContent - Previous content JSON string
 * @returns {Object} Object with added and removed counts
 */
export function generateSimpleDiff(currentContent, previousContent) {
  try {
    if (!currentContent && !previousContent) {
      return { added: 0, removed: 0 };
    }

    if (!previousContent) {
      return { added: getContentLength(currentContent), removed: 0 };
    }

    if (!currentContent) {
      return { added: 0, removed: getContentLength(previousContent) };
    }

    // Use the new accurate diff algorithm
    const currentText = extractTextContent(currentContent);
    const previousText = extractTextContent(previousContent);
    return calculateCharacterDiff(previousText, currentText);
  } catch (error) {
    console.error('Error generating diff:', error);
    return { added: 0, removed: 0 };
  }
}

/**
 * Extracts text content from a JSON string of editor content
 * @param {string} contentJsonString - JSON string of editor content
 * @returns {number} Length of text content
 */
function getContentLength(contentJsonString) {
  if (!contentJsonString) return 0;

  try {
    // Parse the JSON string
    const contentObj = typeof contentJsonString === 'string'
      ? JSON.parse(contentJsonString)
      : contentJsonString;

    // Extract text content based on the structure
    // This assumes a specific structure - adjust as needed based on your editor's format
    let textContent = '';

    // If it's an array (like Slate or Lexical might use)
    if (Array.isArray(contentObj)) {
      // Recursive function to extract text from nodes
      const extractText = (nodes) => {
        let text = '';
        if (!nodes) return text;

        nodes.forEach(node => {
          if (typeof node === 'string') {
            text += node;
          } else if (node.text) {
            text += node.text;
          } else if (node.children) {
            text += extractText(node.children);
          }
        });

        return text;
      };

      textContent = extractText(contentObj);
    } else if (contentObj.root && contentObj.root.children) {
      // For Lexical-like structure
      const extractText = (nodes) => {
        let text = '';
        if (!nodes) return text;

        nodes.forEach(node => {
          if (node.text) {
            text += node.text;
          } else if (node.children) {
            text += extractText(node.children);
          }
        });

        return text;
      };

      textContent = extractText(contentObj.root.children);
    }

    return textContent.length;
  } catch (error) {
    console.error('Error parsing content JSON:', error);
    return 0;
  }
}
