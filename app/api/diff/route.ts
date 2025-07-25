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
 * Generate enhanced diff preview showing one meaningful chunk
 * Shows context around the most significant change
 */
function generateDiffPreview(oldText: string, newText: string, operations: DiffOperation[]): DiffPreview | null {
  if (!operations || operations.length === 0) {
    return null;
  }

  // Find the most significant change (largest addition or removal)
  let largestChange = null;
  let largestSize = 0;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (op.type === 'add' || op.type === 'remove') {
      if (op.text.length > largestSize) {
        largestSize = op.text.length;
        largestChange = { operation: op, index: i };
      }
    }
  }

  if (!largestChange) {
    return null;
  }

  const contextLength = 150; // Characters of context on each side
  const changeOp = largestChange.operation;
  const changeIndex = largestChange.index;

  // Get context before the change
  let beforeContext = '';
  for (let i = changeIndex - 1; i >= 0; i--) {
    const op = operations[i];
    if (op.type === 'equal') {
      const contextText = op.text.slice(-contextLength);
      beforeContext = contextText + beforeContext;
      break;
    }
  }

  // Get context after the change
  let afterContext = '';
  for (let i = changeIndex + 1; i < operations.length; i++) {
    const op = operations[i];
    if (op.type === 'equal') {
      const contextText = op.text.slice(0, contextLength);
      afterContext = afterContext + contextText;
      break;
    }
  }

  // Collect all additions and removals in this chunk
  let addedText = '';
  let removedText = '';
  let hasAdditions = false;
  let hasRemovals = false;

  // Look for adjacent changes to include in the same preview
  let startIndex = changeIndex;
  let endIndex = changeIndex;

  // Expand backwards to include adjacent changes
  while (startIndex > 0 && operations[startIndex - 1].type !== 'equal') {
    startIndex--;
  }

  // Expand forwards to include adjacent changes
  while (endIndex < operations.length - 1 && operations[endIndex + 1].type !== 'equal') {
    endIndex++;
  }

  // Collect all changes in this range
  for (let i = startIndex; i <= endIndex; i++) {
    const op = operations[i];
    if (op.type === 'add') {
      addedText += op.text;
      hasAdditions = true;
    } else if (op.type === 'remove') {
      removedText += op.text;
      hasRemovals = true;
    }
  }

  return {
    beforeContext: beforeContext.trim(),
    addedText: addedText.trim(),
    removedText: removedText.trim(),
    afterContext: afterContext.trim(),
    hasAdditions,
    hasRemovals
  };
}

export async function POST(request: NextRequest) {
  try {
    const { currentContent, previousContent } = await request.json();

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

    console.log('🔍 DIFF API DEBUG:', {
      currentContentType: typeof currentContent,
      previousContentType: typeof previousContent,
      currentTextLength: currentText.length,
      previousTextLength: previousText.length,
      currentTextPreview: currentText.slice(0, 100),
      previousTextPreview: previousText.slice(0, 100),
      textsEqual: currentText === previousText
    });

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
