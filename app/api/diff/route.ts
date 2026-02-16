import { NextRequest, NextResponse } from 'next/server';
import { extractTextContent } from '../../utils/text-extraction';

/**
 * Centralized Diff API Service
 * 
 * Provides server-side diff calculation with consistent, reliable results.
 * This consolidates all diff implementations into a single, authoritative service.
 */

export interface DiffOperation {
  type: 'add' | 'remove' | 'equal';
  text: string;
  start: number;
}

export interface DiffResult {
  added: number;
  removed: number;
  operations: DiffOperation[];
  preview: DiffPreview | null;
  hasChanges: boolean;
}

export interface DiffPreview {
  beforeContext: string;
  addedText: string;
  removedText: string;
  afterContext: string;
  hasAdditions: boolean;
  hasRemovals: boolean;
}

/**
 * Improved word-level diff algorithm
 * This provides more intelligent diffing by working at word boundaries
 * and using a proper longest common subsequence algorithm
 */
function calculateCharacterDiff(oldText: string, newText: string): { added: number; removed: number; operations: DiffOperation[] } {
  if (!oldText && !newText) {
    return { added: 0, removed: 0, operations: [] };
  }

  if (!oldText) {
    // For new content (no previous text), create a preview showing the added text
    const addedPreview = newText.length > 200 ? newText.slice(0, 200) + '…' : newText;
    return {
      added: newText.length,
      removed: 0,
      operations: [{ type: 'add', text: newText, start: 0 }],
      preview: {
        beforeContext: '',
        addedText: addedPreview.trim(),
        removedText: '',
        afterContext: '',
        hasAdditions: true,
        hasRemovals: false
      }
    };
  }

  if (!newText) {
    // For deleted content, create a preview showing the removed text
    const removedPreview = oldText.length > 200 ? oldText.slice(0, 200) + '…' : oldText;
    return {
      added: 0,
      removed: oldText.length,
      operations: [{ type: 'remove', text: oldText, start: 0 }],
      preview: {
        beforeContext: '',
        addedText: '',
        removedText: removedPreview.trim(),
        afterContext: '',
        hasAdditions: false,
        hasRemovals: true
      }
    };
  }

  // Use word-level diffing for better results
  const operations = calculateWordLevelDiff(oldText, newText);

  // Calculate totals
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
 * Word-level diff using longest common subsequence
 * This provides much better results than the simple prefix/suffix approach
 */
function calculateWordLevelDiff(oldText: string, newText: string): DiffOperation[] {
  // Split into words while preserving whitespace
  const oldWords = splitIntoWords(oldText);
  const newWords = splitIntoWords(newText);

  // Calculate LCS of words
  const lcs = longestCommonSubsequence(oldWords, newWords);

  // Convert LCS result back to operations
  const operations: DiffOperation[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let position = 0;

  for (const op of lcs) {
    if (op.type === 'equal') {
      // Add any removed words before this equal section
      while (oldIndex < op.oldIndex) {
        operations.push({
          type: 'remove',
          text: oldWords[oldIndex],
          start: position
        });
        oldIndex++;
      }

      // Add any added words before this equal section
      while (newIndex < op.newIndex) {
        operations.push({
          type: 'add',
          text: newWords[newIndex],
          start: position
        });
        position += newWords[newIndex].length;
        newIndex++;
      }

      // Add the equal section
      operations.push({
        type: 'equal',
        text: oldWords[oldIndex],
        start: position
      });
      position += oldWords[oldIndex].length;
      oldIndex++;
      newIndex++;
    }
  }

  // Add any remaining removed words
  while (oldIndex < oldWords.length) {
    operations.push({
      type: 'remove',
      text: oldWords[oldIndex],
      start: position
    });
    oldIndex++;
  }

  // Add any remaining added words
  while (newIndex < newWords.length) {
    operations.push({
      type: 'add',
      text: newWords[newIndex],
      start: position
    });
    position += newWords[newIndex].length;
    newIndex++;
  }

  return operations;
}

/**
 * Split text into words while preserving whitespace and punctuation
 */
function splitIntoWords(text: string): string[] {
  // Split on word boundaries but keep delimiters
  return text.split(/(\s+|[.,!?;:])/g).filter(word => word.length > 0);
}

/**
 * Calculate longest common subsequence for word arrays
 */
function longestCommonSubsequence(oldWords: string[], newWords: string[]): Array<{type: 'equal', oldIndex: number, newIndex: number}> {
  const oldLen = oldWords.length;
  const newLen = newWords.length;

  // Create LCS table
  const lcs: number[][] = Array(oldLen + 1).fill(null).map(() => Array(newLen + 1).fill(0));

  // Fill LCS table
  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual LCS
  const result: Array<{type: 'equal', oldIndex: number, newIndex: number}> = [];
  let i = oldLen;
  let j = newLen;

  while (i > 0 && j > 0) {
    if (oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'equal', oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (lcs[i - 1][j] > lcs[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Generate enhanced diff preview showing the first meaningful change WITH context
 *
 * CRITICAL REQUIREMENT: The preview MUST show surrounding unchanged words/text
 * so that users can understand the context in which the change occurred.
 * A typo fix should show: "...the algorithm [~manipualtes~][manipulates] the data..."
 * NOT just: "[~manipualtes~][manipulates]"
 *
 * Shows both additions AND deletions together with surrounding context
 * Limited to ~3 lines worth of content for readability
 */
function generateDiffPreview(oldText: string, newText: string, operations: DiffOperation[]): DiffPreview | null {
  if (!operations || operations.length === 0) {
    return null;
  }

  // Find the FIRST change (not largest) - this is more intuitive for users
  let firstChangeIndex = -1;
  for (let i = 0; i < operations.length; i++) {
    if (operations[i].type === 'add' || operations[i].type === 'remove') {
      firstChangeIndex = i;
      break;
    }
  }

  if (firstChangeIndex === -1) {
    return null;
  }

  const contextLength = 50; // Characters of context to show on each side
  const maxChangeLength = 200; // Max characters for added/removed text

  // IMPROVED: Collect ALL equal text before the first change to build context
  // This ensures we always show surrounding unchanged words
  let beforeContextParts: string[] = [];
  for (let i = 0; i < firstChangeIndex; i++) {
    const op = operations[i];
    if (op.type === 'equal') {
      beforeContextParts.push(op.text);
    }
  }

  // Join all equal parts and take the last N characters
  let beforeContext = beforeContextParts.join('');
  if (beforeContext.length > contextLength) {
    // Find a word boundary to break at for cleaner display
    const truncated = beforeContext.slice(-contextLength);
    const firstSpace = truncated.indexOf(' ');
    if (firstSpace > 0 && firstSpace < 15) {
      // Break at word boundary if within reasonable range
      beforeContext = truncated.slice(firstSpace + 1);
    } else {
      beforeContext = truncated;
    }
  }

  // Collect ALL additions and removals from this point forward
  // until we hit enough context or reach limits
  let addedText = '';
  let removedText = '';
  let hasAdditions = false;
  let hasRemovals = false;
  let afterContextParts: string[] = [];
  let collectingAfterContext = false;
  let afterContextLength = 0;

  // Track pending equal content that might be part of a larger change
  // (whitespace or short words between consecutive changes)
  let pendingEqual = '';
  let pendingEqualIsWhitespace = false;

  for (let i = firstChangeIndex; i < operations.length; i++) {
    const op = operations[i];

    // Check if this operation is just whitespace or very short
    const isWhitespaceOnly = /^\s+$/.test(op.text);
    const isShortConnector = op.text.length <= 3 && /^[\s.,;:'"!?-]+$/.test(op.text);

    if (op.type === 'add') {
      // If we were collecting after context and hit another change, stop
      if (collectingAfterContext && afterContextLength > 10) {
        break;
      }
      // Don't exceed max length
      if (addedText.length < maxChangeLength) {
        // Include pending equal content if we're continuing a change
        if (pendingEqual && addedText.length > 0) {
          addedText += pendingEqual;
        }
        addedText += op.text;
        hasAdditions = true;
      }
      pendingEqual = '';
      pendingEqualIsWhitespace = false;
      collectingAfterContext = false;
    } else if (op.type === 'remove') {
      // If we were collecting after context and hit another change, stop
      if (collectingAfterContext && afterContextLength > 10) {
        break;
      }
      // Don't exceed max length
      if (removedText.length < maxChangeLength) {
        // Include pending equal content if we're continuing a change
        if (pendingEqual && removedText.length > 0) {
          removedText += pendingEqual;
        }
        removedText += op.text;
        hasRemovals = true;
      }
      pendingEqual = '';
      pendingEqualIsWhitespace = false;
      collectingAfterContext = false;
    } else if (op.type === 'equal') {
      // Check if there's a change coming soon after this equal
      // Look ahead to see if we should include this as part of the change
      const lookAheadLimit = Math.min(i + 4, operations.length);
      let hasUpcomingChange = false;
      for (let j = i + 1; j < lookAheadLimit; j++) {
        if (operations[j].type === 'add' || operations[j].type === 'remove') {
          hasUpcomingChange = true;
          break;
        }
      }

      // If this is whitespace/punctuation and there's an upcoming change,
      // save it as pending to include with the next change
      if ((isWhitespaceOnly || isShortConnector) && hasUpcomingChange && !collectingAfterContext) {
        // If we already have changes, include this whitespace with them
        if (hasAdditions || hasRemovals) {
          pendingEqual = op.text;
          pendingEqualIsWhitespace = isWhitespaceOnly;
          continue;
        }
      }

      // If we were collecting pending equal content but found no more changes,
      // add it to after context instead
      if (pendingEqual) {
        afterContextParts.push(pendingEqual);
        afterContextLength += pendingEqual.length;
        pendingEqual = '';
        pendingEqualIsWhitespace = false;
      }

      // Collect equal text as after context
      collectingAfterContext = true;
      afterContextParts.push(op.text);
      afterContextLength += op.text.length;

      // Stop if we have enough after context
      if (afterContextLength >= contextLength) {
        break;
      }
    }
  }

  // Handle any remaining pending equal content
  if (pendingEqual) {
    afterContextParts.unshift(pendingEqual);
  }

  // Join all after context parts and take the first N characters
  let afterContext = afterContextParts.join('');
  if (afterContext.length > contextLength) {
    // Find a word boundary to break at for cleaner display
    const truncated = afterContext.slice(0, contextLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > contextLength - 15) {
      // Break at word boundary if within reasonable range
      afterContext = truncated.slice(0, lastSpace);
    } else {
      afterContext = truncated;
    }
  }

  // Truncate change text with ellipsis if needed
  if (addedText.length > maxChangeLength) {
    addedText = addedText.slice(0, maxChangeLength) + '…';
  }
  if (removedText.length > maxChangeLength) {
    removedText = removedText.slice(0, maxChangeLength) + '…';
  }

  // IMPORTANT: Don't trim aggressively - preserve spacing for readability
  // Only trim leading/trailing whitespace from the overall context
  return {
    beforeContext: beforeContext.trimStart(),
    addedText: addedText,
    removedText: removedText,
    afterContext: afterContext.trimEnd(),
    hasAdditions,
    hasRemovals
  };
}

export async function POST(request: NextRequest) {
  try {
    const { currentContent, previousContent, titleChange } = await request.json();

    // Handle title changes specially
    if (titleChange) {
      const { oldTitle, newTitle } = titleChange;
      const titleDiff = calculateCharacterDiff(oldTitle || '', newTitle || '');

      // Create title-specific preview
      const titlePreview: DiffPreview = {
        beforeContext: 'Title: ',
        addedText: newTitle || '',
        removedText: oldTitle || '',
        afterContext: '',
        hasAdditions: !!newTitle && newTitle !== oldTitle,
        hasRemovals: !!oldTitle && oldTitle !== newTitle
      };

      return NextResponse.json({
        added: titleDiff.added,
        removed: titleDiff.removed,
        operations: titleDiff.operations,
        preview: titlePreview,
        hasChanges: true
      });
    }

    if (!currentContent && !previousContent) {
      return NextResponse.json({
        added: 0,
        removed: 0,
        operations: [],
        preview: null,
        hasChanges: false
      });
    }

    // Extract text content from both versions
    const currentText = extractTextContent(currentContent || '');
    const previousText = extractTextContent(previousContent || '');


    // Calculate character-level diff
    const diffResult = calculateCharacterDiff(previousText, currentText);
    
    // Generate preview showing the most significant change
    const preview = generateDiffPreview(previousText, currentText, diffResult.operations);
    
    // Determine if there are meaningful changes
    const hasChanges = diffResult.added > 0 || diffResult.removed > 0;

    const result: DiffResult = {
      added: diffResult.added,
      removed: diffResult.removed,
      operations: diffResult.operations,
      preview,
      hasChanges
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Diff API error:', error);
    return NextResponse.json({
      error: 'Failed to calculate diff',
      details: error.message
    }, { status: 500 });
  }
}
