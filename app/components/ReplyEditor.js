"use client";

import React, { useEffect, useRef } from 'react';
import SlateEditor from './SlateEditor';
import { createEditor, Transforms, Editor, Range, Path, Point } from 'slate';
import { ReactEditor } from 'slate-react';

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

  // Forward ref to access the Slate editor instance
  const forwardRef = (editor) => {
    editorRef.current = editor;
    return editor;
  };

  useEffect(() => {
    // Only run this once when the component mounts and initialContent is available
    if (initialContent && !cursorPositioned.current) {
      // Set cursor positioned flag to prevent multiple positioning attempts
      cursorPositioned.current = true;

      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
          // Position cursor at the beginning of the third paragraph (after the attribution and blank line)
          if (initialContent.length >= 3 && editorRef.current) {
            const editor = editorRef.current;

            // Check if the editor has the necessary methods
            if (editor && typeof editor.selection !== 'undefined') {
              // Create a point at the start of the third paragraph (index 2)
              const point = { path: [2, 0], offset: 0 };

              // Use ReactEditor to focus and select
              try {
                // Make sure the editor is focusable
                if (ReactEditor.isFocusable(editor)) {
                  ReactEditor.focus(editor);
                  Transforms.select(editor, point);
                  console.log('Cursor positioned at response paragraph using ReactEditor');
                } else {
                  console.warn('Editor is not focusable');
                  // Fallback to direct DOM manipulation
                  const editorElement = document.querySelector('[data-slate-editor=true]');
                  if (editorElement) {
                    editorElement.focus();
                    console.log('Editor focused via DOM');
                  }
                }
              } catch (reactEditorError) {
                console.error('Error using ReactEditor:', reactEditorError);

                // Fallback to direct DOM manipulation
                const editorElement = document.querySelector('[data-slate-editor=true]');
                if (editorElement) {
                  editorElement.focus();
                  console.log('Editor focused via DOM');
                }
              }
            } else {
              console.warn('Editor instance missing selection capability');
              // Fallback to direct DOM focus
              const editorElement = document.querySelector('[data-slate-editor=true]');
              if (editorElement) {
                editorElement.focus();
                console.log('Editor focused via DOM (fallback)');
              }
            }
          }
        } catch (error) {
          console.error('Error positioning cursor:', error);
        }
      }, 500); // Increased timeout for better reliability

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
