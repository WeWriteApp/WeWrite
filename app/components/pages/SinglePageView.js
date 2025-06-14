// This is a temporary file to fix the issue
"use client";
import React, { useEffect, useState, useContext, useRef, useCallback, useMemo } from "react";
import { TextSelectionProvider } from "../../providers/TextSelectionProvider";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { app } from "../../firebase/config";
import { listenToPageById, getPageVersions } from "../../firebase/database";
import { recordPageView } from "../../firebase/pageViews";
import { trackPageViewWhenReady } from "../../utils/analytics-page-titles";
import PageViewCounter from "./PageViewCounter";
import { initializeNavigationTracking } from "../../utils/navigationTracking";
import { AuthContext } from "../../providers/AuthProvider";
import { DataContext } from "../../providers/DataProvider";

// Removed Slate imports - using simple text rendering now
import PublicLayout from "../layout/PublicLayout";
import PageHeader from "./PageHeader.tsx";
import PageFooter from "./PageFooter";
import SiteFooter from "../layout/SiteFooter";
import TokenPledgeBar from "../payments/TokenPledgeBar";
import RelatedPages from "../features/RelatedPages";
// Import BacklinksSection with dynamic import to avoid SSR issues
const BacklinksSection = dynamic(() => import("../features/BacklinksSection"), { ssr: false });
import Link from "next/link";
import Head from "next/head";
import { Button } from "../ui/button";
// Removed EditorContent import - ReplyEditor was replaced with Editor
import TextView from "../editor/TextView";
import TextViewErrorBoundary from "../editor/TextViewErrorBoundary";
import { PageLoader } from "../ui/page-loader";
import { SmartLoader } from "../ui/smart-loader";
import {
  Loader,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  RefreshCw
} from "lucide-react";
import { ErrorDisplay } from "../ui/error-display";
import { toast } from "../ui/use-toast";
import { RecentPagesContext } from "../../contexts/RecentPagesContext";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { PageProvider } from "../../contexts/PageContext";
import { LineSettingsProvider, useLineSettings } from "../../contexts/LineSettingsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "../ui/command";
import PageEditor from "../editor/PageEditor";
import { saveNewVersion, updateDoc, deletePage } from "../../firebase/database";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../utils/UnsavedChangesDialog";
import { useConfirmation } from "../../hooks/useConfirmation";
import ConfirmationModal from "../utils/ConfirmationModal";
import { useLogging } from "../../providers/LoggingProvider";
import { GroupsContext } from "../../providers/GroupsProvider";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";



// Username handling is now done directly in this component

/**
 * SinglePageView Component
 *
 * This component is responsible for displaying a single page with all its content and interactive elements.
 * It handles:
 * - Loading and displaying page content
 * - Editing functionality for page owners
 * - Page visibility controls (public/private)
 * - Keyboard shortcuts for navigation and editing
 * - Page interactions through the PageFooter component
 *
 * The component uses several context providers:
 * - PageProvider: For sharing page data with child components
 *
 * This component has been refactored to use the PageFooter component which contains
 * the PageActions component for all page interactions, replacing the previous
 * PageInteractionButtons and ActionRow components.
 */
function SinglePageView({ params, initialEditMode = false }) {
  const [page, setPage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorState, setEditorState] = useState([]);
  const [editorError, setEditorError] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [groupName, setGroupName] = useState(null);
  const [groupIsPrivate, setGroupIsPrivate] = useState(false);
  const [hasGroupAccess, setHasGroupAccess] = useState(true);
  const [scrollDirection, setScrollDirection] = useState('none');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [error, setError] = useState(null);
  const [pageFullyRendered, setPageFullyRendered] = useState(false);
  const [title, setTitle] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const [shouldAnimateToEdit, setShouldAnimateToEdit] = useState(false);

  // Additional state for editing functionality (moved from EditPage)
  const [isSaving, setIsSaving] = useState(false);
  const [location, setLocation] = useState(null);
  const [editorContent, setEditorContent] = useState(null);
  const [hasContentChanged, setHasContentChanged] = useState(false);
  const [hasTitleChanged, setHasTitleChanged] = useState(false);
  const [hasVisibilityChanged, setHasVisibilityChanged] = useState(false);
  const [hasLocationChanged, setHasLocationChanged] = useState(false);
  const [titleError, setTitleError] = useState(false);



  const { user } = useContext(AuthContext);
  const groups = useContext(GroupsContext);
  const { recentPages = [], addRecentPage } = useContext(RecentPagesContext) || {};
  const { lineMode } = useLineSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contentRef = useRef(null);
  const { logError } = useLogging();
  const { trackEditingFlow, trackContentEvent, events } = useWeWriteAnalytics();

  // Use confirmation modal hook for delete functionality
  const { confirmationState, confirmDelete, closeConfirmation } = useConfirmation();

  // Handle title changes from inline editing
  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    setHasTitleChanged(true);

    // Clear title error when user starts typing
    if (titleError && newTitle && newTitle.trim() !== '') {
      setTitleError(false);
      setError(null);
    }
  };

  // Handle content changes from editor
  const handleContentChange = (content) => {
    setEditorContent(content);
    setHasContentChanged(true);
  };

  // Handle visibility changes
  const handleVisibilityChange = (newIsPublic) => {
    setIsPublic(newIsPublic);
    setHasVisibilityChanged(true);
  };

  // Handle location changes
  const handleLocationChange = (newLocation) => {
    setLocation(newLocation);
    setHasLocationChanged(true);
  };

  // Handle save action - comprehensive save logic moved from EditPage
  const handleSave = useCallback(async (inputContent, saveMethod = 'button') => {
    console.log("SinglePageView handleSave called with content:", {
      contentType: typeof inputContent,
      isArray: Array.isArray(inputContent),
      length: Array.isArray(inputContent) ? inputContent.length : 0
    });

    if (!user) {
      setError("User not authenticated");
      return false;
    }

    if (!page) {
      setError("Page data not available");
      return false;
    }

    // CRITICAL FIX: Add title validation
    if (!title || title.trim() === '') {
      setError("Please add a title before saving");
      setTitleError(true);
      setIsSaving(false);
      return false;
    }

    // Clear title error if title is valid
    setTitleError(false);
    setIsSaving(true);
    setError(null);

    // Track save attempt
    trackEditingFlow.saved(params.id, saveMethod, {
      page_title: title,
      has_content_changes: hasContentChanged,
      has_title_changes: hasTitleChanged,
      has_visibility_changes: hasVisibilityChanged,
      has_location_changes: hasLocationChanged
    });

    try {
      // Use the provided content or fall back to current editor content
      const finalContent = inputContent || editorContent || editorState;

      if (!finalContent || !Array.isArray(finalContent)) {
        throw new Error("Invalid content format");
      }

      // Convert content to JSON string for storage
      const editorStateJSON = JSON.stringify(finalContent);
      console.log("Saving content:", editorStateJSON.substring(0, 100) + "...");

      // Check if content has actually changed by comparing with the original content
      let contentChanged = true;
      if (page.content) {
        try {
          const originalContent = typeof page.content === 'string'
            ? page.content
            : JSON.stringify(page.content);
          contentChanged = originalContent !== editorStateJSON;
          console.log('Content comparison:', {
            originalLength: originalContent.length,
            newLength: editorStateJSON.length,
            changed: contentChanged
          });
        } catch (e) {
          console.error('Error comparing content:', e);
          contentChanged = true;
        }
      }

      // Update the page document first
      const updateTime = new Date().toISOString();
      console.log(`Updating page ${page.id} with new metadata and content`);

      await updateDoc("pages", page.id, {
        title: title,
        isPublic: isPublic,
        groupId: groupId,
        location: location,
        lastModified: updateTime,
        content: editorStateJSON
      });

      console.log('Page metadata and content updated successfully');

      // Only create a new version if content actually changed
      if (contentChanged) {
        try {
          const result = await saveNewVersion(page.id, {
            content: editorStateJSON,
            userId: user.uid,
            username: user.displayName || user.username,
            skipIfUnchanged: true
          });

          if (result && result.success) {
            console.log('New version created successfully:', result.versionId);
          } else {
            console.log('Version creation skipped (no changes) or failed');
          }
        } catch (versionError) {
          console.error('Error creating new version:', versionError);
          // Don't fail the entire save if version creation fails
        }
      } else {
        console.log('Content unchanged, skipping version creation');
      }

      // Reset all change tracking states
      setHasContentChanged(false);
      setHasTitleChanged(false);
      setHasVisibilityChanged(false);
      setHasLocationChanged(false);
      setIsSaving(false);
      setError(null);

      // Trigger page updated event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('page-updated', {
          detail: { pageId: page.id }
        }));
      }

      // Exit edit mode after successful save
      setTimeout(() => {
        handleSetIsEditing(false);
      }, 300);

      return true;

    } catch (error) {
      console.error("Error saving page:", error);
      setError(`Failed to save: ${error.message}`);
      setIsSaving(false);
      logError(error, { context: 'SinglePageView.handleSave', pageId: page?.id });
      return false;
    }
  }, [user, page, editorContent, editorState, title, isPublic, groupId, location, logError]);

  // Handle cancel action
  const handleCancel = () => {
    // Track cancellation if there were unsaved changes
    if (hasContentChanged || hasTitleChanged || hasVisibilityChanged || hasLocationChanged) {
      trackEditingFlow.cancelled(params.id, {
        page_title: title,
        had_content_changes: hasContentChanged,
        had_title_changes: hasTitleChanged,
        had_visibility_changes: hasVisibilityChanged,
        had_location_changes: hasLocationChanged
      });
    }

    handleSetIsEditing(false);
    setHasContentChanged(false);
    setHasTitleChanged(false);
    setHasVisibilityChanged(false);
    setHasLocationChanged(false);
    setClickPosition(null);
  };

  // Enhanced setIsEditing function that captures click position and handles URL changes
  const handleSetIsEditing = (editing, position = null) => {
    setIsEditing(editing);
    if (editing && position) {
      setClickPosition(position);
      // Track edit mode entry
      trackEditingFlow.started(params.id, {
        page_title: page?.title,
        is_public: page?.isPublic,
        has_group: !!page?.groupId,
        click_position: position ? 'click' : 'keyboard'
      });
    } else if (!editing) {
      setClickPosition(null); // Clear position when exiting edit mode
    }

    // Handle URL changes for edit mode
    if (editing) {
      // Enter edit mode - update URL to /[id]/edit
      router.push(`/${params.id}/edit`, { scroll: false });
    } else {
      // Exit edit mode - return to normal page view
      router.push(`/${params.id}`, { scroll: false });
    }
  };

  // Handle delete action
  const handleDelete = async () => {
    if (!page) return;

    // Use the correct confirmDelete API - it expects just the item name
    const confirmed = await confirmDelete(`"${page.title || 'this page'}"`);

    if (confirmed) {
      try {
        // Set deleting state to prevent listener from processing "not found" errors
        setIsDeleted(true);

        // CRITICAL FIX: Delete the page first, then redirect
        // This prevents 404 errors and ensures proper cleanup
        await deletePage(page.id);

        // Track successful deletion
        trackContentEvent(events.PAGE_DELETED, {
          page_id: page.id,
          page_title: page.title,
          was_public: page.isPublic,
          had_group: !!page.groupId
        });

        // Show success message
        toast.success("Page deleted successfully");

        // Trigger success event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('page-deleted', {
            detail: { pageId: page.id }
          }));
        }

        // Redirect after successful deletion with a small delay
        setTimeout(() => {
          // Use replace to prevent back button issues
          router.replace('/');
        }, 500);

      } catch (error) {
        console.error("Error deleting page:", error);
        // Reset deleted state if deletion failed
        setIsDeleted(false);
        const errorMessage = `Failed to delete page: ${error.message}`;
        setError(errorMessage);
        toast.error("Failed to delete page");
        logError(error, { context: 'SinglePageView.handleDelete', pageId: page.id });
      }
    }
  };

  // Handle insert link action from bottom toolbar
  const handleInsertLink = () => {
    // Trigger insert link in PageEditor component
    const insertLinkEvent = new CustomEvent('triggerInsertLink');
    window.dispatchEvent(insertLinkEvent);
  };

  // Track if there are any unsaved changes
  const hasUnsavedChangesComputed = hasContentChanged || hasTitleChanged || hasVisibilityChanged || hasLocationChanged;

  // Update the main hasUnsavedChanges state when computed value changes
  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChangesComputed);
  }, [hasUnsavedChangesComputed]);

  // Initialize page-specific state when page loads
  useEffect(() => {
    if (page) {
      setLocation(page.location || null);
      setGroupId(page.groupId || null);
    }
  }, [page]);

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave(editorContent || editorState, 'button');
  }, [editorContent, editorState, handleSave]);

  // Keyboard save handler
  const handleKeyboardSave = useCallback(() => {
    return handleSave(editorContent || editorState, 'keyboard');
  }, [editorContent, editorState, handleSave]);

  // Use the unsaved changes hook
  const {
    showUnsavedChangesDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasUnsavedChangesComputed, saveChanges);

  // Override the cancel handler to check for unsaved changes
  const handleCancelWithCheck = () => {
    const returnUrl = page && page.id ? `/${page.id}` : '/';
    console.log('[DEBUG] SinglePageView - handleCancelWithCheck called, returnUrl:', returnUrl);

    if (hasUnsavedChangesComputed) {
      handleNavigation(returnUrl);
    } else {
      handleCancel();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Determine scroll direction
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }

      // Update last scroll position
      setLastScrollY(currentScrollY);

      // Set scrolled state
      setIsScrolled(currentScrollY > 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // Use keyboard shortcuts - moved back to top level
  useKeyboardShortcuts({
    isEditing,
    setIsEditing: handleSetIsEditing,
    // Only allow editing if:
    // 1. Page is loaded (!isLoading)
    // 2. Page exists (page !== null)
    // 3. Page isn't deleted (!isDeleted)
    // 4. User owns the page OR is a member of the group that owns the page
    canEdit: Boolean(
      !isLoading &&
      page !== null &&
      !isDeleted &&
      user?.uid &&
      (
        // User is the page owner
        (page?.userId && user.uid === page.userId) ||
        // OR page belongs to a group and user is a member of that group
        (page?.groupId && hasGroupAccess)
      )
    ),
    handleSave: isEditing ? handleKeyboardSave : null
  });

  // Use a ref to track if we've already recorded a view for this page
  const viewRecorded = useRef(false);

  // Record page view once when the page has loaded
  useEffect(() => {
    // Only proceed if we haven't recorded a view yet, the page is loaded, public, and we have the data
    if (!viewRecorded.current && !isLoading && page && isPublic) {
      // Mark that we've recorded the view to prevent duplicate recordings
      viewRecorded.current = true;

      // Record the page view in our database
      recordPageView(params.id, user?.uid);
      console.log('Recording page view for', params.id);

      // Track the page view in Google Analytics with our improved tracking
      // This will wait until the page title and username/group are fully loaded
      if (page.title) {
        // If we already have a title, use it as a starting point
        let initialTitle;

        // Format title based on whether the page belongs to a group
        if (page.groupId && page.groupName) {
          initialTitle = `Page: ${page.title} in ${page.groupName}`;
        } else if (page.username) {
          initialTitle = `Page: ${page.title} by ${page.username}`;
        } else {
          initialTitle = `Page: ${page.title}`;
        }

        trackPageViewWhenReady(params.id, initialTitle);
      } else {
        // If we don't have a title yet, let the tracking function handle it
        trackPageViewWhenReady(params.id);
      }
    }
  }, [params.id, isLoading, page, isPublic, user?.uid]);

  // Add a timeout ref to prevent infinite loading
  const loadingTimeoutRef = useRef(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const maxLoadAttempts = 3;

  useEffect(() => {
    if (params.id) {
      setIsLoading(true);
      setLoadingTimedOut(false);

      // SCROLL RESTORATION: Let the scroll restoration hooks handle this
      // Removed immediate scroll to prevent scrolling current page before navigation

      // CRITICAL FIX: Initialize navigation tracking for "What Links Here"
      // This tracks when users navigate from one page to another
      initializeNavigationTracking();

      // Set a timeout to prevent infinite loading
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Shorter timeout for subsequent attempts
      // First load should be very quick to prevent blank page on initial load
      const timeoutDuration = loadAttempts === 0 ? 5000 : 10000; // 5s first try, 10s for retries

      loadingTimeoutRef.current = setTimeout(() => {
        console.warn(`SinglePageView: Loading timeout reached (attempt ${loadAttempts + 1}/${maxLoadAttempts}), forcing completion`);

        if (loadAttempts < maxLoadAttempts - 1) {
          // Try again with a shorter timeout
          setLoadAttempts(prev => prev + 1);
          // Keep loading state true to trigger this effect again
        } else {
          // Max attempts reached, give up and show error state
          setIsLoading(false);
          setLoadingTimedOut(true);
          console.error("SinglePageView: Max load attempts reached, giving up");
        }
      }, timeoutDuration);

      // Make sure we pass the user ID to the listenToPageById function
      const currentUserId = user?.uid || null;
      console.log(`Setting up page listener with user ID: ${currentUserId || 'anonymous'} (attempt ${loadAttempts + 1}/${maxLoadAttempts})`);

      const unsubscribe = listenToPageById(params.id, async (data) => {
        // Clear the timeout since we got a response
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }

        // Reset the timeout flag and load attempts if we got a successful response
        setLoadingTimedOut(false);
        setLoadAttempts(0);

        // Log the received data for debugging
        console.log("SinglePageView: Data received from listenToPageById", {
          hasError: !!data.error,
          hasPageData: !!data.pageData,
          hasVersionData: !!data.versionData,
          timestamp: new Date().toISOString()
        });

        // Force a re-render to ensure the page content is displayed
        window.requestAnimationFrame(() => {
          console.log("SinglePageView: Forcing re-render after data received");
        });

        if (data.error) {
          console.error("SinglePageView: Error loading page:", data.error);
          // Don't show error if page is being deleted - user is already redirected
          if (!isDeleted) {
            setError(data.error);
          }
          setIsLoading(false);
          return;
        }

        let pageData = data.pageData || data;

        // Make sure pageData has a username
        if (!pageData.username) {
          pageData.username = "Anonymous";
        }

        setPage(pageData);
        setIsPublic(pageData.isPublic || false);

        // Check if the page belongs to a group
        if (pageData.groupId) {
          setGroupId(pageData.groupId);

          // If groupName is already in the page data, use it
          if (pageData.groupName) {
            setGroupName(pageData.groupName);
          } else {
            // Otherwise, fetch the group name from the database
            const db = getDatabase(app);
            const groupRef = ref(db, `groups/${pageData.groupId}`);

            onValue(groupRef, (snapshot) => {
              if (snapshot.exists()) {
                const groupData = snapshot.val();
                setGroupName(groupData.name);

                // Check if the group is private
                setGroupIsPrivate(!groupData.isPublic);

                // Check if the user is a member of the group
                const isMember = user?.uid && groupData.members && groupData.members[user.uid];
                setHasGroupAccess(isMember);
              } else {
                // Group doesn't exist
                setGroupName(null);
                setGroupIsPrivate(false);
                setHasGroupAccess(false);
              }
            }, {
              onlyOnce: true
            });
          }
        } else {
          // Reset group state if the page doesn't belong to a group
          setGroupId(null);
          setGroupName(null);
          setGroupIsPrivate(false);
          setHasGroupAccess(false);
        }

        // Set page title for document title
        if (pageData.title) {
          // If the page has a title of "Untitled", add a more descriptive suffix
          if (pageData.title === "Untitled") {
            setTitle(`Untitled (${pageData.id.substring(0, 6)})`);
          } else {
            setTitle(pageData.title);
          }

          // If the page is already marked as viewed, update analytics with the better title
          if (viewRecorded.current && isPublic) {
            // Track with improved title now that we have it
            let analyticsTitle;

            // Format title based on whether the page belongs to a group
            if (pageData.groupId && pageData.groupName) {
              analyticsTitle = `Page: ${pageData.title} in ${pageData.groupName}`;
            } else if (pageData.username) {
              analyticsTitle = `Page: ${pageData.title} by ${pageData.username}`;
            } else {
              analyticsTitle = `Page: ${pageData.title}`;
            }

            trackPageViewWhenReady(params.id, analyticsTitle);
          }
        }

        if (data.versionData) {
          try {
            const contentString = data.versionData.content;
            console.log("SinglePageView: Received content update", {
              contentLength: contentString ? contentString.length : 0,
              isString: typeof contentString === 'string',
              contentSample: typeof contentString === 'string' ? contentString.substring(0, 50) + '...' : 'not a string',
              timestamp: new Date().toISOString()
            });

            let parsedContent;

            // Handle different content formats
            if (typeof contentString === 'string') {
              try {
                // Check if content is already parsed (double parsing issue)
                if (contentString.startsWith('[{"type":"paragraph"') || contentString.startsWith('[{\\\"type\\\":\\\"paragraph\\\"')) {
                  parsedContent = JSON.parse(contentString);
                  console.log("SinglePageView: Successfully parsed string content");
                } else {
                  // Content might be double-stringified, try to parse twice
                  try {
                    const firstParse = JSON.parse(contentString);
                    if (typeof firstParse === 'string' &&
                        (firstParse.startsWith('[{"type":"paragraph"') ||
                         firstParse.startsWith('[{\\\"type\\\":\\\"paragraph\\\"'))) {
                      parsedContent = JSON.parse(firstParse);
                      console.log("SinglePageView: Successfully parsed double-stringified content");
                    } else {
                      parsedContent = firstParse;
                      console.log("SinglePageView: Using first-level parsed content");
                    }
                  } catch (doubleParseError) {
                    console.error("SinglePageView: Error parsing potentially double-stringified content:", doubleParseError);
                    // Fall back to original parsing
                    parsedContent = JSON.parse(contentString);
                  }
                }
              } catch (parseError) {
                console.error("SinglePageView: Error parsing string content:", parseError);
                console.error("SinglePageView: Content that failed to parse:", contentString?.substring(0, 200) + "...");

                // Create a more helpful fallback content structure
                parsedContent = [{
                  type: "paragraph",
                  children: [{ text: "Unable to load page content. The page data may be corrupted. Try refreshing the page, and if the problem persists, contact support." }]
                }];
              }
            } else if (Array.isArray(contentString)) {
              // Content is already an array, use it directly
              parsedContent = contentString;
              console.log("SinglePageView: Using array content directly");
            } else if (contentString && typeof contentString === 'object') {
              // Content is an object, convert to array if needed
              parsedContent = [contentString];
              console.log("SinglePageView: Converted object content to array");
            } else {
              // Fallback for null or undefined content
              parsedContent = [{
                type: "paragraph",
                children: [{ text: "No content available." }]
              }];
              console.log("SinglePageView: Using fallback empty content");
            }

            // Ensure content is an array
            if (!Array.isArray(parsedContent)) {
              parsedContent = parsedContent ? [parsedContent] : [];
            }

            // Deduplicate content items that might be duplicated in development environment
            if (parsedContent.length > 0) {
              const uniqueItems = [];
              const seen = new Set();

              parsedContent.forEach(item => {
                // Create a simple hash of the item to detect duplicates
                const itemHash = JSON.stringify(item);
                if (!seen.has(itemHash)) {
                  seen.add(itemHash);
                  uniqueItems.push(item);
                } else {
                  console.log("SinglePageView: Filtered out duplicate content item");
                }
              });

              parsedContent = uniqueItems;
            }

            // Update editor state without comparing to avoid circular dependencies
            console.log("SinglePageView: Updating editor state with new content, items:", parsedContent.length);
            setEditorState(parsedContent);
            setEditorError(null); // Clear any previous errors
          } catch (error) {
            console.error("SinglePageView: Error processing content:", error);
            console.error("SinglePageView: Content processing error details:", {
              pageId: params.id,
              contentType: typeof data.versionData?.content,
              hasVersionData: !!data.versionData,
              errorMessage: error.message,
              errorStack: error.stack
            });
            setEditorError("Unable to load page content. This may be due to corrupted data or a temporary issue. Please try refreshing the page.");
          }
        }

        setIsLoading(false);
      }, currentUserId); // Pass the user ID here

      return () => {
        // Clean up the listener when the component unmounts
        unsubscribe();

        // Clear the timeout if it exists
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }

        // Reset state to prevent memory leaks
        setIsLoading(false);
        setLoadingTimedOut(false);
        setLoadAttempts(0);
      };
    }
  }, [params.id, user?.uid, loadAttempts]); // Added loadAttempts to dependencies to trigger retries

  // Handle initial edit mode from URL or initialEditMode prop
  useEffect(() => {
    if (!isLoading && page && user) {
      // Check if user has edit permissions
      const canEdit = user.uid === page.userId || (page.groupId && hasGroupAccess);

      if (canEdit) {
        // Check for edit=true URL parameter (legacy support)
        if (searchParams && searchParams.get('edit') === 'true') {
          console.log('Setting edit mode from URL parameter');
          setIsEditing(true);
        }
        // Check for initialEditMode prop (from /[id]/edit route)
        else if (initialEditMode) {
          console.log('Setting edit mode from initialEditMode prop');
          // Use animation for smooth transition from normal view to edit mode
          setShouldAnimateToEdit(true);
          setTimeout(() => {
            setIsEditing(true);
            setShouldAnimateToEdit(false);
          }, 100); // Small delay to ensure page is rendered first
        }
      } else {
        console.log('User does not have edit permissions for this page');
        // If user doesn't have permissions and they're on edit URL, redirect to normal view
        if (initialEditMode) {
          router.replace(`/${params.id}`);
        }
      }
    }
  }, [searchParams, isLoading, page, user, hasGroupAccess, initialEditMode, params.id, router]);

  // Handle browser back button navigation
  useEffect(() => {
    const handlePopState = (event) => {
      // Check if we're navigating away from edit mode
      if (isEditing && !window.location.pathname.includes('/edit')) {
        setIsEditing(false);
        setClickPosition(null);
      }
      // Check if we're navigating to edit mode
      else if (!isEditing && window.location.pathname.includes('/edit')) {
        if (user && page && (user.uid === page.userId || (page.groupId && hasGroupAccess))) {
          setIsEditing(true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditing, user, page, hasGroupAccess]);



  // Listen for page-updated events to refresh the page data
  useEffect(() => {
    const handlePageUpdated = (event) => {
      // Only refresh if this is the page that was updated
      if (event.detail && event.detail.pageId === params.id) {
        console.log('Page updated event received, refreshing page data');

        // CRITICAL FIX: Don't set isLoading to true here, as it causes a flash of loading state
        // when switching from edit to view mode
        // setIsLoading(true);

        listenToPageById(params.id, (data) => {
          if (data.error) {
            // Don't show error if page is being deleted - user is already redirected
            if (!isDeleted) {
              setError(data.error);
            }
          } else {
            setPage(data.pageData || data);

            // Update editor state with the new content
            try {
              // CRITICAL FIX: Prioritize content from versionData which is more reliable
              const content = data.versionData?.content || data.pageData?.content || data.content;
              if (content) {
                console.log('SinglePageView: Updating editor state with content from page-updated event', {
                  contentLength: content ? (typeof content === 'string' ? content.length : Array.isArray(content) ? content.length : 'unknown') : 0,
                  contentType: typeof content
                });

                let parsedContent;

                // Handle different content formats
                if (typeof content === 'string') {
                  try {
                    // Check if content is already parsed (double parsing issue)
                    if (content.startsWith('[{"type":"paragraph"') || content.startsWith('[{\\\"type\\\":\\\"paragraph\\\"')) {
                      parsedContent = JSON.parse(content);
                      console.log("SinglePageView: Successfully parsed string content from event");
                    } else {
                      // Content might be double-stringified, try to parse twice
                      try {
                        const firstParse = JSON.parse(content);
                        if (typeof firstParse === 'string' &&
                            (firstParse.startsWith('[{"type":"paragraph"') ||
                             firstParse.startsWith('[{\\\"type\\\":\\\"paragraph\\\"'))) {
                          parsedContent = JSON.parse(firstParse);
                          console.log("SinglePageView: Successfully parsed double-stringified content from event");
                        } else {
                          parsedContent = firstParse;
                          console.log("SinglePageView: Using first-level parsed content from event");
                        }
                      } catch (doubleParseError) {
                        console.error("SinglePageView: Error parsing potentially double-stringified content from event:", doubleParseError);
                        // Fall back to original parsing
                        parsedContent = JSON.parse(content);
                      }
                    }
                  } catch (parseError) {
                    console.error("SinglePageView: Error parsing string content from event:", parseError);
                    // Create a fallback content structure with the error message
                    parsedContent = [{
                      type: "paragraph",
                      children: [{ text: "Error loading content. Please try refreshing the page." }]
                    }];
                  }
                } else if (Array.isArray(content)) {
                  // Content is already an array, use it directly
                  parsedContent = content;
                  console.log("SinglePageView: Using array content directly from event");
                } else if (content && typeof content === 'object') {
                  // Content is an object, convert to array if needed
                  parsedContent = [content];
                  console.log("SinglePageView: Converted object content to array from event");
                } else {
                  // Fallback for null or undefined content
                  parsedContent = [{
                    type: "paragraph",
                    children: [{ text: "No content available." }]
                  }];
                  console.log("SinglePageView: Using fallback empty content from event");
                }

                // Ensure content is an array
                if (!Array.isArray(parsedContent)) {
                  parsedContent = parsedContent ? [parsedContent] : [];
                }

                // Deduplicate content items that might be duplicated in development environment
                if (parsedContent.length > 0) {
                  const uniqueItems = [];
                  const seen = new Set();

                  parsedContent.forEach(item => {
                    // Create a simple hash of the item to detect duplicates
                    const itemHash = JSON.stringify(item);
                    if (!seen.has(itemHash)) {
                      seen.add(itemHash);
                      uniqueItems.push(item);
                    } else {
                      console.log("SinglePageView: Filtered out duplicate content item from event");
                    }
                  });

                  parsedContent = uniqueItems;
                }

                setEditorState(parsedContent);

                // Force a re-render to ensure the content is displayed
                window.requestAnimationFrame(() => {
                  console.log("SinglePageView: Forcing re-render after content update from event");
                });
              }
            } catch (error) {
              console.error('SinglePageView: Error parsing updated content from event:', error);
            }
          }
          // setIsLoading(false);
        }, user?.uid || null);
      }
    };

    // Add event listener
    if (typeof window !== 'undefined') {
      window.addEventListener('page-updated', handlePageUpdated);
    }

    // Clean up
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('page-updated', handlePageUpdated);
      }
    };
  }, [params.id, user]);

  useEffect(() => {
    if (page && addRecentPage && Array.isArray(recentPages)) {
      try {
        // Only add to recent pages if it doesn't already exist in the list
        const pageExists = recentPages.some(p => p && p.id === page.id);
        if (!pageExists) {
          addRecentPage(page);
        }
      } catch (error) {
        console.error("Error adding page to recent pages:", error);
        // Don't throw error to prevent app from crashing
      }
    }
  }, [page, addRecentPage, recentPages]);

  // Removed duplicate useEffect for parsing page content
  // Content is already handled by the listenToPageById callback

  useEffect(() => {
    if (page && page.id && user) {
      // Track this page as recently visited
      try {
        const recentlyVisitedStr = localStorage.getItem('recentlyVisitedPages');
        let recentlyVisited = recentlyVisitedStr ? JSON.parse(recentlyVisitedStr) : [];

        // Remove this page ID if it already exists in the list
        recentlyVisited = recentlyVisited.filter(id => id !== page.id);

        // Add this page ID to the beginning of the list
        recentlyVisited.unshift(page.id);

        // Keep only the most recent 10 pages
        recentlyVisited = recentlyVisited.slice(0, 10);

        // Save back to localStorage
        localStorage.setItem('recentlyVisitedPages', JSON.stringify(recentlyVisited));
      } catch (error) {
        console.error("Error updating recently visited pages:", error);
      }
    }
  }, [page, user]);



  // Function to extract linked page IDs from content
  // Memoize this function to prevent recalculation on every render
  const extractLinkedPageIds = useCallback((content) => {
    if (!content || !Array.isArray(content)) return [];

    const linkedIds = new Set();

    // Recursive function to traverse nodes and find links
    const traverseNodes = (node) => {
      // Check if the node is a link
      if (node.type === 'link' && node.url) {
        // Check if it's an internal page link
        if (node.url.startsWith('/') || node.url.startsWith('/pages/')) {
          // Extract the page ID from the URL
          const pageId = node.url.replace('/pages/', '').replace('/', '');
          if (pageId && pageId !== params.id) { // Don't include self-links
            linkedIds.add(pageId);
          }
        }
      }

      // Recursively check children if they exist
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverseNodes);
      }
    };

    // Start traversal on each top-level node
    content.forEach(traverseNodes);

    return Array.from(linkedIds);
  }, [params.id]);

  // Function to handle when page content is fully rendered
  const handlePageFullyRendered = () => {
    setPageFullyRendered(true);
  };

  // Pre-compute memoized values for RelatedPages component to avoid hooks order issues
  const memoizedPage = useMemo(() => pageFullyRendered ? page : null, [pageFullyRendered, page]);
  const memoizedLinkedPageIds = useMemo(() =>
    pageFullyRendered ? extractLinkedPageIds(editorState) : [],
    [pageFullyRendered, editorState]
  );

  const Layout = user ? React.Fragment : PublicLayout;

  // If the page is deleted, use NotFoundWrapper
  if (isDeleted) {
    const NotFoundWrapper = dynamic(() => import('../../not-found-wrapper'), { ssr: false });
    return <NotFoundWrapper />;
  }

  // If the page belongs to a private group and user doesn't have access
  if (groupIsPrivate && !hasGroupAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Private Group Content</h1>
          <p className="text-muted-foreground mb-2">This page belongs to a private group.</p>
          <p className="text-muted-foreground mb-6">You need to be a member of the group to access this content.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (!page) {
    // If the page is not loading and there's no error, use NotFoundWrapper
    if (!isLoading && !error) {
      const NotFoundWrapper = dynamic(() => import('../../not-found-wrapper'), { ssr: false });
      return <NotFoundWrapper />;
    }

    return (
      <Layout>
        <Head>
          <title>Page Not Found - WeWrite</title>
        </Head>
        <PageHeader />
        <div className="min-h-[400px] w-full">
          {isLoading || loadingTimedOut ? (
            <SmartLoader
              isLoading={isLoading}
              message={`Loading page${loadAttempts > 0 ? ` (attempt ${loadAttempts + 1}/${maxLoadAttempts})` : ''}...`}
              timeoutMs={10000}
              autoRecover={true}
              onRetry={() => {
                // Attempt to reload the page data
                if (params.id) {
                  setIsLoading(true);
                  setLoadingTimedOut(false);
                  // Reset load attempts on manual retry
                  setLoadAttempts(0);
                  listenToPageById(params.id, (data) => {
                    if (data.error) {
                      setError(data.error);
                    } else {
                      setPage(data.pageData || data);
                    }
                    setIsLoading(false);
                  }, user?.uid || null);
                }
              }}
              fallbackContent={
                <div>
                  <p>We're having trouble loading this page. This could be due to:</p>
                  <ul className="list-disc list-inside text-left mt-2 mb-2">
                    <li>Slow network connection</li>
                    <li>Server issues</li>
                    <li>The page may have been deleted</li>
                  </ul>
                  <p className="mt-2">You can try:</p>
                  <ul className="list-disc list-inside text-left mt-2">
                    <li>Checking your internet connection</li>
                    <li>Refreshing the page</li>
                    <li>Coming back later</li>
                  </ul>
                </div>
              }
            />
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-md w-full">
                <ErrorDisplay
                  message={error}
                  severity="warning"
                  title="Access Error"
                  onRetry={() => {
                    window.location.reload();
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <Head>
          <title>Loading... - WeWrite</title>
        </Head>
        <PageHeader />
        <SmartLoader
          isLoading={isLoading}
          message={`Loading page content${loadAttempts > 0 ? ` (attempt ${loadAttempts + 1}/${maxLoadAttempts})` : ''}...`}
          timeoutMs={10000}
          autoRecover={true}
          onRetry={() => {
            // Attempt to reload the page data
            if (params.id) {
              setIsLoading(true);
              setLoadingTimedOut(false);
              // Reset load attempts on manual retry
              setLoadAttempts(0);
              listenToPageById(params.id, (data) => {
                if (data.error) {
                  setError(data.error);
                } else {
                  setPage(data.pageData || data);
                }
                setIsLoading(false);
              }, user?.uid || null);
            }
          }}
          fallbackContent={
            <div>
              <p>We're having trouble loading this page. This could be due to:</p>
              <ul className="list-disc list-inside text-left mt-2 mb-2">
                <li>Slow network connection</li>
                <li>Server issues</li>
                <li>The page may have been deleted</li>
              </ul>
              <p className="mt-2">You can try:</p>
              <ul className="list-disc list-inside text-left mt-2">
                <li>Checking your internet connection</li>
                <li>Refreshing the page</li>
                <li>Coming back later</li>
              </ul>
              {loadAttempts >= maxLoadAttempts && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
                  <p className="font-medium">Multiple loading attempts failed</p>
                  <p className="text-sm mt-1">Please try refreshing the page or coming back later.</p>
                </div>
              )}
            </div>
          }
        />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Head>
          <title>Error - WeWrite</title>
        </Head>
        <PageHeader />
        <div className="p-4 max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold mb-4">
            Error Loading Page
          </h1>
          <ErrorDisplay
            message={error}
            severity="error"
            title="Page Error"
            showDetails={true}
            showRetry={true}
            onRetry={() => {
              window.location.reload();
            }}
            className="mb-6"
          />
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/">
                Go Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if this is a private page that doesn't belong to a group
  if (!isPublic && !groupId) {
    // If user is logged in and is the owner, allow access
    if (user && user.uid === page.userId) {
      // Continue to render the page for the owner
      console.log(`Owner access granted to private page ${page.id} for user ${user.uid}`);
    } else {
      // For non-owners or logged-out users, show private page message
      return (
        <Layout>
          <Head>
            <title>Private Page - WeWrite</title>
          </Head>
          <PageHeader />
          <div className="p-4">
            <h1 className="text-2xl font-semibold text-text">
              {title}
            </h1>
            <div className="flex flex-col items-start gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg text-muted-foreground">This page is private</span>
              </div>
              {!user ? (
                <div className="flex gap-3">
                  <Link href="/auth/register">
                    <Button variant="outline">
                      Create Account
                    </Button>
                  </Link>
                  <Link href="/auth/login">
                    <Button variant="default" className="text-white">
                      Log In
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground">Only the page owner can view this content.</p>
              )}
            </div>
          </div>
        </Layout>
      );
    }
  }

  // For private pages in groups, access is handled by the groupIsPrivate check above
  // and by the checkPageAccess function in the database.js file

  return (
    <Layout>
      <Head>
        <title>{title} - WeWrite</title>
      </Head>
      <PageHeader
        title={title}
        username={page?.username || "Anonymous"}
        userId={page?.userId}
        isLoading={isLoading}
        groupId={groupId}
        groupName={groupName}
        scrollDirection={scrollDirection}
        isPrivate={!isPublic}
        isEditing={isEditing}
        setIsEditing={handleSetIsEditing}
        onTitleChange={handleTitleChange}
        titleError={titleError}
        canEdit={
          user?.uid && (
            // User is the page owner
            user.uid === page?.userId ||
            // OR page belongs to a group and user is a member of that group
            (page?.groupId && hasGroupAccess)
          )
        }
      />
      <div className="pb-24 w-full max-w-none min-h-screen box-border">
        {/* Unified container with compact layout for both modes */}
        <div className="px-4 py-4 w-full max-w-none box-border">
          {isEditing ? (
            <div className="animate-in fade-in-0 duration-300">
              <PageProvider>
                <LineSettingsProvider>
                  <PageEditor
                    key={`editor-${page.id}-${isEditing}`} /* Force re-initialization when switching to edit mode */
                    title={title}
                    setTitle={handleTitleChange}
                    initialContent={editorState}
                    onContentChange={handleContentChange}
                    isPublic={isPublic}
                    setIsPublic={handleVisibilityChange}
                    location={location}
                    setLocation={handleLocationChange}
                    onSave={() => handleSave(editorContent || editorState)}
                    onCancel={handleCancelWithCheck}
                    onDelete={handleDelete}
                    isSaving={isSaving}
                    error={error}
                    isNewPage={false}
                    clickPosition={clickPosition}
                    page={page}
                  />

                {/* Unsaved Changes Dialog */}
                <UnsavedChangesDialog
                  isOpen={showUnsavedChangesDialog}
                  onClose={handleCloseDialog}
                  onStayAndSave={handleStayAndSave}
                  onLeaveWithoutSaving={handleLeaveWithoutSaving}
                  isSaving={isSaving || isHandlingNavigation}
                />

                {/* Delete Confirmation Modal */}
                <ConfirmationModal
                  isOpen={confirmationState.isOpen}
                  onClose={closeConfirmation}
                  onConfirm={confirmationState.onConfirm}
                  title={confirmationState.title}
                  message={confirmationState.message}
                  confirmText={confirmationState.confirmText}
                  cancelText={confirmationState.cancelText}
                  variant={confirmationState.variant}
                  isLoading={confirmationState.isLoading}
                  icon={confirmationState.icon}
                />
                </LineSettingsProvider>
              </PageProvider>
            </div>
          ) : (
            <div className="animate-in fade-in-0 duration-300">
              {/* Identical structure to edit mode */}
              <PageProvider>
                <LineSettingsProvider>
                  <TextSelectionProvider
                    contentRef={contentRef}
                    enableCopy={true}
                    enableShare={true}
                    enableAddToPage={true}
                    username={user?.displayName || user?.username}
                  >
                    <div ref={contentRef}>
                      <TextViewErrorBoundary fallbackContent={
                        <div className="p-4 text-muted-foreground">
                          <p>Unable to display page content. The page may have formatting issues.</p>
                          <p className="text-sm mt-2">Page ID: {page.id}</p>
                        </div>
                      }>
                        <TextView
                            key={`content-${page.id}`} /* Use stable key based on page ID */
                            content={editorState}
                            viewMode={lineMode}
                            onRenderComplete={handlePageFullyRendered}
                            setIsEditing={handleSetIsEditing}
                            canEdit={
                              user?.uid && (
                                // User is the page owner
                                user.uid === page.userId ||
                                // OR page belongs to a group and user is a member of that group
                                (page.groupId && hasGroupAccess)
                              )
                            }
                            isEditing={isEditing}
                          />
                      </TextViewErrorBoundary>

                      {/* Unified text highlighting for URL-based highlights */}
                      <UnifiedTextHighlighter
                        contentRef={contentRef}
                        showNotification={true}
                        autoScroll={true}
                      />
                    </div>
                  </TextSelectionProvider>

                  {/* Backlinks and Related Pages - Always render with fixed height to prevent layout shifts */}
                  <div className="mt-8">
                    {/* What Links Here section */}
                    <BacklinksSection
                      page={page}
                      linkedPageIds={memoizedLinkedPageIds}
                    />

                    {/* Related Pages section - Using pre-computed memoized values */}
                    <RelatedPages
                      page={memoizedPage}
                      linkedPageIds={memoizedLinkedPageIds}
                    />
                  </div>
                </LineSettingsProvider>
              </PageProvider>
            </div>
          )}
        </div>
      </div>
      <PageProvider>
        <LineSettingsProvider>
          <PageFooter
            page={page}
            content={editorState}
            isOwner={
              user?.uid && (
                // User is the page owner
                user.uid === page.userId ||
                // OR page belongs to a group and user is a member of that group
                (page.groupId && hasGroupAccess)
              )
            }
            isEditing={isEditing}
            setIsEditing={handleSetIsEditing}
          />
        </LineSettingsProvider>
      </PageProvider>
      <SiteFooter />
      {!isEditing && (
        <TokenPledgeBar
          pageId={page.id}
          pageTitle={page.title}
          authorId={page.userId}
        />
      )}


    </Layout>
  );
}

// AddToPageDialog component has been moved to PageActions.tsx
// This implementation is no longer used and has been removed to avoid duplication

export default SinglePageView;
