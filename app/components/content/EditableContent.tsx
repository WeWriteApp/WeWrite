'use client';

import React from 'react';
import SlateEditor from '../editor/SlateEditor';

/**
 * EditableContent - Pure Editing Component
 * 
 * This component handles all editing functionality for WeWrite content.
 * It's a clean wrapper around SlateEditor with consistent styling and
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
  content: any[];
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
  return (
    <div className={`wewrite-editable-content ${className}`}>
      <SlateEditor
        initialContent={content}
        onChange={onChange}
        onEmptyLinesChange={onEmptyLinesChange}
        placeholder={placeholder}
        readOnly={false}
        location={location}
        setLocation={setLocation}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
        isSaving={isSaving}
        error={error}
        isNewPage={isNewPage}
        showToolbar={showToolbar}
        onInsertLinkRequest={onInsertLinkRequest}
        pageId={pageId}
      />
    </div>
  );
};

export default EditableContent;
