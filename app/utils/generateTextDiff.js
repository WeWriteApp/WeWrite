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
 * This properly tracks additions and deletions separately and returns detailed diff information
 * @param {string} oldText - Previous text content
 * @param {string} newText - Current text content
 * @returns {Object} Object with added and removed character counts plus detailed diff operations
 */
export function calculateCharacterDiff(oldText, newText) {
  if (!oldText && !newText) {
    return { added: 0, removed: 0, operations: [] };
  }

  if (!oldText) {
    return {
      added: newText.length,
      removed: 0,
      operations: [{ type: 'add', text: newText, start: 0 }]
    };
  }

  if (!newText) {
    return {
      added: 0,
      removed: oldText.length,
      operations: [{ type: 'remove', text: oldText, start: 0 }]
    };
  }

  // Generate detailed diff operations using LCS-based algorithm
  const operations = generateDiffOperations(oldText, newText);

  // Calculate totals from operations
  let added = 0;
  let removed = 0;

  operations.forEach(op => {
    if (op.type === 'add') {
      added += op.text.length;
    } else if (op.type === 'remove') {
      removed += op.text.length;
    }
  });

  return { added, removed, operations };
}

/**
 * Generates detailed diff operations using a simpler but more reliable algorithm
 * @param {string} oldText - Previous text content
 * @param {string} newText - Current text content
 * @returns {Array} Array of diff operations
 */
function generateDiffOperations(oldText, newText) {
  const operations = [];

  // Use a simpler approach: find common prefix and suffix, then handle the middle
  let prefixLength = 0;
  const minLength = Math.min(oldText.length, newText.length);

  // Find common prefix
  while (prefixLength < minLength && oldText[prefixLength] === newText[prefixLength]) {
    prefixLength++;
  }

  // Find common suffix
  let suffixLength = 0;
  while (suffixLength < minLength - prefixLength &&
         oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]) {
    suffixLength++;
  }

  // Add prefix as equal operations (character by character for granular tracking)
  for (let i = 0; i < prefixLength; i++) {
    operations.push({ type: 'equal', text: oldText[i], oldStart: i, newStart: i });
  }

  // Handle the middle section (differences)
  const oldMiddleStart = prefixLength;
  const oldMiddleEnd = oldText.length - suffixLength;
  const newMiddleStart = prefixLength;
  const newMiddleEnd = newText.length - suffixLength;

  const oldMiddle = oldText.substring(oldMiddleStart, oldMiddleEnd);
  const newMiddle = newText.substring(newMiddleStart, newMiddleEnd);

  // If there are differences in the middle
  if (oldMiddle.length > 0 || newMiddle.length > 0) {
    if (oldMiddle.length > 0) {
      operations.push({ type: 'remove', text: oldMiddle, start: oldMiddleStart });
    }
    if (newMiddle.length > 0) {
      operations.push({ type: 'add', text: newMiddle, start: newMiddleStart });
    }
  }

  // Add suffix as equal operations
  for (let i = 0; i < suffixLength; i++) {
    const oldIndex = oldText.length - suffixLength + i;
    const newIndex = newText.length - suffixLength + i;
    operations.push({ type: 'equal', text: oldText[oldIndex], oldStart: oldIndex, newStart: newIndex });
  }

  return operations;
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
      return defaultReturn;
    }

    // Handle case for new pages (no previous content)
    if (!previousContent || previousContent === "") {
      // Extract text from current content
      const currentText = extractTextContent(currentContent);

      // If text is empty or too short
      if (!currentText || !currentText.trim() || currentText.length < 3) {
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
      return defaultReturn;
    }

    // Use accurate character diff calculation with detailed operations
    const charDiff = calculateCharacterDiff(previousText, currentText);

    // Generate enhanced diff preview that shows both additions and deletions
    // This now uses the same LCS-based algorithm for consistency
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
 * Uses the same LCS-based algorithm as character counting for consistency
 * @param {string} oldText - Previous text content
 * @param {string} newText - Current text content
 * @returns {Object|null} Enhanced diff preview object or null if no meaningful diff
 */
function generateEnhancedDiffPreview(oldText, newText) {
  try {
    // Get detailed diff operations using the same algorithm as character counting
    const diffResult = calculateCharacterDiff(oldText, newText);

    if (!diffResult.operations || diffResult.operations.length === 0) {
      return null; // No differences
    }

    // Find the first and last change operations to determine context boundaries
    let firstChangeIndex = -1;
    let lastChangeIndex = -1;

    for (let i = 0; i < diffResult.operations.length; i++) {
      const op = diffResult.operations[i];
      if (op.type === 'add' || op.type === 'remove') {
        if (firstChangeIndex === -1) {
          firstChangeIndex = i;
        }
        lastChangeIndex = i;
      }
    }

    if (firstChangeIndex === -1) {
      return null; // No actual changes found
    }

    // Build the preview by extracting context and changes
    let beforeContext = '';
    let addedText = '';
    let removedText = '';
    let afterContext = '';
    let hasAdditions = false;
    let hasRemovals = false;

    // Extract before context (up to 120 characters before first change)
    let beforeContextLength = 0;
    for (let i = firstChangeIndex - 1; i >= 0 && beforeContextLength < 120; i--) {
      const op = diffResult.operations[i];
      if (op.type === 'equal') {
        const textToAdd = op.text;
        if (beforeContextLength + textToAdd.length <= 120) {
          beforeContext = textToAdd + beforeContext;
          beforeContextLength += textToAdd.length;
        } else {
          // Add partial text and break
          const remainingSpace = 120 - beforeContextLength;
          beforeContext = textToAdd.substring(textToAdd.length - remainingSpace) + beforeContext;
          break;
        }
      }
    }

    // Extract changes and collect added/removed text
    for (let i = firstChangeIndex; i <= lastChangeIndex; i++) {
      const op = diffResult.operations[i];
      if (op.type === 'add') {
        addedText += op.text;
        hasAdditions = true;
      } else if (op.type === 'remove') {
        removedText += op.text;
        hasRemovals = true;
      }
    }

    // Extract after context (up to 120 characters after last change)
    let afterContextLength = 0;
    for (let i = lastChangeIndex + 1; i < diffResult.operations.length && afterContextLength < 120; i++) {
      const op = diffResult.operations[i];
      if (op.type === 'equal') {
        const textToAdd = op.text;
        if (afterContextLength + textToAdd.length <= 120) {
          afterContext += textToAdd;
          afterContextLength += textToAdd.length;
        } else {
          // Add partial text and break
          const remainingSpace = 120 - afterContextLength;
          afterContext += textToAdd.substring(0, remainingSpace);
          break;
        }
      }
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
            // For link nodes, extract text with compound link support
            let linkText = '';

            // Handle compound links with author attribution
            if (node.showAuthor && node.authorUsername && node.pageId) {
              // Determine the base text for compound links
              let baseText = '';

              // Check for custom text first
              if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
                baseText = node.displayText;
              } else if (node.children) {
                const childText = extractText(node.children);
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
            // Handle regular links
            else {
              // Check for custom text first
              if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
                linkText = node.displayText;
              } else if (node.children) {
                linkText = extractText(node.children);
              } else if (node.pageTitle) {
                linkText = node.pageTitle;
              } else if (node.url) {
                linkText = node.url;
              }
            }

            // Add the link text with special markers to indicate it's a link
            text += `[${linkText}]`;
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
            // For link nodes, extract text with compound link support
            let linkText = '';

            // Handle compound links with author attribution
            if (node.showAuthor && node.authorUsername && (node.pageId || node.__pageId)) {
              // Determine the base text for compound links
              let baseText = '';

              // Check for custom text first
              if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
                baseText = node.displayText;
              } else if (node.children) {
                const childText = extractText(node.children);
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
            // Handle regular links
            else {
              // Check for custom text first
              if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
                linkText = node.displayText;
              } else if (node.children) {
                linkText = extractText(node.children);
              } else if (node.pageTitle || node.__pageTitle) {
                linkText = node.pageTitle || node.__pageTitle;
              } else if (node.url || node.__url) {
                linkText = node.url || node.__url;
              }
            }

            // Add the link text with special markers to indicate it's a link
            text += `[${linkText}]`;
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
