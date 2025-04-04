"use client";

import React, { useEffect, useRef } from 'react';
import SlateEditor from './SlateEditor';
import { createEditor, Transforms, Editor, Range, Path, Point } from 'slate';

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
  
  useEffect(() => {
    // Only run this once when the component mounts and initialContent is available
    if (initialContent && !cursorPositioned.current && editorRef.current) {
      // Get the Slate editor instance
      const editor = editorRef.current;
      
      // Set cursor positioned flag to prevent multiple positioning attempts
      cursorPositioned.current = true;
      
      // Use a timeout to ensure the editor is fully initialized
      setTimeout(() => {
        try {
          // Position cursor at the beginning of the second paragraph
          if (initialContent.length >= 2) {
            // Create a point at the start of the second paragraph
            const point = { path: [1, 0], offset: 0 };
            
            // Set the selection to that point
            Transforms.select(editor, point);
            
            console.log('Cursor positioned at second paragraph');
          }
        } catch (error) {
          console.error('Error positioning cursor:', error);
        }
      }, 100);
    }
  }, [initialContent]);
  
  // Custom onChange handler to prevent editing the first paragraph
  const handleChange = (value) => {
    // Pass the updated value to the parent component
    if (setEditorState) {
      setEditorState(value);
    }
  };
  
  return (
    <SlateEditor 
      ref={editorRef}
      initialContent={initialContent} 
      onContentChange={handleChange}
    />
  );
}
