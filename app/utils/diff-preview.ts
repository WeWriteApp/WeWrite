/**
 * Diff preview generation utilities
 */

import { DiffPreview } from './diff-types';
import { calculateCharacterDiff } from './diff-algorithms';

/**
 * Generates an enhanced diff preview that shows both additions and deletions
 * Uses the same LCS-based algorithm as character counting for consistency
 */
export function generateEnhancedDiffPreview(oldText: string, newText: string): DiffPreview | null {
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
