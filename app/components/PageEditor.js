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
import { fetchUsernameFromApi } from "../utils/apiUtils";
import { createReplyAttribution } from "../utils/linkUtils";

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
  const [loadingReplyContent, setLoadingReplyContent] = useState(false);
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
    // Only fetch original page data if we don't already have initialContent or replyContent
    if (isReply && replyToId && !initialContent && !replyContent) {
      console.log("Fetching original page for reply with ID:", replyToId);
      // Set a flag to indicate we're loading reply content
      setLoadingReplyContent(true);

      // Import the database module to get page details
      import('../firebase/database').then(({ getPageById }) => {
        getPageById(replyToId).then(async (originalPage) => {
          if (originalPage) {
            console.log("Found original page for reply:", originalPage);

            // Get the actual username using multiple sources for reliability
            let displayUsername = "Anonymous";

            // First check if the page object already has a username
            if (originalPage.pageData && originalPage.pageData.username && originalPage.pageData.username !== "Anonymous") {
              displayUsername = originalPage.pageData.username;
              console.log("Using username from page object:", displayUsername);
            }

            // Get the user ID from the page data
            const userId = originalPage.pageData ? originalPage.pageData.userId : null;

            if (userId) {
              try {
                // Try the API first (most reliable)
                const apiUsername = await fetchUsernameFromApi(userId);
                if (apiUsername && apiUsername !== "Anonymous") {
                  displayUsername = apiUsername;
                  console.log("Using username from API:", displayUsername);
                } else {
                  // If API fails, try the utility function
                  const utilityUsername = await getUsernameById(userId);
                  if (utilityUsername && utilityUsername !== "Anonymous") {
                    displayUsername = utilityUsername;
                    console.log("Using username from utility:", displayUsername);
                  }
                }
              } catch (error) {
                console.error("Error fetching username:", error);
              }
            }

            // Create a direct reply content structure with proper attribution
            // using the utility function for consistent structure
            const pageTitle = originalPage.pageData ? originalPage.pageData.title : "Untitled";
            const content = [
              createReplyAttribution({
                pageId: replyToId,
                pageTitle: pageTitle,
                userId: userId,
                username: displayUsername
              })
            ];

            // Log the final content structure with username
            console.log("Final reply content with username:", JSON.stringify(content, null, 2));
            console.log("Username being used:", displayUsername);

            // Ensure the user link has the correct text content
            if (content[0].children[3].children && content[0].children[3].children[0]) {
              // Force the username to be displayed correctly in the text
              content[0].children[3].children[0].text = displayUsername;
              console.log("Forced username in text content:", displayUsername);
            }

            // Double-check the user link structure
            console.log("User link structure:", JSON.stringify(content[0].children[3], null, 2));

            // Set the reply content
            setReplyContent(content);

            // Always update the current editor value for replies
            // This is crucial for the reply content to appear
            setCurrentEditorValue(content);

            // Also notify parent component about the content change
            if (onContentChange) {
              onContentChange(content);
              console.log("Notified parent component about reply content");
            }

            // Set loading flag to false
            setLoadingReplyContent(false);
            console.log("Reply content loaded successfully");
          }
        }).catch(error => {
          console.error("Error fetching original page for reply:", error);
          setLoadingReplyContent(false);
        });
      });
    }
  }, [isReply, replyToId, onContentChange]);

  // Focus the editor when entering edit mode
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  // Update currentEditorValue when the initialContent prop changes
  useEffect(() => {
    console.log("initialContent changed, checking if we should update editor value", {
      initialContent: !!initialContent,
      isReply,
      replyContent: !!replyContent,
      loadingReplyContent
    });

    if (initialContent) {
      // Always use the initialContent directly if it's provided
      // This ensures the pre-filled attribution text is displayed
      console.log("Setting editor value from initialContent", initialContent);
      setCurrentEditorValue(initialContent);

      // If this is a reply with initialContent, we don't need to fetch the original page
      // and we should store the initialContent as replyContent to protect it
      if (isReply) {
        setReplyContent(initialContent);
        setLoadingReplyContent(false);
        console.log("Stored initialContent as replyContent for protection", initialContent);
      }
    }
  }, [initialContent, isReply]);

  // Position cursor for reply content
  useEffect(() => {
    // Only run this when reply content is available and cursor hasn't been positioned yet
    if (isReply && replyContent && !cursorPositioned.current && editorRef.current) {
      console.log("Attempting to position cursor for reply content");
      // Set cursor positioned flag to prevent multiple positioning attempts
      cursorPositioned.current = true;

      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
          const editor = editorRef.current;

          // Check if the editor has the necessary methods
          if (editor && typeof editor.selection !== 'undefined') {
            // Create a point at the start of the third paragraph (index 2) where "I'm responding..." is
            const point = { path: [2, 0], offset: 0 };

            // Use ReactEditor to focus and select
            try {
              // Focus the editor
              ReactEditor.focus(editor);
              // Set the selection to the third paragraph
              Transforms.select(editor, point);
              console.log('Cursor positioned at third paragraph for reply');
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

    // Validate editor content
    if (!currentEditorValue || !Array.isArray(currentEditorValue) || currentEditorValue.length === 0) {
      console.log("Editor content is invalid");
      return;
    }

    // Clear any title error
    setTitleError(false);

    // Call the provided onSave function with the current editor value
    if (onSave) {
      onSave(currentEditorValue);
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
          placeholder={isReply ? "Title your reply..." : "Enter a title..."}
          autoComplete="off"
          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
          autoFocus={isNewPage}
        />
        {titleError && (
          <p className="text-destructive text-sm mt-1">Title is required</p>
        )}
      </div>

      {/* Add separator line between actions and content */}
      <div className="w-full h-px bg-border dark:bg-border my-4"></div>

      {/* Simple SlateEditor with no nested containers */}
      <SlateEditor
        ref={editorRef}
        initialContent={currentEditorValue}
        onContentChange={handleContentChange}
        onSave={!isSaving ? handleSave : null}
        onDiscard={onCancel}
        onInsert={handleInsertLink}
      />

      {/* Bottom controls section with Public/Private switcher and Save/Cancel buttons */}
      <div className="mt-8 mb-16">
        {/* Responsive layout for controls - public/private on left, save/cancel on right (same row on all devices) */}
        <div className="flex flex-row justify-between items-center gap-4 w-full">
          {/* Public/Private switcher - left aligned */}
          <div className="flex items-center gap-2 bg-background/90 p-2 rounded-lg border border-input">
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

          {/* Save/Cancel buttons - centered on mobile, right aligned on desktop */}
          <div className="flex items-center justify-center md:justify-end gap-2 w-full">
            <Button
              onClick={onCancel}
              variant="outline"
              size="md"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 w-full md:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !title.trim() || !currentEditorValue || currentEditorValue.length === 0}
              variant="default"
              size="md"
              className="w-full md:w-auto"
            >
              {isSaving ? "Saving..." : "Save"}
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
