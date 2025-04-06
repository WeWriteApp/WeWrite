"use client";

import React, { useState, useEffect, useRef } from 'react';
import SlateEditor from './SlateEditor';
import { ReactEditor } from 'slate-react';
import { Transforms } from 'slate';
import { useSearchParams } from 'next/navigation';
import { getUsernameById } from '../utils/userUtils';

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

  // Get URL parameters for the reply
  const searchParams = useSearchParams();
  const replyToParam = searchParams.get('replyTo');
  const pageTitle = searchParams.get('title') ?
    decodeURIComponent(searchParams.get('title')).replace(/^Re: "(.*)"$/, '$1') :
    "Untitled";

  // State for the content
  const [replyContent, setReplyContent] = useState(null);

  // Fetch the original page data
  useEffect(() => {
    if (replyToParam) {
      // Import the database module to get page details
      import('../firebase/database').then(({ getPageById }) => {
        getPageById(replyToParam).then(async (originalPage) => {
          if (originalPage) {
            console.log("Found original page:", originalPage);

            // Get the actual username using the utility function
            let displayUsername = "Anonymous";
            if (originalPage.userId) {
              try {
                displayUsername = await getUsernameById(originalPage.userId);
                console.log("Fetched username:", displayUsername);
              } catch (error) {
                console.error("Error fetching username:", error);
                // Fallback to page's stored username if available
                displayUsername = originalPage.username || "Anonymous";
              }
            }

            // Create a direct reply content structure with proper attribution
            const content = [
              {
                type: "paragraph",
                children: [
                  { text: "Replying to " },
                  {
                    type: "link",
                    url: `/${replyToParam}`,
                    children: [{ text: originalPage.title || pageTitle }]
                  },
                  { text: " by " },
                  {
                    type: "link",
                    url: `/u/${originalPage.userId || "anonymous"}`,
                    children: [{ text: displayUsername }]
                  }
                ]
              },
              {
                type: "paragraph",
                children: [{ text: "" }]
              }
            ];

            // Set the content
            setReplyContent(content);

            // Also set the editor state
            if (setEditorState) {
              setEditorState(content);
            }
          } else {
            // Fallback if original page not found
            console.error("Original page not found, using fallback content");
            setFallbackContent();
          }
        }).catch(error => {
          console.error("Error fetching original page:", error);
          setFallbackContent();
        });
      });
    } else {
      // If no replyTo parameter, use fallback
      setFallbackContent();
    }
  }, [replyToParam, pageTitle, setEditorState]);

  // Helper function to set fallback content
  const setFallbackContent = () => {
    const fallbackContent = [
      {
        type: "paragraph",
        children: [
          { text: "Replying to page" }
        ]
      },
      {
        type: "paragraph",
        children: [{ text: "" }]
      }
    ];

    setReplyContent(fallbackContent);
    if (setEditorState) {
      setEditorState(fallbackContent);
    }
  };

  // Log the content to help with debugging
  useEffect(() => {
    if (replyContent) {
      console.log("TestReplyEditor using content:", JSON.stringify(replyContent, null, 2));
    }
  }, [replyContent]);

  // Forward ref to access the Slate editor instance
  const forwardRef = (editor) => {
    editorRef.current = editor;
    return editor;
  };

  // This is now handled in the content fetching effect

  // Position cursor at the second line
  useEffect(() => {
    // Only run this when the component mounts and content is available
    if (replyContent && !cursorPositioned.current && editorRef.current) {
      // Set cursor positioned flag to prevent multiple positioning attempts
      cursorPositioned.current = true;

      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
          // Position cursor at the beginning of the second paragraph
          const editor = editorRef.current;

          // Check if the editor has the necessary methods
          if (editor && typeof editor.selection !== 'undefined') {
            // Create a point at the start of the second paragraph (index 1)
            const point = { path: [1, 0], offset: 0 };

            // Use ReactEditor to focus and select
            try {
              // Focus the editor
              ReactEditor.focus(editor);
              // Set the selection to the second paragraph
              Transforms.select(editor, point);
              console.log('Cursor positioned at second paragraph using ReactEditor');
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
        } catch (error) {
          console.error('Error positioning cursor:', error);
        }
      }, 500); // Increased timeout for better reliability

      return () => clearTimeout(timer);
    }
  }, [replyContent]);

  // Custom onChange handler to prevent editing the attribution line
  const handleChange = (value) => {
    // Only apply protection if we have content
    if (replyContent && value.length > 0) {
      // Keep the attribution line unchanged
      value[0] = replyContent[0];

      // Keep the blank line unchanged
      if (value.length > 1 && replyContent.length > 1) {
        value[1] = replyContent[1];
      }
    }

    // Pass the updated value to the parent component
    if (setEditorState) {
      setEditorState(value);
    }
  };

  // Only render the editor when we have content
  if (!replyContent) {
    return <div className="p-4 text-center">Loading reply content...</div>;
  }

  return (
    <SlateEditor
      ref={forwardRef}
      initialContent={replyContent}
      onContentChange={handleChange}
    />
  );
}
