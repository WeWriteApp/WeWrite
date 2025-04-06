"use client";

import React, { useState, useEffect, useRef } from 'react';
import SlateEditor from './SlateEditor';
import { ReactEditor } from 'slate-react';
import { Transforms } from 'slate';

/**
 * TestReplyEditor Component
 *
 * A simplified test component that directly provides hardcoded content to the SlateEditor
 * to verify that it can properly display pre-filled content with links.
 */
export default function TestReplyEditor({ setEditorState }) {
  // Reference to the SlateEditor component
  const editorRef = useRef(null);

  // Flag to track if we've positioned the cursor
  const cursorPositioned = useRef(false);
  // Hardcoded test content with attribution and links - only two lines
  const testContent = [
    {
      type: "paragraph",
      children: [
        { text: "Replying to " },
        {
          type: "link",
          url: "/test-page-id",
          children: [{ text: "Test Page Title" }]
        },
        { text: " by " },
        {
          type: "link",
          url: "/u/test-user-id",
          children: [{ text: "Test User" }]
        }
      ]
    },
    {
      type: "paragraph",
      children: [{ text: "" }]
    }
  ];

  // Log the content to help with debugging
  console.log("TestReplyEditor using hardcoded content:", JSON.stringify(testContent, null, 2));

  // Forward ref to access the Slate editor instance
  const forwardRef = (editor) => {
    editorRef.current = editor;
    return editor;
  };

  // Pass the content to the parent component
  useEffect(() => {
    if (setEditorState) {
      setEditorState(testContent);
    }
  }, [setEditorState, testContent]);

  // Position cursor at the second line
  useEffect(() => {
    // Only run this once when the component mounts
    if (!cursorPositioned.current) {
      // Set cursor positioned flag to prevent multiple positioning attempts
      cursorPositioned.current = true;

      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
          // Position cursor at the beginning of the second paragraph
          if (editorRef.current) {
            const editor = editorRef.current;

            // Check if the editor has the necessary methods
            if (editor && typeof editor.selection !== 'undefined') {
              // Create a point at the start of the second paragraph (index 1)
              const point = { path: [1, 0], offset: 0 };

              // Use ReactEditor to focus and select
              try {
                // Make sure the editor is focusable
                if (ReactEditor.isFocusable(editor)) {
                  ReactEditor.focus(editor);
                  Transforms.select(editor, point);
                  console.log('Cursor positioned at second paragraph using ReactEditor');
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
  }, []);

  // Custom onChange handler to prevent editing the attribution line
  const handleChange = (value) => {
    // Ensure the first two paragraphs remain unchanged
    if (value.length > 0) {
      // Keep the attribution line unchanged
      value[0] = testContent[0];

      // Keep the blank line unchanged
      if (value.length > 1) {
        value[1] = testContent[1];
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
      initialContent={testContent}
      onContentChange={handleChange}
    />
  );
}
