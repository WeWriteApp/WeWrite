"use client";
import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../providers/AuthProvider";
import dynamic from "next/dynamic";

// Import the main editor dynamically to avoid SSR issues
const Editor = dynamic(() => import("./Editor"), { ssr: false });
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { ReactEditor } from "slate-react";
import { Transforms } from "slate";
import { getUsernameById } from "../../utils/userUtils";
import { createReplyAttribution } from "../../utils/linkUtils";

import { toast } from "../ui/use-toast";
import { useFeatureFlag } from "../../utils/feature-flags";
import DisabledLinkModal from "../utils/DisabledLinkModal";
import { useClickToEdit } from "../../hooks/useClickToEdit";
import EditModeBottomToolbar from "./EditModeBottomToolbar";
import ErrorBoundary from "../utils/ErrorBoundary";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertTriangle, X } from "lucide-react";
import type { SlateContent } from "../../types/database";

// Safely check if ReactEditor methods exist before using them
const safeReactEditor = {
  focus: (editor: any) => {
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
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 */
const isExactDateFormat = (title: string): boolean => {
  if (!title || title.length !== 10) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
};

// Removed SafeSlateWrapper - it was causing more issues than it solved

interface PageEditorProps {
  title: string;
  setTitle: (title: string) => void;
  initialContent?: SlateContent;
  onContentChange: (content: SlateContent) => void;
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
  location?: { lat: number; lng: number } | null;
  setLocation?: (location: { lat: number; lng: number } | null) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: (() => void) | null;
  isSaving: boolean;
  error?: string;
  isNewPage?: boolean;
  isReply?: boolean;
  replyToId?: string | null;
  clickPosition?: { x: number; y: number; clientX: number; clientY: number } | null;
  page?: any;
}

/**
 * PageEditor Component
 *
 * A unified editor component that handles all page editing scenarios:
 * - Creating new pages
 * - Editing existing pages
 * - Creating replies to existing pages
 *
 * This component consolidates all editing logic to eliminate duplication
 * and provide a consistent editing experience across the application.
 */
const PageEditor: React.FC<PageEditorProps> = ({
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
  onDelete = null,
  isSaving,
  error,
  isNewPage = false,
  isReply = false,
  replyToId = null,
  clickPosition = null,
  page = null
}) => {
  // Simplified hydration check
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Simple hydration check - just wait for the browser environment
    if (typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        setIsHydrated(true);
      }, 100); // Much shorter delay

      return () => clearTimeout(timer);
    }
  }, []);

  // Initialize editor with initialContent
  const [currentEditorValue, setCurrentEditorValue] = useState<SlateContent>(
    initialContent || [{ type: 'paragraph', children: [{ text: '' }] }]
  );

  const { user } = useAuth();
  const editorRef = useRef<any>(null);
  const cursorPositioned = useRef<boolean>(false);

  // Check if link functionality is enabled
  const linkFunctionalityEnabled = useFeatureFlag('link_functionality', user?.email);

  // State for disabled link modal
  const [showDisabledLinkModal, setShowDisabledLinkModal] = useState(false);

  // State for empty lines warning alert
  const [showEmptyLinesAlert, setShowEmptyLinesAlert] = useState(false);
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing: true,
    setIsEditing: () => {},
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: onSave, // Enable Cmd+Enter / Ctrl+Enter to save
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

  // Handle empty lines count changes from the editor
  const handleEmptyLinesChange = (count: number) => {
    setEmptyLinesCount(count);

    // Show alert if there are empty lines and it's not already dismissed
    if (count > 0 && !showEmptyLinesAlert) {
      setShowEmptyLinesAlert(true);
    } else if (count === 0) {
      setShowEmptyLinesAlert(false);
    }
  };

  // Handle deleting all empty lines
  const handleDeleteAllEmptyLines = () => {
    if (editorRef.current && editorRef.current.deleteAllEmptyLines) {
      editorRef.current.deleteAllEmptyLines();
      setShowEmptyLinesAlert(false);
      setEmptyLinesCount(0);
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
    <div className="editor-container w-full max-w-none mx-4 md:mx-6 lg:mx-8">

      <div
        className={`w-full max-w-none transition-all duration-200 ${
          !isNewPage
            ? "border border-primary/30 rounded-lg p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 hover:border-primary/40"
            : ""
        }`}
      >
        {isHydrated ? (
          <ErrorBoundary
            name="slate-editor"
            fallback={
              <div className="w-full min-h-[200px] flex flex-col items-center justify-center space-y-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-6">
                <div className="text-red-600 dark:text-red-400 text-center">
                  <h3 className="font-medium text-lg mb-2">Editor Error</h3>
                  <p className="text-sm mb-4">
                    The editor encountered an error. This might be due to a browser compatibility issue or hydration problem.
                  </p>

                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsHydrated(false);
                      setTimeout(() => setIsHydrated(true), 1000);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
                  >
                    Retry Editor
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            }
          >
            {/* Simplified editor wrapper */}
            <div className="slate-editor-wrapper">
              <Editor
                ref={editorRef}
                initialContent={currentEditorValue}
                onChange={handleContentChange}
                onEmptyLinesChange={handleEmptyLinesChange}
                placeholder="Start typing..."
                contentType="wiki"
              />
            </div>
          </ErrorBoundary>
        ) : (
          <div className="w-full min-h-[200px] flex items-center justify-center">
            <div className="loader loader-md"></div>
            <div className="ml-3 text-muted-foreground">
              {isNewPage ? "Initializing new page editor..." : "Loading editor..."}
            </div>
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

      {/* Empty Lines Warning Alert */}
      {showEmptyLinesAlert && emptyLinesCount > 0 && (
        <div className="mb-4">
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div className="flex items-center justify-between w-full">
              <AlertDescription className="flex-1">
                You have {emptyLinesCount} empty line{emptyLinesCount !== 1 ? 's' : ''} that may affect readability. Would you like to remove them?
              </AlertDescription>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  onClick={handleDeleteAllEmptyLines}
                  variant="default"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Delete All Empty Lines
                </Button>
                <Button
                  onClick={() => setShowEmptyLinesAlert(false)}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                  aria-label="Dismiss alert"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* Bottom Toolbar - unified for all editing scenarios */}
      {typeof onSave === 'function' && typeof onCancel === 'function' && (
        <EditModeBottomToolbar
          isPublic={isPublic || false}
          setIsPublic={setIsPublic || (() => {})}
          location={location}
          setLocation={setLocation || (() => {})}
          onInsertLink={handleInsertLink}
          onCancel={onCancel}
          onSave={onSave}
          onDelete={onDelete} // Only passed for existing pages
          isSaving={isSaving}
          linkFunctionalityEnabled={linkFunctionalityEnabled}
        />
      )}
    </div>
  );
};

export default PageEditor;
