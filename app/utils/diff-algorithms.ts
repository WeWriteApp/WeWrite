/**
 * Core diff algorithms for text comparison
 */

import { DiffOperation, CharacterDiffResult } from './diff-types';

/**
 * Finds the Longest Common Subsequence between two strings
 * This is used to determine what characters were actually changed
 */
export function longestCommonSubsequence(str1: string, str2: string): string {
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
 * Generates detailed diff operations using a simpler but more reliable algorithm
 */
export function generateDiffOperations(oldText: string, newText: string): DiffOperation[] {
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
 * Calculates character-level diff using Myers' algorithm (simplified)
 * This properly tracks additions and deletions separately and returns detailed diff information
 */
export function calculateCharacterDiff(oldText: string, newText: string): CharacterDiffResult {
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
 * Find the index of the first difference between two strings
 */
export function findFirstDifferenceIndex(str1: string, str2: string): number {
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
export function findLastDifferenceIndex(str1: string, str2: string): number {
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
export function findCommonPointAfterDiff(shorterText: string, longerText: string, diffStartIndex: number): number {
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