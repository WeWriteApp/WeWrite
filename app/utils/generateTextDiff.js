/**
 * Generates a detailed text diff between two content strings
 * This extracts actual text content and provides context around changes
 * 
 * @param {string} currentContent - Current content JSON string
 * @param {string} previousContent - Previous content JSON string
 * @returns {Object} Object with diff details including text preview
 */
export function generateTextDiff(currentContent, previousContent) {
  // Default return value for error cases
  const defaultReturn = { added: 0, removed: 0, preview: null };
  
  try {
    // Check for missing content
    if (!currentContent) {
      console.log("Missing current content for diff");
      return defaultReturn;
    }
    
    // Handle case for new pages (no previous content)
    if (!previousContent || previousContent === "") {
      // Extract text from current content
      const currentText = extractTextContent(currentContent);
      
      // If text is empty or too short
      if (!currentText || !currentText.trim() || currentText.length < 3) {
        console.log("Current text too short for new page diff");
        return { added: currentText.length, removed: 0, preview: null };
      }
      
      // For new pages, show the first part of content as added text
      const previewText = currentText.substring(0, Math.min(50, currentText.length));
      const remainingText = currentText.length > 50 ? currentText.substring(50, Math.min(70, currentText.length)) : "";
      
      return {
        added: currentText.length,
        removed: 0,
        preview: {
          beforeContext: "",
          highlightedText: previewText,
          afterContext: remainingText,
          isNew: true,
          isRemoved: false
        }
      };
    }
    
    // Extract text from both contents
    const currentText = extractTextContent(currentContent);
    const previousText = extractTextContent(previousContent);
    
    // If both texts are empty or too short
    if (!currentText.trim() || !previousText.trim() || 
        (currentText.length < 3 && previousText.length < 3)) {
      console.log("Texts too short for diff:", { currentText, previousText });
      return defaultReturn;
    }
    
    // Find the first difference
    let diffIndex = findFirstDifferenceIndex(previousText, currentText);
    
    // If texts are identical
    if (diffIndex === -1) {
      return { added: 0, removed: 0, preview: null };
    }
    
    // Get context - start 20 chars before diff if possible
    const contextStart = Math.max(0, diffIndex - 20);
    
    // Determine if it's an addition or removal
    const isAddition = currentText.length > previousText.length;
    const isRemoval = currentText.length < previousText.length;
    
    let preview = null;
    
    if (isAddition) {
      // Find a common point after the addition
      const commonAfterIndex = findCommonPointAfterDiff(previousText, currentText, diffIndex);
      const addedText = currentText.substring(diffIndex, commonAfterIndex);
      
      if (!addedText || addedText.trim() === '') {
        return { added: currentText.length - previousText.length, removed: 0, preview: null };
      }
      
      // Get context before and after
      const beforeContext = currentText.substring(contextStart, diffIndex);
      const afterContext = currentText.substring(commonAfterIndex, commonAfterIndex + 20);
      
      preview = {
        beforeContext,
        highlightedText: addedText.length > 50 ? addedText.substring(0, 50) + '...' : addedText,
        afterContext,
        isNew: true,
        isRemoved: false
      };
    } else if (isRemoval) {
      // Find a common point after the removal
      const commonAfterIndex = findCommonPointAfterDiff(currentText, previousText, diffIndex);
      const removedText = previousText.substring(diffIndex, commonAfterIndex);
      
      if (!removedText || removedText.trim() === '') {
        return { added: 0, removed: previousText.length - currentText.length, preview: null };
      }
      
      // Get context before and after
      const beforeContext = currentText.substring(contextStart, diffIndex);
      const afterContext = currentText.substring(diffIndex, diffIndex + 20);
      
      preview = {
        beforeContext,
        highlightedText: removedText.length > 50 ? removedText.substring(0, 50) + '...' : removedText,
        afterContext,
        isNew: false,
        isRemoved: true
      };
    } else {
      // Changed text (same length but different content)
      // For simplicity, just show some context around the change
      const changedText = currentText.substring(diffIndex, diffIndex + 20);
      
      if (!changedText || changedText.trim() === '') {
        return { added: 0, removed: 0, preview: null };
      }
      
      preview = {
        beforeContext: currentText.substring(contextStart, diffIndex),
        highlightedText: changedText,
        afterContext: currentText.substring(diffIndex + 20, diffIndex + 40),
        isNew: true,
        isRemoved: false
      };
    }
    
    // Ensure we're not showing empty context
    if (!preview.highlightedText || preview.highlightedText.trim() === '') {
      return { 
        added: isAddition ? currentText.length - previousText.length : 0,
        removed: isRemoval ? previousText.length - currentText.length : 0,
        preview: null 
      };
    }
    
    return {
      added: isAddition ? currentText.length - previousText.length : 0,
      removed: isRemoval ? previousText.length - currentText.length : 0,
      preview
    };
  } catch (error) {
    console.error("Error generating text diff:", error);
    return defaultReturn;
  }
}

/**
 * Find the index of the first difference between two strings
 */
function findFirstDifferenceIndex(str1, str2) {
  try {
    const minLength = Math.min(str1.length, str2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (str1[i] !== str2[i]) {
        return i;
      }
    }
    
    // If one string is a prefix of the other, return the length of the shorter string
    if (str1.length !== str2.length) {
      return minLength;
    }
    
    // Strings are identical
    return -1;
  } catch (error) {
    console.error("Error finding first difference:", error);
    return -1;
  }
}

/**
 * Find a point where texts become common again after a difference
 */
function findCommonPointAfterDiff(shorterText, longerText, diffStartIndex) {
  try {
    // Start looking from the diff point in the shorter text
    for (let i = diffStartIndex; i < shorterText.length; i++) {
      // Look for this character in the longer text starting from the diff point
      const searchChar = shorterText[i];
      const foundIndex = longerText.indexOf(searchChar, diffStartIndex);
      
      // If found and followed by at least 3 matching chars, consider it a match
      if (foundIndex !== -1) {
        let matchLength = 0;
        while (
          i + matchLength < shorterText.length && 
          foundIndex + matchLength < longerText.length &&
          shorterText[i + matchLength] === longerText[foundIndex + matchLength]
        ) {
          matchLength++;
        }
        
        // If we found at least 3 matching characters, consider it a common point
        if (matchLength >= 3) {
          return foundIndex;
        }
      }
    }
    
    // If no good common point found, just return a reasonable point in the longer text
    return Math.min(diffStartIndex + 30, longerText.length);
  } catch (error) {
    console.error("Error finding common point after diff:", error);
    return diffStartIndex + 10;
  }
}

/**
 * Extracts text content from a JSON string of editor content
 * @param {string|object} contentJsonString - JSON string or object of editor content
 * @returns {string} Extracted text content
 */
function extractTextContent(contentJsonString) {
  try {
    if (!contentJsonString) return '';
    
    // If it's already a string and not JSON, return it
    if (typeof contentJsonString === 'string' && 
        (contentJsonString.trim()[0] !== '{' && contentJsonString.trim()[0] !== '[')) {
      return contentJsonString;
    }
    
    // Parse JSON if it's a string
    let content;
    if (typeof contentJsonString === 'string') {
      try {
        content = JSON.parse(contentJsonString);
      } catch (e) {
        // If parsing fails, it might be a plain text string
        return contentJsonString;
      }
    } else {
      // It's already an object
      content = contentJsonString;
    }
    
    // Handle different content structures
    
    // If it's an array (like Slate or Lexical might use)
    if (Array.isArray(content)) {
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
          } else if (node.content) {
            if (typeof node.content === 'string') {
              text += node.content;
            } else if (Array.isArray(node.content)) {
              text += extractText(node.content);
            }
          }
        });
        
        return text;
      };
      
      return extractText(content);
    } 
    
    // For Lexical-like structure
    if (content.root && content.root.children) {
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
      
      return extractText(content.root.children);
    } 
    
    // If it has a blocks property (another common format)
    if (content.blocks) {
      return content.blocks.map(block => block.text || '').join('\n');
    }
    
    // If it has a content property
    if (content.content) {
      if (typeof content.content === 'string') return content.content;
      if (Array.isArray(content.content)) {
        return content.content.map(item => {
          if (typeof item === 'string') return item;
          return item.text || '';
        }).join('\n');
      }
    }
    
    // If it has a text property
    if (content.text) return content.text;
    
    // Plain text
    if (typeof content === 'string') {
      return content;
    }
    
    // Last resort: stringify the object and return
    return JSON.stringify(content);
  } catch (error) {
    console.error("Error extracting text content:", error);
    return '';
  }
}

// Export the simple diff function for backward compatibility
export function generateSimpleDiff(currentContent, previousContent) {
  try {
    if (!currentContent || !previousContent) {
      return { added: 0, removed: 0 };
    }
    
    const currentText = extractTextContent(currentContent);
    const previousText = extractTextContent(previousContent);
    
    return {
      added: Math.max(0, currentText.length - previousText.length),
      removed: Math.max(0, previousText.length - currentText.length)
    };
  } catch (error) {
    console.error("Error generating simple diff:", error);
    return { added: 0, removed: 0 };
  }
}
