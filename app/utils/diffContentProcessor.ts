/**
 * Diff Content Processor
 * 
 * Converts diff operations into displayable content with proper annotations
 * for highlighting added/removed text in the UI.
 */

import { DiffOperation, DiffResult } from './diffService';
import { extractTextContent } from './text-extraction';

export interface AnnotatedTextNode {
  text: string;
  added?: boolean;
  removed?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
}

export interface AnnotatedParagraphNode {
  type: 'paragraph';
  children: AnnotatedTextNode[];
  diffType?: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface ProcessedDiffContent {
  content: AnnotatedParagraphNode[];
  summary: {
    added: number;
    removed: number;
    hasChanges: boolean;
  };
}

/**
 * Process diff operations into annotated content for display
 */
export function processDiffForDisplay(
  currentContent: any,
  previousContent: any,
  diffResult: DiffResult
): ProcessedDiffContent {
  try {
    // If no diff operations, return current content without annotations
    if (!diffResult.operations || diffResult.operations.length === 0) {
      return {
        content: normalizeContentToParagraphs(currentContent),
        summary: {
          added: 0,
          removed: 0,
          hasChanges: false
        }
      };
    }

    // Convert diff operations to annotated text nodes
    const annotatedNodes: AnnotatedTextNode[] = [];
    
    for (const operation of diffResult.operations) {
      switch (operation.type) {
        case 'add':
          // Split by lines to handle paragraph breaks
          const addedLines = operation.text.split('\n');
          addedLines.forEach((line, index) => {
            if (line.trim()) {
              annotatedNodes.push({
                text: line,
                added: true
              });
            }
            // Add line break except for last line
            if (index < addedLines.length - 1) {
              annotatedNodes.push({ text: '\n' });
            }
          });
          break;
          
        case 'remove':
          // Split by lines to handle paragraph breaks
          const removedLines = operation.text.split('\n');
          removedLines.forEach((line, index) => {
            if (line.trim()) {
              annotatedNodes.push({
                text: line,
                removed: true
              });
            }
            // Add line break except for last line
            if (index < removedLines.length - 1) {
              annotatedNodes.push({ text: '\n' });
            }
          });
          break;
          
        case 'equal':
          // Unchanged text
          const equalLines = operation.text.split('\n');
          equalLines.forEach((line, index) => {
            if (line.trim() || index === 0) { // Keep first line even if empty
              annotatedNodes.push({
                text: line
              });
            }
            // Add line break except for last line
            if (index < equalLines.length - 1) {
              annotatedNodes.push({ text: '\n' });
            }
          });
          break;
      }
    }

    // Convert annotated nodes to paragraph structure
    const paragraphs = convertAnnotatedNodesToParagraphs(annotatedNodes);

    return {
      content: paragraphs,
      summary: {
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: diffResult.hasChanges
      }
    };

  } catch (error) {
    console.error('Error processing diff for display:', error);
    
    // Fallback: return current content without annotations
    return {
      content: normalizeContentToParagraphs(currentContent),
      summary: {
        added: 0,
        removed: 0,
        hasChanges: false
      }
    };
  }
}

/**
 * Convert annotated text nodes to paragraph structure
 */
function convertAnnotatedNodesToParagraphs(nodes: AnnotatedTextNode[]): AnnotatedParagraphNode[] {
  const paragraphs: AnnotatedParagraphNode[] = [];
  let currentParagraph: AnnotatedTextNode[] = [];

  for (const node of nodes) {
    if (node.text === '\n') {
      // End current paragraph and start new one
      if (currentParagraph.length > 0) {
        paragraphs.push({
          type: 'paragraph',
          children: [...currentParagraph],
          diffType: determineParagraphDiffType(currentParagraph)
        });
        currentParagraph = [];
      }
    } else {
      currentParagraph.push(node);
    }
  }

  // Add final paragraph if it has content
  if (currentParagraph.length > 0) {
    paragraphs.push({
      type: 'paragraph',
      children: currentParagraph,
      diffType: determineParagraphDiffType(currentParagraph)
    });
  }

  // Ensure at least one paragraph
  if (paragraphs.length === 0) {
    paragraphs.push({
      type: 'paragraph',
      children: [{ text: '' }],
      diffType: 'unchanged'
    });
  }

  return paragraphs;
}

/**
 * Determine the diff type for a paragraph based on its children
 */
function determineParagraphDiffType(children: AnnotatedTextNode[]): 'added' | 'removed' | 'modified' | 'unchanged' {
  const hasAdded = children.some(child => child.added);
  const hasRemoved = children.some(child => child.removed);
  const hasUnchanged = children.some(child => !child.added && !child.removed);

  if (hasAdded && hasRemoved) return 'modified';
  if (hasAdded && !hasUnchanged) return 'added';
  if (hasRemoved && !hasUnchanged) return 'removed';
  if (hasAdded || hasRemoved) return 'modified';
  return 'unchanged';
}

/**
 * Normalize content to paragraph structure without annotations
 */
function normalizeContentToParagraphs(content: any): AnnotatedParagraphNode[] {
  try {
    let parsedContent = content;
    
    // Parse if it's a JSON string
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        // If parsing fails, treat as plain text
        return [{
          type: 'paragraph',
          children: [{ text: content }],
          diffType: 'unchanged'
        }];
      }
    }

    // If it's already an array of nodes, convert to annotated format
    if (Array.isArray(parsedContent)) {
      return parsedContent.map(node => ({
        type: 'paragraph',
        children: node.children || [{ text: node.text || '' }],
        diffType: 'unchanged' as const
      }));
    }

    // Fallback for other formats
    const textContent = extractTextContent(parsedContent);
    return [{
      type: 'paragraph',
      children: [{ text: textContent }],
      diffType: 'unchanged'
    }];

  } catch (error) {
    console.error('Error normalizing content to paragraphs:', error);
    return [{
      type: 'paragraph',
      children: [{ text: '' }],
      diffType: 'unchanged'
    }];
  }
}

/**
 * Create a unified diff view combining current and previous content
 */
export function createUnifiedDiffView(
  currentContent: any,
  previousContent: any,
  diffResult: DiffResult
): ProcessedDiffContent {
  return processDiffForDisplay(currentContent, previousContent, diffResult);
}

// For testing purposes, also export as CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processDiffForDisplay,
    createUnifiedDiffView,
    convertAnnotatedNodesToParagraphs,
    normalizeContentToParagraphs
  };
}
