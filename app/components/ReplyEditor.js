"use client";

import React, { useEffect, useRef } from 'react';
import SlateEditor from './SlateEditor';
import { createEditor, Transforms, Editor, Range, Path, Point } from 'slate';
import { ReactEditor } from 'slate-react';

// Safely check if ReactEditor methods exist before using them
const safeReactEditor = {
  focus: (editor) => {
    try {
      if (ReactEditor && typeof ReactEditor.focus === 'function') {
        ReactEditor.focus(editor);
        return true;
      }
    } catch (error) {
      console.error('Error in safeReactEditor.focus:', error);
    }
    return false;
  },
  isFocused: (editor) => {
    try {
      if (ReactEditor && typeof ReactEditor.isFocused === 'function') {
        return ReactEditor.isFocused(editor);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.isFocused:', error);
    }
    return false;
  }
};

/**
 * ReplyEditor Component
 *
 * A specialized wrapper around SlateEditor that handles reply-specific functionality:
 * - Positions the cursor in the second paragraph
 * - Preserves the attribution line in the first paragraph
 *
 * @param {Object} props
 * @param {Array} props.initialContent - The initial content for the editor
 * @param {Function} props.setEditorState - Function to update the editor state
 */
export default function ReplyEditor({ initialContent, setEditorState }) {
  // Reference to the SlateEditor component
  const editorRef = useRef(null);

  // Flag to track if we've positioned the cursor
  const cursorPositioned = useRef(false);
  const hasAutoFocused = useRef(false);

  // Log the initialContent to help with debugging
  console.log("ReplyEditor received initialContent:", initialContent);

  // Forward ref to access the Slate editor instance
  const forwardRef = (editor) => {
    editorRef.current = editor;
    return editor;
  };

  useEffect(() => {
    // Only run this once on mount
    if (initialContent && !hasAutoFocused.current && editorRef.current) {
      hasAutoFocused.current = true;
      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
          // Position cursor at the beginning of the response paragraph (second line)
          const editor = editorRef.current;
          if (editor && typeof editor.selection !== 'undefined') {
            const point = { path: [1, 0], offset: 0 };
            try {
              const focused = safeReactEditor.focus(editor);
              Transforms.select(editor, point);
            } catch (err) {
              // Fallback to DOM focus
              const editorElement = document.querySelector('[data-slate-editor=true]');
              if (editorElement) editorElement.focus();
            }
          }
        } catch (error) {
          // Fallback to DOM focus
          const editorElement = document.querySelector('[data-slate-editor=true]');
          if (editorElement) editorElement.focus();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialContent]);

  // Custom onChange handler to prevent editing the attribution line and blank line
  const handleChange = (value) => {
    // Check if the attribution line or blank line was modified
    if (initialContent && value.length > 0 && initialContent.length > 0) {
      // If the first paragraph (attribution line) was changed, restore it
      if (JSON.stringify(value[0]) !== JSON.stringify(initialContent[0])) {
        console.log('Preventing edit of attribution line');
        value[0] = initialContent[0];
      }

      // If the second paragraph (blank line) was changed, restore it
      if (initialContent.length > 1 && value.length > 1) {
        if (JSON.stringify(value[1]) !== JSON.stringify(initialContent[1])) {
          console.log('Preventing edit of blank line');
          value[1] = initialContent[1];
        }
      }
    }

    // Pass the updated value to the parent component
    if (setEditorState) {
      setEditorState(value);
    }
  };

  return (
    <SlateEditor
      ref={forwardRef}
      initialContent={initialContent}
      onContentChange={handleChange}
    />
  );
}
