"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../providers/AuthProvider";
import dynamic from "next/dynamic";

// Import the editor as the main editor
const Editor = dynamic(() => import("./Editor"), { ssr: false });
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { getUsernameById } from "../../utils/userUtils";
import { createReplyAttribution } from "../../utils/linkUtils";

import { toast } from "../ui/use-toast";
import { useFeatureFlag } from "../../utils/feature-flags";
import DisabledLinkModal from "../utils/DisabledLinkModal";
import { useClickToEdit } from "../../hooks/useClickToEdit";
import { EditorProvider } from "../layout/UnifiedSidebar";
import ErrorBoundary from "../utils/ErrorBoundary";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Switch } from "../ui/switch";
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext";
import { AlertTriangle, X, Link, Check, Grid3X3 } from "lucide-react";
// Remove Slate-specific types - using simple text format now
import { PageEditorSkeleton } from "../skeletons/PageEditorSkeleton";
import { useAlert } from "../../hooks/useAlert";
import AlertModal from "../utils/AlertModal";

// Remove Slate-specific ReactEditor utilities - no longer needed with SimpleEditor

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
  initialContent?: any; // Changed from SlateContent to any for Editor compatibility
  onContentChange: (content: any) => void; // Changed from SlateContent to any
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
  location?: { lat: number; lng: number } | null;
  setLocation?: (location: { lat: number; lng: number } | null) => void;
  onSave: (content?: any) => void;
  onKeyboardSave?: (content?: any) => void; // Optional keyboard save handler
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
  onKeyboardSave,
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
  // Improved hydration check with error handling
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState(false);

  // Always use Editor - feature flag removed

  useEffect(() => {
    // Enhanced hydration check with error handling
    if (typeof window !== 'undefined') {
      try {
        // Use requestAnimationFrame to ensure we're in a proper browser paint cycle
        requestAnimationFrame(() => {
          setIsHydrated(true);
        });
      } catch (error) {
        console.error('Hydration error in PageEditor:', error);
        setHydrationError(true);
        // Fallback: set hydrated after a delay
        setTimeout(() => {
          setIsHydrated(true);
        }, 100);
      }
    }
  }, []);

  // CRITICAL: Track when content is properly loaded to prevent data loss
  useEffect(() => {
    if (initialContent && Array.isArray(initialContent) && initialContent.length > 0) {
      // Check if content is not just empty paragraph
      const hasRealContent = initialContent.some(item =>
        item.type !== 'paragraph' ||
        (item.children && item.children.some(child => child.text && child.text.trim() !== ''))
      );

      if (hasRealContent || !isNewPage) {
        setContentLoaded(true);
        console.log('PageEditor: Content properly loaded', {
          hasRealContent,
          isNewPage,
          contentLength: initialContent.length
        });
      }
    } else if (isNewPage) {
      // For new pages, empty content is expected
      setContentLoaded(true);
      console.log('PageEditor: New page - empty content is expected');
    }
  }, [initialContent, isNewPage]);

  // Initialize editor with initialContent
  const [currentEditorValue, setCurrentEditorValue] = useState<any>(
    initialContent || [{ type: 'paragraph', children: [{ text: '' }] }]
  );

  // CRITICAL: Track if content has been properly loaded
  const [contentLoaded, setContentLoaded] = useState(false);

  const { user } = useAuth();
  const editorRef = useRef<any>(null);
  const { lineMode, setLineMode } = useLineSettings();

  // Link functionality is now permanently enabled

  // Custom modal hooks
  const { alertState, showError, closeAlert } = useAlert();

  // State for disabled link modal
  const [showDisabledLinkModal, setShowDisabledLinkModal] = useState(false);

  // State for empty lines warning alert
  const [showEmptyLinesAlert, setShowEmptyLinesAlert] = useState(false);
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Create a wrapper function for keyboard save that captures content
  const handleKeyboardSaveWithContent = useCallback(async () => {
    // CRITICAL DATA LOSS PREVENTION: Check if content has loaded before saving
    if (!contentLoaded && !isNewPage) {
      console.warn("🚨 DATA LOSS PREVENTION: Attempting to save before content is loaded");
      const confirmSave = window.confirm(
        "⚠️ WARNING: Content may not be fully loaded yet.\n\n" +
        "Saving now might result in data loss.\n\n" +
        "Are you sure you want to continue?\n\n" +
        "Click 'Cancel' to wait for content to load, or 'OK' to proceed anyway."
      );

      if (!confirmSave) {
        console.log("🛡️ DATA LOSS PREVENTED: User cancelled save while content loading");
        return;
      }
    }

    if (editorRef.current && editorRef.current.getContent) {
      try {
        // Force a blur event to ensure any pending changes are captured
        if (document.activeElement === editorRef.current) {
          editorRef.current.blur();
          // Small delay to let blur event process
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // CRITICAL FIX: Process pending page links BEFORE capturing content
        let currentContent;

        // First, check if there are any pending page links
        let pendingLinks = [];
        try {
          if (editorRef.current && typeof editorRef.current.querySelectorAll === 'function') {
            pendingLinks = editorRef.current.querySelectorAll('.pending-page');
          } else if (editorRef.current && editorRef.current.base && typeof editorRef.current.base.querySelectorAll === 'function') {
            pendingLinks = editorRef.current.base.querySelectorAll('.pending-page');
          } else {
            const editorContainer = document.querySelector('[data-slate-editor="true"]') || document.querySelector('.editor-container');
            if (editorContainer) {
              pendingLinks = editorContainer.querySelectorAll('.pending-page');
            }
          }
        } catch (error) {
          console.warn("🟡 PageEditor: Could not query for pending links (keyboard save):", error);
          pendingLinks = [];
        }
        console.log("🔵 PageEditor: Found pending page links (keyboard save):", pendingLinks.length);

        if (editorRef.current && editorRef.current.processPendingPageLinks) {
          console.log("🔵 PageEditor: Processing pending page links BEFORE keyboard save content capture");
          await editorRef.current.processPendingPageLinks();

          // Wait for DOM updates to complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Check if pending links were processed
          let remainingPendingLinks = [];
          try {
            if (editorRef.current && typeof editorRef.current.querySelectorAll === 'function') {
              remainingPendingLinks = editorRef.current.querySelectorAll('.pending-page');
            } else if (editorRef.current && editorRef.current.base && typeof editorRef.current.base.querySelectorAll === 'function') {
              remainingPendingLinks = editorRef.current.base.querySelectorAll('.pending-page');
            } else {
              const editorContainer = document.querySelector('[data-slate-editor="true"]') || document.querySelector('.editor-container');
              if (editorContainer) {
                remainingPendingLinks = editorContainer.querySelectorAll('.pending-page');
              }
            }
          } catch (error) {
            console.warn("🟡 PageEditor: Could not query for remaining pending links (keyboard save):", error);
            remainingPendingLinks = [];
          }
          console.log("🔵 PageEditor: Remaining pending links after processing (keyboard save):", remainingPendingLinks.length);

          // Capture content AFTER processing pending links
          currentContent = editorRef.current.getContent();
          console.log("🔵 PageEditor: Captured content AFTER processing pending links (keyboard save):", {
            contentType: typeof currentContent,
            isArray: Array.isArray(currentContent),
            length: Array.isArray(currentContent) ? currentContent.length : 0,
            contentLoaded
          });
        } else {
          // Fallback: capture content normally
          currentContent = editorRef.current.getContent();
          console.log("🔵 PageEditor: Keyboard save - captured content normally:", {
            contentType: typeof currentContent,
            isArray: Array.isArray(currentContent),
            length: Array.isArray(currentContent) ? currentContent.length : 0,
            contentLoaded
          });
        }

        // Update the parent component with the current content
        if (onContentChange) {
          onContentChange(currentContent);
          // Wait a bit to ensure the parent state is updated
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Call the appropriate save handler with captured content
        if (onKeyboardSave) {
          onKeyboardSave(currentContent);
        } else {
          onSave(currentContent);
        }
      } catch (error) {
        console.error("🔴 PageEditor: Error capturing content for keyboard save:", error);
        // Fallback to save with current editor value
        if (onKeyboardSave) {
          onKeyboardSave(currentEditorValue);
        } else {
          onSave(currentEditorValue);
        }
      }
    } else {
      console.warn("🟡 PageEditor: Editor ref or getContent method not available for keyboard save");
      // Fallback to save with current editor value
      if (onKeyboardSave) {
        onKeyboardSave(currentEditorValue);
      } else {
        onSave(currentEditorValue);
      }
    }
  }, [editorRef, onContentChange, onKeyboardSave, onSave, currentEditorValue, contentLoaded, isNewPage]);

  // Use keyboard shortcuts
  useKeyboardShortcuts({
    isEditing: true,
    setIsEditing: () => {},
    canEdit: false, // Disable "Enter to edit" in edit mode
    handleSave: handleKeyboardSaveWithContent,
    isSaving
  });

  // Use click-to-edit hook for cursor positioning
  useClickToEdit(editorRef.current, clickPosition, true, currentEditorValue);

  // Remove event listener - using proper EditorProvider prop flow instead

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

  // CRITICAL FIX: Disable auto-focus that interferes with cursor positioning
  // The Editor component handles its own focus internally
  // useEffect(() => {
  //   // DISABLED: This was interfering with cursor positioning
  //   if (editorRef.current && !isReply) {
  //     editorRef.current.focus();
  //   }
  // }, [isReply]);

  // CRITICAL FIX: Disable the useEffect that causes cursor jumping
  // This was causing circular updates when user types → onChange → parent updates →
  // initialContent changes → currentEditorValue updates → cursor jumps
  //
  // The editor should only be initialized once, not updated on every prop change
  // useEffect(() => {
  //   // DISABLED: This was causing cursor jumping during typing
  //   if (initialContent) {
  //     console.log("PageEditor: Updating editor with new content");
  //     setCurrentEditorValue(initialContent);
  //   }
  // }, [initialContent, isReply]);

  // Editor handles cursor positioning internally - no manual positioning needed

  // FIXED: Improved content change handling
  const handleContentChange = (value) => {
    // Remove debug logging to improve performance in production
    if (process.env.NODE_ENV === 'development') {
      console.log("PageEditor: Content changed:", value?.length, "paragraphs");
    }

    // CRITICAL FIX: Update currentEditorValue to ensure save captures latest content
    // The previous "fix" was preventing content updates, causing save to use stale content
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



  // Add global click listener for debugging
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Log ALL clicks to see what's happening
      console.log("🔵 [DEBUG] Click detected on:", {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        textContent: target.textContent?.substring(0, 50),
        closest_button: !!target.closest('button'),
        closest_insert_link: !!target.closest('#page-editor-insert-link-button')
      });

      // Check if this is related to Insert Link
      if (target.closest('#page-editor-insert-link-button') ||
          target.textContent?.includes('Insert Link') ||
          target.closest('button')?.textContent?.includes('Insert Link')) {
        console.log("🔵 [DEBUG] *** INSERT LINK RELATED CLICK ***");
        console.log("🔵 [DEBUG] Click target:", target);
        console.log("🔵 [DEBUG] Target tagName:", target.tagName);
        console.log("🔵 [DEBUG] Target className:", target.className);
        console.log("🔵 [DEBUG] Target textContent:", target.textContent);
        console.log("🔵 [DEBUG] Closest button:", target.closest('button'));
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  // Debug: Log when component renders
  useEffect(() => {
    console.log("🔵 [DEBUG] PageEditor component rendered/updated");
    console.log("🔵 [DEBUG] Link functionality: enabled (permanently)");
    console.log("🔵 [DEBUG] isSaving:", isSaving);

    // Check if button exists in DOM
    setTimeout(() => {
      const button = document.getElementById('page-editor-insert-link-button');
      console.log("🔵 [DEBUG] Insert Link button found in DOM:", !!button);
      if (button) {
        console.log("🔵 [DEBUG] Button disabled:", button.hasAttribute('disabled'));
        console.log("🔵 [DEBUG] Button style:", button.style.cssText);
        console.log("🔵 [DEBUG] Button computed style display:", window.getComputedStyle(button).display);
        console.log("🔵 [DEBUG] Button computed style visibility:", window.getComputedStyle(button).visibility);
        console.log("🔵 [DEBUG] Button computed style pointer-events:", window.getComputedStyle(button).pointerEvents);
      }
    }, 100);
  });

  // Handle link insertion - simplified to match Cmd+K functionality
  const handleInsertLink = () => {
    console.log("🔵 [DEBUG] handleInsertLink called");
    console.log("🔵 [DEBUG] Current timestamp:", new Date().toISOString());

    // Make function available globally for console testing
    if (typeof window !== 'undefined') {
      (window as any).testHandleInsertLink = handleInsertLink;
      (window as any).testEditorRef = editorRef;
    }

    try {
      // Link functionality is now permanently enabled

      console.log("🔵 [DEBUG] Link functionality enabled, checking editor ref");
      console.log("🔵 [DEBUG] editorRef:", editorRef);
      console.log("🔵 [DEBUG] editorRef.current:", editorRef.current);
      console.log("🔵 [DEBUG] editorRef.current exists:", !!editorRef.current);

      // Ensure editor is available
      if (!editorRef.current) {
        console.error("🔴 [DEBUG] Editor ref not available");
        console.log("🔵 [DEBUG] Trying to find editor in DOM...");
        const editorElements = document.querySelectorAll('[contenteditable="true"]');
        console.log("🔵 [DEBUG] Found contenteditable elements:", editorElements.length);
        toast.error("Editor is not ready. Please try again later.");
        return;
      }

      console.log("🔵 [DEBUG] Editor ref available, inspecting editor object");
      console.log("🔵 [DEBUG] Editor ref type:", typeof editorRef.current);
      console.log("🔵 [DEBUG] Editor ref constructor:", editorRef.current.constructor?.name);
      console.log("🔵 [DEBUG] Editor ref tagName:", editorRef.current.tagName);
      console.log("🔵 [DEBUG] Editor ref innerHTML length:", editorRef.current.innerHTML?.length);

      // Get all properties and methods
      const allKeys = [];
      let obj = editorRef.current;
      while (obj && obj !== Object.prototype) {
        allKeys.push(...Object.getOwnPropertyNames(obj));
        obj = Object.getPrototypeOf(obj);
      }
      console.log("🔵 [DEBUG] All available properties/methods:", allKeys.filter(key => !key.startsWith('_')));
      console.log("🔵 [DEBUG] Methods starting with 'open':", allKeys.filter(key => key.toLowerCase().includes('open')));
      console.log("🔵 [DEBUG] Methods containing 'link':", allKeys.filter(key => key.toLowerCase().includes('link')));

      console.log("🔵 [DEBUG] Direct openLinkEditor check:", editorRef.current.openLinkEditor);
      console.log("🔵 [DEBUG] openLinkEditor method type:", typeof editorRef.current.openLinkEditor);

      // Use the same approach as Cmd+K shortcut - directly call openLinkEditor
      if (typeof editorRef.current.openLinkEditor === 'function') {
        console.log("🔵 [DEBUG] openLinkEditor method found, calling it");

        try {
          // Focus the editor first
          console.log("🔵 [DEBUG] Focusing editor...");
          editorRef.current.focus();
          console.log("🔵 [DEBUG] Editor focused");

          // Call openLinkEditor directly - this is exactly what Cmd+K does
          console.log("🔵 [DEBUG] Calling openLinkEditor...");
          const result = editorRef.current.openLinkEditor();
          console.log("🔵 [DEBUG] openLinkEditor result:", result);

          if (!result) {
            console.error("🔴 [DEBUG] openLinkEditor returned false");
            toast.error("Could not open link editor. Please try again.");
          } else {
            console.log("✅ [DEBUG] openLinkEditor succeeded");
          }
        } catch (error) {
          console.error("🔴 [DEBUG] Error calling openLinkEditor:", error);
          console.error("🔴 [DEBUG] Error stack:", error.stack);
          toast.error("Could not open link editor. Please try again.");
        }
      } else {
        console.error("🔴 [DEBUG] openLinkEditor method not available on editor");
        console.log("🔵 [DEBUG] Trying alternative approaches...");

        // Try to find the editor component instance
        if (editorRef.current._reactInternalFiber || editorRef.current._reactInternalInstance) {
          console.log("🔵 [DEBUG] Found React internal instance");
        }

        toast.error("Link insertion is not available. Please try again later.");
      }
    } catch (error) {
      console.error("🔴 [DEBUG] Critical error in handleInsertLink:", error);
      console.error("🔴 [DEBUG] Error stack:", error.stack);
      showError('Link Editor Error', 'Failed to open link editor. Please try again.');
    }
  };



  // Remove debug logging to improve performance and reduce console noise
  // console.log('[PageEditor] EditorProvider props:', {
  //   isPublic,
  //   hasSetIsPublic: !!setIsPublic,
  //   hasLocation: !!location,
  //   hasSetLocation: !!setLocation,
  //   hasOnInsertLink: !!handleInsertLink,
  //   hasOnCancel: !!onCancel,
  //   hasOnSave: !!onSave,
  //   hasOnDelete: !!onDelete,
  //   isSaving,
  //   linkFunctionality: true
  // });

  return (
    <EditorProvider
      isPublic={isPublic}
      setIsPublic={setIsPublic}
      location={location}
      setLocation={setLocation}
      onCancel={onCancel}
      onSave={onSave}
      onDelete={onDelete}
      isSaving={isSaving}
      linkFunctionalityEnabled={true}
    >
      {/* CRITICAL: NO extra containers - match view mode exactly */}
      <div className="editor-container w-full max-w-none">

      {/* CRITICAL: Show loading indicator when content hasn't loaded yet */}
      {!contentLoaded && !isNewPage && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></div>
            <span className="text-sm font-medium">Loading page content...</span>
          </div>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Please wait for content to load before editing to prevent data loss.
          </p>
        </div>
      )}

      <div
        className="w-full max-w-none transition-all duration-200 border border-primary/30 rounded-lg p-4 md:p-6 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 hover:border-primary/40"
      >
        {typeof window !== 'undefined' ? (
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
                      setHydrationError(false);
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
            {/* Editor wrapper - using Editor */}
            <div className="editor-wrapper page-editor-stable box-border">
              <Editor
                key="stable-editor" // CRITICAL: Stable key to prevent re-creation
                ref={editorRef}
                initialContent={currentEditorValue}
                onChange={handleContentChange}
                onEmptyLinesChange={handleEmptyLinesChange}
                placeholder="Start typing..."
                contentType="wiki"
                user={user}
                currentPage={page}
                isEditMode={true}
                isNewPage={isNewPage}
                readOnly={false}
                canEdit={true}
              />
            </div>
          </ErrorBoundary>
        ) : (
          <PageEditorSkeleton
            showTitle={false}
            showToolbar={true}
          />
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

      {/* Page Editor Action Buttons */}
      <div className="mt-8 space-y-4">
        {/* Mobile: Insert Link first, then Save, Cancel, Delete */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-center">

          {/* Insert Link Button - First on mobile and desktop */}
          <Button
            id="page-editor-insert-link-button"
            data-testid="page-editor-insert-link"
            variant="outline"
            size="lg"
            onClick={(e) => {
              console.log("🔵 [DEBUG] ===== INSERT LINK BUTTON CLICKED =====");
              console.log("🔵 [DEBUG] Event target:", e.target);
              console.log("🔵 [DEBUG] Event currentTarget:", e.currentTarget);
              console.log("🔵 [DEBUG] Button ID:", e.currentTarget.id);
              console.log("🔵 [DEBUG] PageEditor Insert Link button clicked - ONLY implementation");
              console.log("🔵 [DEBUG] Link functionality: enabled (permanently)");
              console.log("🔵 [DEBUG] isSaving:", isSaving);
              console.log("🔵 [DEBUG] About to call handleInsertLink from PageEditor");

              // Prevent event bubbling and default behavior
              e.preventDefault();
              e.stopPropagation();

              try {
                handleInsertLink();
                console.log("🔵 [DEBUG] handleInsertLink call completed successfully");
              } catch (error) {
                console.error("🔴 [DEBUG] Error calling handleInsertLink:", error);
              }

              console.log("🔵 [DEBUG] ===== INSERT LINK BUTTON CLICK HANDLER FINISHED =====");
            }}
            disabled={isSaving}
            className="gap-2 w-full md:w-auto rounded-2xl font-medium order-1"
          >
            <Link className="h-5 w-5" />
            <span>Insert Link</span>
          </Button>

          {/* Save Button - Second on mobile and desktop */}
          <Button
            onClick={async () => {
              // CRITICAL FIX: Enhanced content capture before saving
              console.log("🔵 PageEditor: Save button clicked, capturing current content");

              if (editorRef.current && editorRef.current.getContent) {
                try {
                  // Force a blur event to ensure any pending changes are captured
                  if (document.activeElement === editorRef.current) {
                    editorRef.current.blur();
                    // Small delay to let blur event process
                    await new Promise(resolve => setTimeout(resolve, 10));
                  }

                  // CRITICAL FIX: Process pending page links BEFORE capturing content
                  let currentContent;

                  // First, check if there are any pending page links
                  // Note: editorRef.current is a React component, not a DOM element
                  let pendingLinks = [];
                  try {
                    if (editorRef.current && typeof editorRef.current.querySelectorAll === 'function') {
                      pendingLinks = editorRef.current.querySelectorAll('.pending-page');
                    } else if (editorRef.current && editorRef.current.base && typeof editorRef.current.base.querySelectorAll === 'function') {
                      // Try accessing the DOM element through .base property
                      pendingLinks = editorRef.current.base.querySelectorAll('.pending-page');
                    } else {
                      // Fallback: try to find the editor container in the DOM
                      const editorContainer = document.querySelector('[data-slate-editor="true"]') || document.querySelector('.editor-container');
                      if (editorContainer) {
                        pendingLinks = editorContainer.querySelectorAll('.pending-page');
                      }
                    }
                  } catch (error) {
                    console.warn("🟡 PageEditor: Could not query for pending links:", error);
                    pendingLinks = [];
                  }
                  console.log("🔵 PageEditor: Found pending page links:", pendingLinks.length);

                  if (editorRef.current && editorRef.current.processPendingPageLinks) {
                    console.log("🔵 PageEditor: Processing pending page links BEFORE content capture");
                    await editorRef.current.processPendingPageLinks();

                    // Wait for DOM updates to complete
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Check if pending links were processed
                    let remainingPendingLinks = [];
                    try {
                      if (editorRef.current && typeof editorRef.current.querySelectorAll === 'function') {
                        remainingPendingLinks = editorRef.current.querySelectorAll('.pending-page');
                      } else if (editorRef.current && editorRef.current.base && typeof editorRef.current.base.querySelectorAll === 'function') {
                        remainingPendingLinks = editorRef.current.base.querySelectorAll('.pending-page');
                      } else {
                        const editorContainer = document.querySelector('[data-slate-editor="true"]') || document.querySelector('.editor-container');
                        if (editorContainer) {
                          remainingPendingLinks = editorContainer.querySelectorAll('.pending-page');
                        }
                      }
                    } catch (error) {
                      console.warn("🟡 PageEditor: Could not query for remaining pending links:", error);
                      remainingPendingLinks = [];
                    }
                    console.log("🔵 PageEditor: Remaining pending links after processing:", remainingPendingLinks.length);

                    // Capture content AFTER processing pending links
                    currentContent = editorRef.current.getContent();
                    console.log("🔵 PageEditor: Captured content AFTER processing pending links:", {
                      contentType: typeof currentContent,
                      isArray: Array.isArray(currentContent),
                      length: Array.isArray(currentContent) ? currentContent.length : 0,
                      preview: JSON.stringify(currentContent).substring(0, 300)
                    });
                  } else {
                    // Fallback: capture content normally if no pending links processing
                    currentContent = editorRef.current.getContent();
                    console.log("🔵 PageEditor: Captured content normally (no pending links processing):", {
                      contentType: typeof currentContent,
                      isArray: Array.isArray(currentContent),
                      length: Array.isArray(currentContent) ? currentContent.length : 0,
                      firstItem: Array.isArray(currentContent) && currentContent.length > 0 ? currentContent[0] : null
                    });
                  }

                  // Update the parent component with the current content
                  if (onContentChange) {
                    console.log("🔵 PageEditor: Updating parent with captured content");
                    onContentChange(currentContent);

                    // Wait a bit longer to ensure the parent state is updated
                    await new Promise(resolve => setTimeout(resolve, 100));
                  } else {
                    console.warn("🟡 PageEditor: onContentChange not available");
                  }

                  console.log("🔵 PageEditor: Calling onSave with updated content");
                  console.log("🔵 PageEditor: Content being saved:", {
                    contentType: typeof currentContent,
                    isArray: Array.isArray(currentContent),
                    length: Array.isArray(currentContent) ? currentContent.length : 0,
                    preview: JSON.stringify(currentContent).substring(0, 300),
                    fullContent: JSON.stringify(currentContent, null, 2)
                  });
                  onSave(currentContent);
                } catch (error) {
                  console.error("🔴 PageEditor: Error capturing content before save:", error);
                  // Fallback to save with current editor value
                  onSave(currentEditorValue);
                }
              } else {
                console.warn("🟡 PageEditor: Editor ref or getContent method not available");
                console.log("🔵 PageEditor: editorRef.current:", !!editorRef.current);
                console.log("🔵 PageEditor: getContent method:", !!(editorRef.current && editorRef.current.getContent));
                onSave(currentEditorValue);
              }
            }}
            disabled={isSaving}
            size="lg"
            className="gap-2 w-full md:w-auto rounded-2xl font-medium bg-green-600 hover:bg-green-700 text-white order-2"
          >
            {isSaving ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                <span>Save</span>
              </>
            )}
          </Button>

          {/* Cancel Button - Third */}
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={isSaving}
            className="gap-2 w-full md:w-auto rounded-2xl font-medium order-3"
          >
            <X className="h-5 w-5" />
            <span>Cancel</span>
          </Button>

          {/* Delete Button - Fourth (optional - only shown when onDelete is provided) */}
          {onDelete && (
            <Button
              variant="outline"
              size="lg"
              onClick={onDelete}
              disabled={isSaving}
              className="gap-2 w-full md:w-auto rounded-2xl font-medium text-destructive hover:text-destructive hover:bg-destructive/10 order-4"
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Delete</span>
            </Button>
          )}
        </div>


      </div>

      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </EditorProvider>
  );
};

export default PageEditor;
