"use client";
import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../../providers/AuthProvider";
import dynamic from "next/dynamic";

// Import the main editor dynamically to avoid SSR issues
const Editor = dynamic(() => import("./Editor"), { ssr: false });
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { Globe, Lock, Link, MapPin } from "lucide-react";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useSearchParams } from "next/navigation";
import { ReactEditor } from "slate-react";
import { Transforms } from "slate";
import { getUsernameById } from "../utils/userUtils";
import { createReplyAttribution } from "../utils/linkUtils";
import MapEditor from "./MapEditor";

import { toast } from "../ui/use-toast";
import { useFeatureFlag } from "../utils/feature-flags";
import DisabledLinkModal from "../utils/DisabledLinkModal";
import { useClickToEdit } from "../../hooks/useClickToEdit";

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
 * @param {Object} props.clickPosition - Position where user clicked to enter edit mode
 */
const PageEditor = ({
  title,
  setTitle,
  initialContent,
  onContentChange,
  isSaving,
  error,
  isNewPage = false,
  isReply = false,
  replyToId = null,
  clickPosition = null
}) => {
  // Add hydration safety check
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Ensure we're fully hydrated before rendering the editor
    setIsHydrated(true);
  }, []);

  // Initialize editor with initialContent
  const [currentEditorValue, setCurrentEditorValue] = useState(
    initialContent || [{ type: 'paragraph', children: [{ text: '' }] }]
  );

  const { user } = useContext(AuthContext);
  const editorRef = useRef(null);
  const cursorPositioned = useRef(false);
  const searchParams = useSearchParams();

  // Check if map feature is enabled
  const mapFeatureEnabled = useFeatureFlag('map_view', user?.email);

  // Check if link functionality is enabled
  const linkFunctionalityEnabled = useFeatureFlag('link_functionality', user?.email);

  // State for disabled link modal
  const [showDisabledLinkModal, setShowDisabledLinkModal] = useState(false);

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing: true,
    setIsEditing: () => {},
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: null, // Save is handled by the bottom toolbar
    isSaving
  });

  // Use click-to-edit hook for cursor positioning
  useClickToEdit(editorRef.current, clickPosition, true, currentEditorValue);

  // Listen for insert link event from bottom toolbar
  useEffect(() => {
    const handleInsertLinkEvent = () => {
      handleInsertLink();
    };

    window.addEventListener('triggerInsertLink', handleInsertLinkEvent);

    return () => {
      window.removeEventListener('triggerInsertLink', handleInsertLinkEvent);
    };
  }, []);

  // Fetch original page data for reply functionality
  useEffect(() => {
    // Only fetch original page data if we don't already have initialContent
    if (isReply && replyToId && !initialContent) {
      console.log("Fetching original page for reply with ID:", replyToId);

      // Import the database module to get page details
      import('../../firebase/database').then(({ getPageById }) => {
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
                const { app } = await import('../../firebase/config');
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

  // Focus the editor when entering edit mode
  useEffect(() => {
    // Auto-focus the editor for better user experience
    if (editorRef.current && !isReply) {
      editorRef.current.focus();
    }
  }, [isReply]);

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
              // Use our safe wrapper for ReactEditor.focus
              safeReactEditor.focus(editor);

              // Create a point at the start of the second paragraph (index 1)
              const point = { path: [1, 0], offset: 0 };

              // Try to select the point
              Transforms.select(editor, point);
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
    console.log("Content changed:", value);
    setCurrentEditorValue(value);

    if (onContentChange) {
      onContentChange(value);
    }
  };



  // Handle link insertion
  const handleInsertLink = () => {
    console.log("[DEBUG] Insert link button clicked");

    // Check if link functionality is enabled
    if (!linkFunctionalityEnabled) {
      console.log("[DEBUG] Link functionality is disabled, showing modal");
      setShowDisabledLinkModal(true);
      return;
    }

    if (editorRef.current) {
      console.log("[DEBUG] Editor ref exists, attempting to open link editor");

      // Focus the editor first
      try {
        editorRef.current.focus();
        console.log("[DEBUG] Editor focused successfully");
      } catch (focusError) {
        console.error("[DEBUG] Error focusing editor:", focusError);
      }

      // CRITICAL FIX: Try multiple approaches to ensure the link editor appears

      // 1. Try direct method call if available
      if (typeof editorRef.current.setShowLinkEditor === 'function') {
        console.log("[DEBUG] Using direct setShowLinkEditor method");
        editorRef.current.setShowLinkEditor(true);
      }

      // 2. Directly dispatch the custom event to show the link editor
      try {
        const event = new CustomEvent('show-link-editor', {
          detail: {
            position: {
              top: window.innerHeight / 2,
              left: window.innerWidth / 2,
            },
            initialTab: 'page',
            showLinkEditor: true,
            source: 'insert-link-button'
          }
        });
        document.dispatchEvent(event);
        console.log("[DEBUG] Directly dispatched show-link-editor event from button");

        // 3. Force a global event as well
        window.dispatchEvent(new CustomEvent('linkEditorStateChange', {
          detail: {
            showLinkEditor: true
          }
        }));
      } catch (eventError) {
        console.error("[DEBUG] Error dispatching event:", eventError);

        // 4. Fallback to using the openLinkEditor method if available
        if (editorRef.current.openLinkEditor) {
          console.log("[DEBUG] Falling back to openLinkEditor method");
          try {
            // Open the link editor directly without creating a temporary link first
            // Pass "page" as the initial tab to show
            const result = editorRef.current.openLinkEditor("page");
            console.log("[DEBUG] openLinkEditor result:", result);
          } catch (error) {
            console.error("[DEBUG] Error opening link editor:", error);
            toast.error("Could not open link editor. Please try again.");
          }
        } else {
          console.error("[DEBUG] openLinkEditor method not available");
          toast.error("Link insertion is not available. Please try again later.");
        }
      }
    } else {
      console.error("[DEBUG] Editor ref not available");
      toast.error("Editor is not ready. Please try again later.");
    }
  };



  return (
    <div className="editor-container w-full max-w-none">
      {/* Title input for new pages and replies */}
      {(isNewPage || isReply) && (
        <div className="mb-6">
          <input
            type="text"
            value={title || ""}
            onChange={(e) => setTitle && setTitle(e.target.value)}
            placeholder={isReply ? "Type title here..." : "Type title here..."}
            className="w-full text-2xl font-semibold bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground"
            autoFocus={!isReply}
          />
        </div>
      )}

      <div className="w-full max-w-none">
        {isHydrated ? (
          <Editor
            ref={editorRef}
            initialContent={currentEditorValue}
            onChange={handleContentChange}
            placeholder="Start typing..."
            contentType="wiki"
          />
        ) : (
          <div className="w-full min-h-[200px] flex items-center justify-center">
            <div className="loader loader-md"></div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="fixed top-4 right-4 bg-destructive/10 p-4 rounded-md shadow-md">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Disabled Link Modal */}
      <DisabledLinkModal
        isOpen={showDisabledLinkModal}
        onClose={() => setShowDisabledLinkModal(false)}
      />
    </div>
  );
};

export default PageEditor;
