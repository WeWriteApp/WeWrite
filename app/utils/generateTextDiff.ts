/**
 * Main text diff utility - simplified and modular
 * Uses split modules for better maintainability
 */

import { extractTextContent } from './text-extraction';
import { TextDiffResult } from './diff-types';
import { calculateCharacterDiff } from './diff-algorithms';
import { generateEnhancedDiffPreview } from './diff-preview';

// Re-export types for backward compatibility
export type { TextDiffResult, DiffPreview, CharacterDiffResult, DiffOperation } from './diff-types';

// Re-export main functions for backward compatibility
export { calculateCharacterDiff } from './diff-algorithms';

/**
 * WeWrite Activity Diff Standardization - Enhanced Text Diff Generator
 *
 * Generates a detailed text diff between two content strings with enhanced preview
 * that provides context around changes, showing both additions and deletions.
 *
 * This function is part of the comprehensive diff standardization system that ensures
 * consistent diff display across all ActivityCard implementations in WeWrite.
 *
 * Enhanced Diff Algorithm Features:
 * - Provides up to 3 lines of context (120 characters ≈ 3 lines)
 * - Accurately calculates character-level diffs using Longest Common Subsequence (LCS)
 * - Returns structured diff data with beforeContext, addedText, removedText, afterContext
 * - Handles edge cases like empty content, minimal changes, and parsing errors
 *
 * Integration with Standardized Components:
 * - Used by DiffPreview component for consistent visual display
 * - Used by DiffStats component for accurate statistics
 * - Integrated with all ActivityCard implementations across the application
 *
 * Diff Algorithm Implementation:
 * - Uses Myers' algorithm (simplified) for character-level diff calculation
 * - Tracks additions and deletions separately with detailed operations
 * - Provides context around changes for better user understanding
 * - Optimized for performance with large text content
 *
 */
export function generateTextDiff(currentContent: string, previousContent: string): TextDiffResult {
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





// Re-export for backward compatibility
export { extractTextContent } from './text-extraction';

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
