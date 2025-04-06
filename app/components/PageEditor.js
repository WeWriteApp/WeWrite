"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../providers/AuthProvider";
import SlateEditor from "./SlateEditor";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Globe, Lock } from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { useSearchParams } from "next/navigation";
import { ReactEditor } from "slate-react";
import { Transforms } from "slate";
import { getUsernameById } from "../utils/userUtils";

/**
 * PageEditor Component
 *
 * A unified editor component that can be used for editing existing pages, creating new ones,
 * and replying to existing pages.
 *
 * @param {Object} props
 * @param {string} props.title - Current title of the page
 * @param {Function} props.setTitle - Function to update the title
 * @param {Array} props.initialContent - Initial content for the editor
 * @param {Function} props.onContentChange - Function to handle content changes
 * @param {boolean} props.isPublic - Whether the page is public
 * @param {Function} props.setIsPublic - Function to toggle page visibility
 * @param {Function} props.onSave - Function to handle saving
 * @param {Function} props.onCancel - Function to handle cancellation
 * @param {boolean} props.isSaving - Whether the page is currently being saved
 * @param {string} props.error - Error message to display
 * @param {boolean} props.isNewPage - Whether this is a new page or editing an existing one
 * @param {boolean} props.isReply - Whether this is a reply to an existing page
 * @param {string} props.replyToId - ID of the page being replied to
 */
const PageEditor = ({
  title,
  setTitle,
  initialContent,
  onContentChange,
  isPublic,
  setIsPublic,
  onSave,
  onCancel,
  isSaving,
  error,
  isNewPage = false,
  isReply = false,
  replyToId = null
}) => {
  const [currentEditorValue, setCurrentEditorValue] = useState(() =>
    initialContent || [{ type: 'paragraph', children: [{ text: '' }] }]
  );
  const [titleError, setTitleError] = useState(false);
  const [replyContent, setReplyContent] = useState(null);
  const { user } = useContext(AuthContext);
  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const cursorPositioned = useRef(false);
  const searchParams = useSearchParams();

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing: true,
    setIsEditing: () => {},
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: !isSaving ? handleSave : null, // Only allow save when not already saving
    isSaving
  });

  // Fetch original page data for reply functionality
  useEffect(() => {
    if (isReply && replyToId) {
      // Import the database module to get page details
      import('../firebase/database').then(({ getPageById }) => {
        getPageById(replyToId).then(async (originalPage) => {
          if (originalPage) {
            console.log("Found original page for reply:", originalPage);

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
                    url: `/${replyToId}`,
                    children: [{ text: originalPage.title || "Untitled" }]
                  },
                  { text: " by " },
                  {
                    type: "link",
                    url: `/u/${originalPage.userId || "anonymous"}`,
                    isUser: true,
                    userId: originalPage.userId || "anonymous",
                    username: displayUsername,
                    children: [{ text: displayUsername }],
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
            content[0].children[3].children[0].text = displayUsername;

            // Set the reply content
            setReplyContent(content);

            // Also update the current editor value if no initialContent was provided
            if (!initialContent) {
              setCurrentEditorValue(content);
              if (onContentChange) {
                onContentChange(content);
              }
            }
          }
        }).catch(error => {
          console.error("Error fetching original page for reply:", error);
        });
      });
    }
  }, [isReply, replyToId, initialContent, onContentChange]);

  // Focus the editor when entering edit mode
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  // Update currentEditorValue when the initialContent prop changes
  useEffect(() => {
    if (initialContent) {
      setCurrentEditorValue(initialContent);
    }
  }, [initialContent]);

  // Position cursor for reply content
  useEffect(() => {
    // Only run this when reply content is available and cursor hasn't been positioned yet
    if (replyContent && !cursorPositioned.current && editorRef.current) {
      // Set cursor positioned flag to prevent multiple positioning attempts
      cursorPositioned.current = true;

      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
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
              console.log('Cursor positioned at second paragraph for reply');
            } catch (reactEditorError) {
              console.error('Error using ReactEditor:', reactEditorError);

              // Fallback to direct DOM manipulation
              const editorElement = document.querySelector('[data-slate-editor=true]');
              if (editorElement) {
                editorElement.focus();
                console.log('Editor focused via DOM');
              }
            }
          }
        } catch (error) {
          console.error('Error positioning cursor for reply:', error);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [replyContent]);

  // Handle content changes
  const handleContentChange = (value) => {
    // For replies, protect the attribution line
    if (isReply && replyContent && value.length > 0 && replyContent.length > 0) {
      // If the first paragraph (attribution line) was changed, restore it
      if (JSON.stringify(value[0]) !== JSON.stringify(replyContent[0])) {
        console.log('Preventing edit of attribution line');
        value[0] = replyContent[0];
      }

      // If the second paragraph (blank line) was changed, restore it
      if (replyContent.length > 1 && value.length > 1) {
        if (JSON.stringify(value[1]) !== JSON.stringify(replyContent[1])) {
          console.log('Preventing edit of blank line');
          value[1] = replyContent[1];
        }
      }
    }

    setCurrentEditorValue(value);
    if (onContentChange) {
      onContentChange(value);
    }
  };

  // Handle save with validation
  function handleSave() {
    if (!user) {
      console.log("User not authenticated");
      return;
    }

    if (!title || title.trim().length === 0) {
      console.log("Title is required");
      setTitleError(true);

      // Focus the title input
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }

      return;
    }

    // Clear any title error
    setTitleError(false);

    // Call the provided onSave function
    if (onSave) {
      onSave();
    }
  }

  // Handle link insertion
  const handleInsertLink = () => {
    // Simulate @ key press to trigger link editor
    if (editorRef.current) {
      editorRef.current.focus();
      const atEvent = new KeyboardEvent('keydown', {
        key: '@',
        code: 'KeyAT',
        keyCode: 50,
        which: 50,
        bubbles: true
      });
      document.activeElement.dispatchEvent(atEvent);
    }
  };

  return (
    <div className="editor-container" style={{ paddingBottom: '60px' }}>
      <div className="mb-4">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim().length > 0) {
              setTitleError(false);
            }
          }}
          className={`w-full mt-1 text-3xl font-semibold bg-background text-foreground border ${titleError ? 'border-destructive ring-2 ring-destructive/20' : 'border-input/30 focus:ring-2 focus:ring-primary/20'} rounded-lg px-3 py-2 transition-all break-words overflow-wrap-normal whitespace-normal`}
          placeholder="Enter a title..."
          autoComplete="off"
          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
          autoFocus={isNewPage}
        />
        {titleError && (
          <p className="text-destructive text-sm mt-1">Title is required</p>
        )}
      </div>

      {/* Simple SlateEditor with no nested containers */}
      <SlateEditor
        ref={editorRef}
        initialContent={currentEditorValue}
        onContentChange={handleContentChange}
        onSave={!isSaving ? handleSave : null}
        onDiscard={onCancel}
        onInsert={handleInsertLink}
      />

      {/* Fixed bottom toolbar with public/private switcher and save/cancel buttons */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center z-10">
        <div className="flex items-center gap-4 bg-background/90 backdrop-blur-md shadow-lg p-2 rounded-lg border border-input">
          {/* Public/Private switcher */}
          <div className="flex items-center gap-2">
            {isPublic ? (
              <Globe className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium">
              {isPublic ? "Public" : "Private"}
            </span>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              aria-label="Toggle page visibility"
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border"></div>

          {/* Save/Cancel buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="fixed top-4 right-4 bg-destructive/10 p-4 rounded-md shadow-md">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PageEditor;
