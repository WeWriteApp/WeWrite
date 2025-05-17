"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../providers/AuthProvider";
import dynamic from "next/dynamic";

// Import the unified editor dynamically to avoid SSR issues
const UnifiedEditor = dynamic(() => import("./UnifiedEditor"), { ssr: false });
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Globe, Lock, Link, MapPin } from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useSearchParams } from "next/navigation";
import { ReactEditor } from "slate-react";
import { Transforms } from "slate";
import { getUsernameById } from "../utils/userUtils";
import { createReplyAttribution } from "../utils/linkUtils";
import MapEditor from "./MapEditor";

import { toast } from "./ui/use-toast";
import { useFeatureFlag } from "../utils/feature-flags";

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
 * @param {Object} props.location - Location object with lat and lng properties
 * @param {Function} props.setLocation - Function to update the location
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
  location,
  setLocation,
  onSave,
  onCancel,
  isSaving,
  error,
  isNewPage = false,
  isReply = false,
  replyToId = null
}) => {
  // Initialize editor with initialContent
  const [currentEditorValue, setCurrentEditorValue] = useState(
    initialContent || [{ type: 'paragraph', children: [{ text: '' }] }]
  );

  const [titleError, setTitleError] = useState(false);
  const { user } = useContext(AuthContext);
  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const cursorPositioned = useRef(false);
  const searchParams = useSearchParams();

  // Check if map feature is enabled
  const mapFeatureEnabled = useFeatureFlag('map_view', user?.email);

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing: true,
    setIsEditing: () => {},
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: !isSaving ? handleSave : null, // Only allow save when not already saving
    isSaving
  });

  // Listen for custom save event from the editor
  useEffect(() => {
    const handleSaveEvent = () => {
      if (!isSaving) {
        handleSave();
      }
    };

    document.addEventListener('editor-save-requested', handleSaveEvent);

    return () => {
      document.removeEventListener('editor-save-requested', handleSaveEvent);
    };
  }, [isSaving, handleSave]);

  // Fetch original page data for reply functionality
  useEffect(() => {
    // Only fetch original page data if we don't already have initialContent
    if (isReply && replyToId && !initialContent) {
      console.log("Fetching original page for reply with ID:", replyToId);

      // Import the database module to get page details
      import('../firebase/database').then(({ getPageById }) => {
        getPageById(replyToId).then(async (originalPage) => {
          if (originalPage) {
            console.log("Found original page for reply:", originalPage);

            // Get the actual username using the utility function
            let displayUsername = "Missing username";

            // First check if the page object already has a username
            if (originalPage.username && originalPage.username !== "Anonymous" && originalPage.username !== "Missing username") {
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
                    console.log("Using username from RTDB:", displayUsername);
                    console.log(`Found username in RTDB: ${displayUsername}`);
                  } else if (rtdbUserData.displayName) {
                    displayUsername = rtdbUserData.displayName;
                    console.log(`Found displayName in RTDB: ${displayUsername}`);
                  }
                }

                // If still Missing username or Anonymous, try the utility function
                if (displayUsername === "Missing username" || displayUsername === "Anonymous") {
                  try {
                    const utilityUsername = await getUsernameById(originalPage.userId);
                    if (utilityUsername && utilityUsername !== "Anonymous" && utilityUsername !== "Missing username") {
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
                displayUsername = originalPage.username || "Missing username";
              }
            }

            // Ensure we have a valid username
            if ((displayUsername === "Anonymous" || displayUsername === "Missing username") && originalPage.username) {
              displayUsername = originalPage.username;
              console.log("Using username directly from page object:", displayUsername);
            }

            // Make sure we're not using "Anonymous" or "Missing username" if we have a userId
            if ((displayUsername === "Anonymous" || displayUsername === "Missing username") && originalPage.userId && originalPage.userId !== "anonymous") {
              // Use the userId as a fallback to ensure we have a link to the user page
              displayUsername = `User ${originalPage.userId.substring(0, 6)}`;
              console.log("Using userId-based username as fallback:", displayUsername);
            }

            // Create a direct reply content structure with proper attribution
            // using the utility function for consistent structure
            const content = [
              createReplyAttribution({
                pageId: replyToId,
                pageTitle: originalPage.title,
                userId: originalPage.userId,
                username: displayUsername
              })
            ];

            // Log the final content structure with username
            console.log("Final reply content with username:", JSON.stringify(content, null, 2));
            console.log("Username being used:", displayUsername);

            // Double-check the user link structure and force the username to be displayed correctly
            if (content[0].children && content[0].children.length >= 4) {
              const userLink = content[0].children[3];

              // Ensure the user link has all required properties
              if (userLink) {
                userLink.type = "link";
                userLink.isUser = true;
                userLink.className = "user-link";
                userLink.userId = originalPage.userId || "anonymous";
                userLink.url = `/user/${originalPage.userId || "anonymous"}`;

                // Make sure the text content is correct
                if (userLink.children && userLink.children[0]) {
                  userLink.children[0].text = displayUsername;
                  console.log("Forced username in text content:", displayUsername);
                }
              }
            }

            // Double-check the user link structure
            console.log("User link structure:", JSON.stringify(content[0].children[3], null, 2));

            // Always update the current editor value for replies
            // This is crucial for the reply content to appear
            setCurrentEditorValue(content);

            // Also notify parent component about the content change
            if (onContentChange) {
              onContentChange(content);
              console.log("Notified parent component about reply content");
            }

            // Set loading flag to false
            console.log("Reply content loaded successfully");
          }
        }).catch(error => {
          console.error("Error fetching original page for reply:", error);
        });
      });
    }
  }, [isReply, replyToId, onContentChange]);

  // Focus the editor when entering edit mode, but only if not a new page
  useEffect(() => {
    // Only auto-focus the editor if this is not a new page
    // For new pages, we want to focus the title field first
    if (editorRef.current && !isNewPage && !isReply) {
      editorRef.current.focus();
    }
  }, [isNewPage, isReply]);

  // Update currentEditorValue when the initialContent prop changes
  useEffect(() => {
    console.log("initialContent changed, updating editor value", {
      initialContent: !!initialContent,
      isReply
    });

    if (initialContent) {
      // Always use the initialContent directly if it's provided
      // This ensures the pre-filled attribution text is displayed
      console.log("Setting editor value from initialContent", initialContent);
      setCurrentEditorValue(initialContent);
    }
  }, [initialContent, isReply]);

  // Position cursor for reply content - only on initial load
  useEffect(() => {
    // Only run this once when the component mounts and content is available
    if (isReply && !cursorPositioned.current && editorRef.current && currentEditorValue?.length > 0) {
      // Set cursor positioned flag to prevent any future positioning attempts
      cursorPositioned.current = true;

      // Use a timeout to ensure the editor is fully initialized
      const timer = setTimeout(() => {
        try {
          const editor = editorRef.current;

          // Check if the editor has the necessary methods
          if (editor) {
            // Determine the correct paragraph to position cursor at
            // If there's only one paragraph (the attribution), add a new paragraph
            if (currentEditorValue.length === 1) {
              try {
                // Add a new paragraph at the end
                Transforms.insertNodes(
                  editor,
                  { type: 'paragraph', children: [{ text: '' }] },
                  { at: [1] }
                );
              } catch (insertError) {
                console.error('Error inserting new paragraph:', insertError);
              }
            }

            // Now position cursor at the second paragraph (after attribution)
            try {
              // Only focus the editor if the title field is not currently focused
              if (document.activeElement !== titleInputRef.current) {
                // Use our safe wrapper for ReactEditor.focus
                safeReactEditor.focus(editor);

                // Create a point at the start of the second paragraph (index 1)
                const point = { path: [1, 0], offset: 0 };

                // Try to select the point
                Transforms.select(editor, point);
              }
            } catch (selectError) {
              console.error('Error selecting text:', selectError);
            }
          }
        } catch (error) {
          console.error('Error positioning cursor for reply:', error);
        }
      }, 300); // Reduced timeout for better responsiveness

      return () => clearTimeout(timer);
    }
  // Empty dependency array ensures this only runs once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle content changes
  const handleContentChange = (value) => {
    setCurrentEditorValue(value);

    if (onContentChange) {
      onContentChange(value);
    }
  };

  // Handle save with validation
  function handleSave() {
    console.log("handleSave called");

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
      console.log("Editor content is invalid", currentEditorValue);
      return;
    }

    // Clear any title error
    setTitleError(false);

    console.log("Calling onSave with editor content");

    // Call the provided onSave function with the current editor value
    if (onSave) {
      try {
        onSave(currentEditorValue);
      } catch (error) {
        console.error("Error during save:", error);
      }
    } else {
      console.error("onSave function is not defined");
    }
  }

  // Handle link insertion
  const handleInsertLink = () => {
    console.log("[DEBUG] Insert link button clicked");

    if (editorRef.current) {
      console.log("[DEBUG] Editor ref exists, attempting to open link editor");

      // Focus the editor first
      try {
        editorRef.current.focus();
        console.log("[DEBUG] Editor focused successfully");
      } catch (focusError) {
        console.error("[DEBUG] Error focusing editor:", focusError);
      }

      // Use the openLinkEditor method we added to the UnifiedEditor
      if (editorRef.current.openLinkEditor) {
        console.log("[DEBUG] Using openLinkEditor method");
        try {
          // Open the link editor directly without creating a temporary link first
          const result = editorRef.current.openLinkEditor();
          console.log("[DEBUG] openLinkEditor result:", result);

          // Force a custom event to ensure the link editor appears
          setTimeout(() => {
            try {
              const event = new CustomEvent('show-link-editor', {
                detail: {
                  source: 'insert-link-button'
                }
              });
              document.dispatchEvent(event);
              console.log("[DEBUG] Dispatched show-link-editor event from button");
            } catch (eventError) {
              console.error("[DEBUG] Error dispatching event:", eventError);
            }
          }, 50);
        } catch (error) {
          console.error("[DEBUG] Error opening link editor:", error);
          toast.error("Could not open link editor. Please try again.");
        }
      } else {
        console.error("[DEBUG] openLinkEditor method not available");
        toast.error("Link insertion is not available. Please try again later.");
      }
    } else {
      console.error("Editor ref is not available");
      toast.error("Editor is not ready. Please try again.");
    }
  };

  // Auto-resize textarea function with improved stability
  const autoResizeTextarea = (element) => {
    if (!element) return;

    // Store the current scroll position
    const scrollPos = window.scrollY;

    // Get the current computed style to account for padding and borders
    const computedStyle = window.getComputedStyle(element);
    const paddingTop = parseFloat(computedStyle.paddingTop);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);

    // Calculate minimum height based on line height for stability
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const minHeight = Math.max(50, lineHeight + paddingTop + paddingBottom);

    // Set a fixed height temporarily to get accurate scrollHeight
    const previousHeight = element.style.height;
    element.style.height = minHeight + 'px';

    // Get the scroll height (this is the height needed for the content)
    const scrollHeight = element.scrollHeight;

    // Only update if the height actually needs to change by more than 2px
    // This prevents tiny fluctuations that cause layout shifts
    if (Math.abs(parseFloat(previousHeight) - scrollHeight) > 2) {
      element.style.height = scrollHeight + 'px';
    } else if (!previousHeight || previousHeight === 'auto') {
      element.style.height = scrollHeight + 'px';
    } else {
      // Restore previous height if the difference is minimal
      element.style.height = previousHeight;
    }

    // Restore the scroll position to prevent page jumping
    window.scrollTo(window.scrollX, scrollPos);
  };

  // Handle textarea input and resize
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (e.target.value.trim().length > 0) {
      setTitleError(false);
    }
    // Auto-resize the textarea
    autoResizeTextarea(e.target);
  };

  // Track if the title field has been focused by user
  const [titleHasBeenFocused, setTitleHasBeenFocused] = useState(false);

  // Handle focus on title field
  const handleTitleFocus = () => {
    setTitleHasBeenFocused(true);
  };

  // Auto-resize on initial render and when title changes
  useEffect(() => {
    if (titleInputRef.current) {
      autoResizeTextarea(titleInputRef.current);

      // If this is a new page and title hasn't been focused yet, focus the title input
      if (isNewPage && !titleHasBeenFocused) {
        titleInputRef.current.focus();
        setTitleHasBeenFocused(true);
      }
    }
  }, [title, isNewPage, titleHasBeenFocused]);

  return (
    <div className="editor-container" style={{ paddingBottom: '60px' }}>
      <div className="mb-4">
        <div className="relative">
          <textarea
            ref={titleInputRef}
            value={title}
            onChange={handleTitleChange}
            onFocus={handleTitleFocus}
            rows={1}
            className={`w-full mt-1 text-3xl font-semibold bg-background text-foreground border ${
              titleError ? 'border-destructive ring-2 ring-destructive/20' : 'border-input/30 focus:ring-2 focus:ring-primary/20'
            } rounded-lg px-3 py-2 transition-colors break-words overflow-hidden whitespace-normal resize-none`}
            placeholder={isReply ? "Title your reply..." : "Enter a title..."}
            autoComplete="off"
            style={{
              minHeight: '50px', // Ensure minimum height
              position: 'relative',
              zIndex: 10, // Ensure it's above other elements
              transition: 'height 0.1s ease', // Smooth height transition
              height: '50px' // Initial fixed height to prevent layout shift
            }}
          />
        </div>
        {titleError && (
          <p className="text-destructive text-sm mt-1">Title is required</p>
        )}
      </div>

      {/* Add separator line between title and content */}
      <div className="w-full h-px bg-border dark:bg-border my-4"></div>

      <UnifiedEditor
        ref={editorRef}
        initialContent={currentEditorValue}
        onChange={handleContentChange}
        placeholder="Start typing..."
        contentType="wiki"
      />

      {/* Bottom controls section with Public/Private switcher and Save/Cancel buttons */}
      <div className="mt-8 mb-16">
        {/* Responsive layout for controls - public/private on left, save/cancel on right (same row on all devices) */}
        <div className="flex flex-row justify-between items-center gap-4 w-full">
          {/* Left side controls - Public/Private switcher, Insert Link button, and Location */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Public/Private switcher */}
            <div className="flex items-center gap-2 bg-background/90 p-2 rounded-lg border border-input">
              {isPublic ? (
                <Globe className="h-4 w-4 text-green-500" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
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

            {/* Insert Link button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleInsertLink}
                    variant="outline"
                    className="flex items-center gap-1.5 bg-background/90 border-input"
                  >
                    <Link className="h-4 w-4" />
                    <span className="text-sm font-medium">Insert Link</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Insert a link to a page or external site</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Location button - only show if map feature is enabled */}
            {mapFeatureEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <MapEditor
                        location={location}
                        onChange={setLocation}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{location ? 'Edit the location for this page' : 'Add a location to this page'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Save/Cancel buttons - right aligned */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      onClick={() => {
                        console.log("Save button clicked");
                        handleSave();
                      }}
                      disabled={isSaving || !title.trim() || !currentEditorValue || currentEditorValue.length === 0}
                      variant="default"
                      className="min-w-[80px]"
                    >
                      {isSaving ? (
                        <div className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                          <span>Saving...</span>
                        </div>
                      ) : "Save"}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!title.trim() && (
                  <TooltipContent>
                    <p>Add title to save</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
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
