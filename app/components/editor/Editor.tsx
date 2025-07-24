'use client';

import React from 'react';
import SlateEditor from './SlateEditor';

/**
 * Main Editor Component
 *
 * This is the primary editor entry point for WeWrite. It provides a rich text
 * editing experience with proper inline link support using Slate.js.
 *
 * Key Features:
 * - Proper inline link elements that behave like characters
 * - Cursor can move around links naturally
 * - Links are first-class citizens in the text flow
 * - No overlay hacks or positioning issues
 * - Clean, maintainable Slate.js implementation
 */

interface EditorProps {
  initialContent?: any[];
  onChange: (content: any[]) => void;
  onEmptyLinesChange?: (count: number) => void;
  placeholder?: string;
  readOnly?: boolean;

  // Enhanced props for complete editing functionality
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

  // Page context for link suggestions
  pageId?: string;

  [key: string]: any;
}

const Editor: React.FC<EditorProps> = (props) => {
  // Wrapper that delegates to SlateEditor
  // This provides a stable API while using proper Slate.js implementation
  return <SlateEditor {...props} />;
};

export default Editor;