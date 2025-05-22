/**
 * Consolidated text diff utility with accurate character counting and visual diff generation
 * This file contains all diff-related functionality in one place
 */

/**
 * Finds the Longest Common Subsequence between two strings
 * This is used to determine what characters were actually changed
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {string} The longest common subsequence
 */
function longestCommonSubsequence(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array to store LCS lengths
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Fill the dp array
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct the LCS
  let lcs = '';
  let i = m, j = n;

  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      lcs = str1[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Calculates character-level diff using Myers' algorithm (simplified)
 * This properly tracks additions and deletions separately
 * @param {string} oldText - Previous text content
 * @param {string} newText - Current text content
 * @returns {Object} Object with added and removed character counts
 */
export function calculateCharacterDiff(oldText, newText) {
  if (!oldText && !newText) {
    return { added: 0, removed: 0 };
  }

  if (!oldText) {
    return { added: newText.length, removed: 0 };
  }

  if (!newText) {
    return { added: 0, removed: oldText.length };
  }

  // Use a simplified diff algorithm based on Longest Common Subsequence (LCS)
  const lcs = longestCommonSubsequence(oldText, newText);

  // Calculate additions and deletions
  const added = newText.length - lcs.length;
  const removed = oldText.length - lcs.length;

  // Debug logging for troubleshooting
  if (process.env.NODE_ENV === 'development') {
    console.log(`Character diff: "${oldText}" -> "${newText}"`);
    console.log(`LCS: "${lcs}" (length: ${lcs.length})`);
    console.log(`Result: +${added} -${removed}`);
  }

  return { added, removed };
}

/**
 * Generates a detailed text diff between two content strings with enhanced preview
 * This extracts actual text content and provides context around changes, showing both additions and deletions
 *
 * @param {string} currentContent - Current content JSON string
 * @param {string} previousContent - Previous content JSON string
 * @returns {Object} Object with diff details including enhanced text preview
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
      const previewText = currentText.substring(0, Math.min(150, currentText.length));
      const remainingText = currentText.length > 150 ? currentText.substring(150, Math.min(200, currentText.length)) : "";

      return {
        added: currentText.length,
        removed: 0,
        preview: {
          beforeContext: "",
          addedText: previewText,
          removedText: "",
          afterContext: remainingText,
          hasAdditions: true,
          hasRemovals: false
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

    // Use accurate character diff calculation
    const charDiff = calculateCharacterDiff(previousText, currentText);

    // Generate enhanced diff preview that shows both additions and deletions
    const diffPreview = generateEnhancedDiffPreview(previousText, currentText);

    return {
      added: charDiff.added,
      removed: charDiff.removed,
      preview: diffPreview
    };
  } catch (error) {
    console.error("Error generating text diff:", error);
    return defaultReturn;
  }
}

/**
 * Generates an enhanced diff preview that shows both additions and deletions
 * @param {string} oldText - Previous text content
 * @param {string} newText - Current text content
 * @returns {Object|null} Enhanced diff preview object or null if no meaningful diff
 */
function generateEnhancedDiffPreview(oldText, newText) {
  try {
    // Find the first and last difference points
    const firstDiff = findFirstDifferenceIndex(oldText, newText);
    if (firstDiff === -1) {
      return null; // No differences
    }

    const lastDiffOld = findLastDifferenceIndex(oldText, newText);
    const lastDiffNew = findLastDifferenceIndex(newText, oldText);

    // Calculate context boundaries with more generous context (up to 3 lines)
    const contextStart = Math.max(0, firstDiff - 120); // ~3 lines of context before
    const contextEndOld = Math.min(oldText.length, lastDiffOld + 120); // ~3 lines of context after
    const contextEndNew = Math.min(newText.length, lastDiffNew + 120);

    // Extract the different sections
    const beforeContext = oldText.substring(contextStart, firstDiff);

    // For the changed section, we need to be more sophisticated
    const oldChangedSection = oldText.substring(firstDiff, lastDiffOld);
    const newChangedSection = newText.substring(firstDiff, lastDiffNew);

    // Get after context from the new text
    const afterContext = newText.substring(lastDiffNew, contextEndNew);

    // Determine what was added and removed
    let addedText = "";
    let removedText = "";
    let hasAdditions = false;
    let hasRemovals = false;

    if (newText.length > oldText.length) {
      // Net addition
      addedText = newChangedSection;
      hasAdditions = true;

      // Check if there were also removals within the change
      if (oldChangedSection.length > 0) {
        removedText = oldChangedSection;
        hasRemovals = true;
      }
    } else if (oldText.length > newText.length) {
      // Net removal
      removedText = oldChangedSection;
      hasRemovals = true;

      // Check if there were also additions within the change
      if (newChangedSection.length > 0) {
        addedText = newChangedSection;
        hasAdditions = true;
      }
    } else {
      // Same length but different content (replacement)
      addedText = newChangedSection;
      removedText = oldChangedSection;
      hasAdditions = true;
      hasRemovals = true;
    }

    // Truncate if too long but preserve readability
    const maxLength = 100;
    if (addedText.length > maxLength) {
      addedText = addedText.substring(0, maxLength) + '...';
    }
    if (removedText.length > maxLength) {
      removedText = removedText.substring(0, maxLength) + '...';
    }

    // Ensure we have meaningful content to show
    if (!addedText.trim() && !removedText.trim()) {
      return null;
    }

    return {
      beforeContext: beforeContext.length > 80 ? '...' + beforeContext.substring(beforeContext.length - 80) : beforeContext,
      addedText,
      removedText,
      afterContext: afterContext.length > 80 ? afterContext.substring(0, 80) + '...' : afterContext,
      hasAdditions,
      hasRemovals
    };
  } catch (error) {
    console.error("Error generating enhanced diff preview:", error);
    return null;
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
 * Find the index of the last difference between two strings (searching backwards)
 */
function findLastDifferenceIndex(str1, str2) {
  try {
    const len1 = str1.length;
    const len2 = str2.length;
    const minLength = Math.min(len1, len2);

    // Search backwards from the end
    for (let i = 1; i <= minLength; i++) {
      if (str1[len1 - i] !== str2[len2 - i]) {
        return len1 - i + 1; // Return the position after the last matching character
      }
    }

    // If one string is a suffix of the other, return the appropriate position
    if (len1 !== len2) {
      return Math.max(len1, len2) - minLength;
    }

    // Strings are identical
    return len1;
  } catch (error) {
    console.error("Error finding last difference:", error);
    return str1.length;
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
export function extractTextContent(contentJsonString) {
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

    // Log the content for debugging
    console.log('Extracting text from content:', typeof contentJsonString === 'string'
      ? contentJsonString.substring(0, 100) + '...'
      : 'Object');

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
      // Recursive function to extract text from nodes
      const extractText = (nodes) => {
        let text = '';
        if (!nodes) return text;

        nodes.forEach(node => {
          if (typeof node === 'string') {
            text += node;
          } else if (node.text) {
            text += node.text;
          } else if (node.type === 'link') {
            // For link nodes, extract text from children and add special markers
            if (node.children) {
              const linkText = extractText(node.children);
              // Add the link text with special markers to indicate it's a link
              text += `[${linkText}]`;
            } else if (node.url) {
              // If no children but has URL, use the URL as text
              text += `[${node.url}]`;
            }
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
          } else if (node.type === 'link' || node.type === 'custom-link') {
            // For link nodes, extract text from children and add special markers
            if (node.children) {
              const linkText = extractText(node.children);
              // Add the link text with special markers to indicate it's a link
              text += `[${linkText}]`;
            } else if (node.url || node.__url) {
              // If no children but has URL, use the URL as text
              text += `[${node.url || node.__url}]`;
            }
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
// Now uses the accurate character diff algorithm
export function generateSimpleDiff(currentContent, previousContent) {
  try {
    if (!currentContent && !previousContent) {
      return { added: 0, removed: 0 };
    }

    if (!previousContent) {
      const currentText = extractTextContent(currentContent);
      return { added: currentText.length, removed: 0 };
    }

    if (!currentContent) {
      const previousText = extractTextContent(previousContent);
      return { added: 0, removed: previousText.length };
    }

    // Use the new accurate diff algorithm with existing text extraction
    const currentText = extractTextContent(currentContent);
    const previousText = extractTextContent(previousContent);
    return calculateCharacterDiff(previousText, currentText);
  } catch (error) {
    console.error("Error generating simple diff:", error);
    return { added: 0, removed: 0 };
  }
}
