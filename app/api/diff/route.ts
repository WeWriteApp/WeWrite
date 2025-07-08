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
 * Robust character-level diff using Myers' algorithm (simplified)
 * This is the single source of truth for all diff calculations
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

  const operations: DiffOperation[] = [];
  
  // Find common prefix
  let prefixLength = 0;
  const minLength = Math.min(oldText.length, newText.length);
  
  while (prefixLength < minLength && oldText[prefixLength] === newText[prefixLength]) {
    prefixLength++;
  }

  // Find common suffix
  let suffixLength = 0;
  while (suffixLength < minLength - prefixLength &&
         oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]) {
    suffixLength++;
  }

  // Add common prefix
  if (prefixLength > 0) {
    operations.push({
      type: 'equal',
      text: oldText.substring(0, prefixLength),
      start: 0
    });
  }

  // Handle middle section
  const oldMiddle = oldText.substring(prefixLength, oldText.length - suffixLength);
  const newMiddle = newText.substring(prefixLength, newText.length - suffixLength);

  if (oldMiddle && newMiddle) {
    // Both have content - this is a replacement
    operations.push({
      type: 'remove',
      text: oldMiddle,
      start: prefixLength
    });
    operations.push({
      type: 'add',
      text: newMiddle,
      start: prefixLength
    });
  } else if (oldMiddle) {
    // Only old has content - this is a deletion
    operations.push({
      type: 'remove',
      text: oldMiddle,
      start: prefixLength
    });
  } else if (newMiddle) {
    // Only new has content - this is an addition
    operations.push({
      type: 'add',
      text: newMiddle,
      start: prefixLength
    });
  }

  // Add common suffix
  if (suffixLength > 0) {
    operations.push({
      type: 'equal',
      text: oldText.substring(oldText.length - suffixLength),
      start: oldText.length - suffixLength
    });
  }

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

  const contextLength = 60; // Characters of context on each side
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
