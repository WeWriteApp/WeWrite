/**
 * Type definitions for text diff operations
 */

/** Diff operation types */
export type DiffOperationType = 'add' | 'remove' | 'equal';

/** Individual diff operation */
export interface DiffOperation {
  /** Type of operation */
  type: DiffOperationType;
  /** Text content for this operation */
  text: string;
  /** Start position in old text (for remove/equal operations) */
  oldStart?: number;
  /** Start position in new text (for add/equal operations) */
  newStart?: number;
  /** Start position (generic) */
  start?: number;
}

/** Result of character diff calculation */
export interface CharacterDiffResult {
  /** Number of characters added */
  added: number;
  /** Number of characters removed */
  removed: number;
  /** Detailed diff operations */
  operations: DiffOperation[];
}

/** Enhanced diff preview for visual display */
export interface DiffPreview {
  /** Context text before changes */
  beforeContext: string;
  /** Text that was added */
  addedText: string;
  /** Text that was removed */
  removedText: string;
  /** Context text after changes */
  afterContext: string;
  /** Whether there are additions */
  hasAdditions: boolean;
  /** Whether there are removals */
  hasRemovals: boolean;
}

/** Complete text diff result */
export interface TextDiffResult {
  /** Number of characters added */
  added: number;
  /** Number of characters removed */
  removed: number;
  /** Visual preview of changes (null if no meaningful changes) */
  preview: DiffPreview | null;
}
