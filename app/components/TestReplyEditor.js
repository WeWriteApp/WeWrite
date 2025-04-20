"use client";

import React, { useState, useEffect, useRef } from 'react';
import SlateEditor from './SlateEditor';
import { ReactEditor } from 'slate-react';
import { Transforms } from 'slate';
import { useSearchParams } from 'next/navigation';
import { getUsernameById } from '../utils/userUtils';

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
  }
};

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

            // First check if the page object already has a username
            if (originalPage.username && originalPage.username !== "Anonymous") {
              displayUsername = originalPage.username;
              console.log("Using username from page object:", displayUsername);
            }
            if (originalPage.userId) {
              try {
                // First try to get username from RTDB directly
                const { getDatabase, ref, get } = await import('firebase/database');
                const { app } = await import('../firebase/config');
                const rtdb = getDatabase(app);
                const rtdbUserRef = ref(rtdb, `users/${originalPage.userId}`);
                const rtdbSnapshot = await get(rtdbUserRef);

                if (rtdbSnapshot.exists()) {
                  const rtdbUserData = rtdbSnapshot.val();
                  if (rtdbUserData.username) {
                    displayUsername = rtdbUserData.username;
                    console.log(`Found username in RTDB: ${displayUsername}`);
                  } else if (rtdbUserData.displayName) {
                    displayUsername = rtdbUserData.displayName;
                    console.log(`Found displayName in RTDB: ${displayUsername}`);
                  }
                }

                // If still Anonymous, try the utility function
                if (displayUsername === "Anonymous") {
                  try {
                    const utilityUsername = await getUsernameById(originalPage.userId);
                    if (utilityUsername && utilityUsername !== "Anonymous") {
                      displayUsername = utilityUsername;
                      console.log("Fetched username from utility:", displayUsername);
                    }
                  } catch (utilityError) {
                    console.error("Error fetching from utility:", utilityError);
                  }
                }
              } catch (error) {
                console.error("Error fetching username:", error);
                // Fallback to page's stored username if available
                displayUsername = originalPage.username || "Anonymous";
              }
            }

            // Ensure we have a valid username
            if (displayUsername === "Anonymous" && originalPage.username) {
              displayUsername = originalPage.username;
              console.log("Using username directly from page object:", displayUsername);
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
                    url: `/user/${originalPage.userId || "anonymous"}`,
                    isUser: true,
                    userId: originalPage.userId || "anonymous",
                    username: displayUsername,
                    children: [{ text: displayUsername }],
                    // Add explicit class name to ensure proper styling
                    className: "user-link"
                  }
                ]
              },
              {
                type: "paragraph",
                children: [{ text: "" }]
              }
            ];

            // Log the final content structure with username
            console.log("Final reply content with username:", JSON.stringify(content, null, 2));
            console.log("Username being used:", displayUsername);

            // Force the username to be displayed without the @ symbol in the text
            // The @ symbol will be added by CSS
            content[0].children[3].children[0].text = displayUsername;

            // Ensure the user link has all necessary attributes
            content[0].children[3].type = "link";
            content[0].children[3].isUser = true;
            content[0].children[3].className = "user-link";

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

            // Use our safe wrapper for ReactEditor.focus
            try {
              // Use our safe wrapper for ReactEditor.focus
              const focused = safeReactEditor.focus(editor);

              // Try to select the point
              try {
                Transforms.select(editor, point);
                console.log('Cursor positioned at second paragraph');
              } catch (selectError) {
                console.error('Error selecting text:', selectError);
              }

              // If ReactEditor.focus failed, try DOM fallback
              if (!focused) {
                console.warn('Editor focus failed, using DOM fallback');
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
