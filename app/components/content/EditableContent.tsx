'use client';

import React from 'react';
import Editor from '../editor/Editor';

/**
 * EditableContent - Pure Editing Component
 * 
 * This component handles all editing functionality for WeWrite content.
 * It's a clean wrapper around Editor with consistent styling and
 * clear responsibilities.
 * 
 * Responsibilities:
 * - Rich text editing with Slate.js
 * - Inline link management
 * - Content change handling
 * - Editing-specific styling (no borders as per user preference)
 * - Toolbar and editing controls
 * 
 * Styling Philosophy:
 * - No borders (user preference)
 * - Transparent background
 * - Proper text color inheritance
 * - Clean, minimal appearance
 * - Focus on content, not container
 */

interface EditableContentProps {
  content: any;
  onChange: (content: any[]) => void;
  onEmptyLinesChange?: (count: number) => void;
  placeholder?: string;

  // Enhanced editing functionality
  location?: { lat: number; lng: number } | null;
  setLocation?: (location: { lat: number; lng: number } | null) => void;
  onSave?: (content?: any) => void;
  onCancel?: () => void;
  onDelete?: (() => void) | null;
  isSaving?: boolean;
  error?: string;
  isNewPage?: boolean;
  showToolbar?: boolean;
  onInsertLinkRequest?: (triggerFn: () => void) => void;
  pageId?: string;
  className?: string;
}

/**
 * EditableContent Component
 * 
 * Provides a clean editing experience with consistent styling.
 * All styling decisions are documented and centralized.
 */
const EditableContent: React.FC<EditableContentProps> = ({
  content,
  onChange,
  onEmptyLinesChange,
  placeholder = 'Start writing...',
  location,
  setLocation,
  onSave,
  onCancel,
  onDelete,
  isSaving = false,
  error,
  isNewPage = false,
  showToolbar = false,
  onInsertLinkRequest,
  pageId,
  className = ''
}) => {
  // 🎯 ELEGANT: No forced re-renders needed - LinkNode components auto-update via events

  return (
    <div className={`wewrite-editable-content ${className}`}>
      {/* Toolbar and controls - temporarily removed for simplified editor */}
      {showToolbar && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Ctrl+K to insert links</span>
          {onSave && (
            <button
              onClick={() => onSave()}
              disabled={isSaving}
              className="ml-auto px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 border rounded text-sm"
            >
              Cancel
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          {error}
        </div>
      )}

      <Editor
        initialContent={content}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={false}
        pageId={pageId}
        className="min-h-[200px]"
        onInsertLinkRequest={onInsertLinkRequest}
      />
    </div>
  );
};

export default EditableContent;
