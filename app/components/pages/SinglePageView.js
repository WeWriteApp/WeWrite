/**
 * SinglePageView Component
 *
 * Main component for displaying and editing individual pages in WeWrite.
 *
 * Key Features:
 * - Real-time page loading with Firebase listeners
 * - Seamless view/edit mode switching
 * - Comprehensive error handling and loading states
 * - Support for both public and private pages
 * - Integrated link insertion and page management
 *
 * Recent Fixes:
 * - Fixed 404 errors by properly handling data.pageData vs direct data formats
 * - Removed problematic mounted checks that were blocking data updates
 * - Simplified callback logic for better maintainability
 * - Cleaned up excessive debug logging
 */
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
import DeletedPageBanner from "../utils/DeletedPageBanner";

// Removed Slate imports - using simple text rendering now
import PublicLayout from "../layout/PublicLayout";
import PageHeader from "./PageHeader.tsx";
import PageFooter from "./PageFooter";

import TokenAllocationBar from "../payments/TokenAllocationBar";
import CombinedLinksSection from "../features/CombinedLinksSection";
import Link from "next/link";
import Head from "next/head";
import { Button } from "../ui/button";
// Removed EditorContent import - ReplyEditor was replaced with Editor
import Editor from "../editor/Editor";

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
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext";
import { Switch } from "../ui/switch";
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
// PageEditor removed - now using unified Editor component
import { saveNewVersion, updateDoc, deletePage } from "../../firebase/database";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../utils/UnsavedChangesDialog";
import { useConfirmation } from "../../hooks/useConfirmation";
import ConfirmationModal from "../utils/ConfirmationModal";
import { useLogging } from "../../providers/LoggingProvider";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";
import { detectPageChanges } from "../../utils/contentNormalization";
import { ContentChangesTrackingService } from "../../services/contentChangesTracking";
import { navigateAfterPageDeletion } from "../../utils/postDeletionNavigation";

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
  const [isEditing, setIsEditing] = useState(initialEditMode); // SIMPLIFIED: Start in edit mode if initialEditMode is true
  const [editorState, setEditorState] = useState([]);
  const [editorError, setEditorError] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
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

  // CRITICAL FIX: Add ref to access editor content
  const editorRef = useRef(null);

  // CRITICAL FIX: Add ref to track if component is mounted to prevent state updates after unmounting
  const isMountedRef = useRef(true);

  // Deleted page preview state
  const [isPreviewingDeleted, setIsPreviewingDeleted] = useState(false);
  const [deletedPageData, setDeletedPageData] = useState(null);

  const { user, loading: authLoading } = useContext(AuthContext);
  const { recentPages = [], addRecentPage } = useContext(RecentPagesContext) || {};
  const searchParams = useSearchParams();
  const router = useRouter();
  const contentRef = useRef(null);
  const { logError } = useLogging();
  // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
  // const { trackEditingFlow, trackContentEvent, events } = useWeWriteAnalytics();

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

  // CRITICAL FIX: Create a ref to store the getCurrentContent function
  const getCurrentContentRef = useRef(null);

  // Handle save action - comprehensive save logic moved from EditPage
  const handleSave = useCallback(async (inputContent, saveMethod = 'button') => {



    if (!user) {
      setError("User not authenticated");
      return false;
    }

    // CRITICAL DATA LOSS PREVENTION: Validate content before saving
    const contentToSave = inputContent || editorContent || editorState;

    // Check if content is unexpectedly empty
    const isContentEmpty = !contentToSave ||
      (Array.isArray(contentToSave) && (
        contentToSave.length === 0 ||
        (contentToSave.length === 1 &&
         contentToSave[0]?.type === 'paragraph' &&
         contentToSave[0]?.children?.length === 1 &&
         contentToSave[0]?.children[0]?.text === '')
      ));

    // If content is empty but the page should have content, show warning
    if (isContentEmpty && page && !page.isNewPage) {
      // Show confirmation dialog for potentially destructive save
      const confirmSave = window.confirm(
        "⚠️ WARNING: You are about to save empty content.\n\n" +
        "This will permanently delete all existing content on this page.\n\n" +
        "Are you sure you want to continue?\n\n" +
        "Click 'Cancel' to go back and check your content, or 'OK' to proceed with saving empty content."
      );

      if (!confirmSave) {
        return false;
      }
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

    // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
    // Track save attempt
    // trackEditingFlow.saved(params.id, saveMethod, {
    //   page_title: title,
    //   has_content_changes: hasContentChanged,
    //   has_title_changes: hasTitleChanged,
    //   has_visibility_changes: hasVisibilityChanged,
    //   has_location_changes: hasLocationChanged
    // });

    try {
      // CRITICAL FIX: Get current content from editor using callback function
      let finalContent = inputContent;

      if (!finalContent && getCurrentContentRef.current) {
        console.log("🔵 SAVE: Getting current content from editor via callback");
        try {
          finalContent = getCurrentContentRef.current();
          console.log("🔵 SAVE: Got content from editor:", {
            contentType: typeof finalContent,
            isArray: Array.isArray(finalContent),
            length: Array.isArray(finalContent) ? finalContent.length : 0,
            preview: JSON.stringify(finalContent).substring(0, 200)
          });
        } catch (editorError) {
          console.error("🔴 SAVE: Error getting content from editor:", editorError);
          finalContent = null;
        }
      }

      // Fall back to stored content if editor content is not available
      if (!finalContent) {
        finalContent = editorContent || editorState;
        console.log("🔵 SAVE: Using fallback content from state");
      }

      // CRITICAL FIX: Allow empty content to be saved
      // Users should be able to save pages with just a title
      if (!finalContent) {
        // Create default empty content structure
        finalContent = [{ type: "paragraph", children: [{ text: "" }] }];
        console.log("No content provided, using default empty structure");
      } else if (!Array.isArray(finalContent)) {
        console.warn("Content is not an array, converting to default structure");
        finalContent = [{ type: "paragraph", children: [{ text: "" }] }];
      }

      // Additional validation: ensure content has proper structure
      if (Array.isArray(finalContent) && finalContent.length === 0) {
        console.log("Empty array content detected, creating default structure");
        finalContent = [{ type: "paragraph", children: [{ text: "" }] }];
      }

      // Convert content to JSON string for storage
      const editorStateJSON = JSON.stringify(finalContent);
      console.log("Saving content:", editorStateJSON.substring(0, 100) + "...");

      // SIMPLIFIED: Skip complex change detection - just save the content
      console.log('💾 SIMPLIFIED: Saving content directly without complex change detection');

      // SIMPLIFIED: Always save when user clicks save - no complex change detection
      console.log('💾 SIMPLIFIED SAVE: Always saving when user clicks save button');
      console.log('💾 Content to save:', {
        contentLength: Array.isArray(finalContent) ? finalContent.length : 'not array',
        contentPreview: JSON.stringify(finalContent).substring(0, 200)
      });

      // SIMPLIFIED: Update the page document directly
      console.log(`💾 Updating page ${page.id} with new content`);

      // CRITICAL FIX: Use ISO string instead of serverTimestamp for consistent format
      // This ensures lastModified is always stored as an ISO string, not a Firestore Timestamp
      const now = new Date().toISOString();

      // Prepare update data - always update everything
      const updateData = {
        title: title,
        isPublic: isPublic,
        location: location,
        content: editorStateJSON,
        lastModified: now
      };

      await updateDoc("pages", page.id, updateData);

      console.log('Page metadata and content updated successfully');

      // CRITICAL FIX: Add page to recent pages list for immediate UI updates
      try {
        if (addRecentPage) {
          await addRecentPage({
            id: page.id,
            title: title,
            lastModified: now,
            userId: page.userId,
            username: page.username || user.displayName || user.username
          });
          console.log('✅ Added page to recent pages list');
        }
      } catch (recentError) {
        console.error('⚠️ Error adding to recent pages (non-fatal):', recentError);
        // Don't fail the save if recent pages tracking fails
      }

      // Track content changes for analytics
      try {
        await ContentChangesTrackingService.trackContentChangeAdvanced(
          page.id,
          user.uid,
          user.displayName || user.username || 'Anonymous',
          page.content, // Previous content
          finalContent  // New content
        );
      } catch (trackingError) {
        console.error('Error tracking content changes (non-fatal):', trackingError);
      }

      // If title changed, propagate to all links referencing this page
      if (title !== page.title) {
        console.log(`Page title changed from "${page.title}" to "${title}", propagating to links...`);
        try {
          const { propagatePageTitleUpdate } = await import('../../firebase/database/linkPropagation');
          await propagatePageTitleUpdate(page.id, title, page.title);
        } catch (error) {
          console.error('Error propagating title update:', error);
          // Don't fail the page update if link propagation fails
        }
      }

      // ENHANCED: Enable no-op detection to prevent unnecessary versions
      try {
        const result = await saveNewVersion(page.id, {
          content: editorStateJSON,
          userId: user.uid,
          username: user.displayName || user.username,
          skipIfUnchanged: true // Skip version creation for no-op edits
        });

        if (result && result.success) {
          console.log('💾 New version created successfully:', result.versionId);
        } else {
          console.log('⚠️ Version creation failed, but page was saved');
        }
      } catch (versionError) {
        console.error('⚠️ Error creating new version:', versionError);
        // Don't fail the entire save if version creation fails
      }

      // CRITICAL FIX: Invalidate all caches before triggering refresh
      try {
        // Invalidate request cache
        const { invalidatePageCache } = await import('../../utils/requestCache');
        invalidatePageCache(page.id);

        // Clear page cache
        const { clearPagesCache } = await import('../../lib/pageCache');
        clearPagesCache(user.uid);

        // Clear optimized pages cache
        const { clearPageCaches } = await import('../../firebase/optimizedPages');
        clearPageCaches();

        // Clear stats cache
        const { cachedStatsService } = await import('../../services/CachedStatsService');
        cachedStatsService.clearCache('page', page.id);

        console.log('✅ All caches invalidated after save');
      } catch (cacheError) {
        console.error('⚠️ Error invalidating caches (non-fatal):', cacheError);
      }

      // Add the edited page to recent pages tracking
      try {
        if (addRecentPage) {
          await addRecentPage({
            id: page.id,
            title: title,
            userId: page.userId,
            username: page.username || user.displayName || user.username || 'Anonymous'
          });
          console.log('Added edited page to recent pages tracking');
        }
      } catch (recentPagesError) {
        console.error('Error adding edited page to recent pages (non-fatal):', recentPagesError);
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
  }, [user, page, editorContent, editorState, title, isPublic, location, logError]);

  // Handle cancel action
  const handleCancel = () => {
    // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
    // Track cancellation if there were unsaved changes
    if (hasContentChanged || hasTitleChanged || hasVisibilityChanged || hasLocationChanged) {
      // trackEditingFlow.cancelled(params.id, {
      //   page_title: title,
      //   had_content_changes: hasContentChanged,
      //   had_title_changes: hasTitleChanged,
      //   had_visibility_changes: hasVisibilityChanged,
      //   had_location_changes: hasLocationChanged
      // });
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
      // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
      // Track edit mode entry
      // trackEditingFlow.started(params.id, {
      //   page_title: page?.title,
      //   is_public: page?.isPublic,
      //   click_position: position ? 'click' : 'keyboard'
      // });
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
    if (!page || isDeleted) return;

    // Use the correct confirmDelete API - it expects just the item name
    const confirmed = await confirmDelete(`"${page.title || 'this page'}"`);

    if (confirmed) {
      try {
        // Set flag to prevent page listener from updating state during deletion
        setIsDeletingPage(true);

        // CRITICAL: Navigate IMMEDIATELY before deletion to prevent 404
        // Use graceful navigation with proper browser history handling
        await navigateAfterPageDeletion(page, user, router);

        // Delete the page after navigation has started
        await deletePage(page.id);

        // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
        // Track successful deletion
        // trackContentEvent(events.PAGE_DELETED, {
        //   page_id: page.id,
        //   page_title: page.title,
        //   was_public: page.isPublic
        // });

        // Trigger success event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('page-deleted', {
            detail: { pageId: page.id }
          }));
        }

      } catch (error) {
        console.error("Error deleting page:", error);
        const errorMessage = `Failed to delete page: ${error.message}`;
        setError(errorMessage);
        toast.error("Failed to delete page");
        logError(error, { context: 'SinglePageView.handleDelete', pageId: page.id });
      }
    }
  };

  // Handle link insertion for existing pages
  const handleInsertLink = useCallback(() => {
    if (!editorRef.current) {
      console.error("Editor ref not available");
      return;
    }

    try {
      // Check if the editor has the openLinkEditor method
      if (typeof editorRef.current.openLinkEditor === 'function') {
        console.log("🔵 [DEBUG] Calling editorRef.current.openLinkEditor()");
        const result = editorRef.current.openLinkEditor();
        console.log("🔵 [DEBUG] openLinkEditor result:", result);

        if (!result) {
          console.error("🔴 [DEBUG] openLinkEditor returned false");
          toast.error("Could not open link editor. Please try again.");
        }
      } else {
        console.error("🔴 [DEBUG] openLinkEditor method not available on editor");
        console.log("🔵 [DEBUG] Available methods:", Object.getOwnPropertyNames(editorRef.current));
        toast.error("Link insertion is not available. Please try again later.");
      }
    } catch (error) {
      console.error("🔴 [DEBUG] Error in handleInsertLink:", error);
      toast.error("Failed to open link editor. Please try again.");
    }
  }, [editorRef]);

  // Handle restoring a deleted page
  const handleRestorePage = async () => {
    if (!page || !user) return;

    try {
      // Import the updateDoc function
      const { updateDoc } = await import('../../firebase/database');

      // Remove the deleted flag and related fields
      await updateDoc('pages', page.id, {
        deleted: false,
        deletedAt: null,
        deletedBy: null
      });



      // Redirect to the restored page (without preview parameter)
      router.push(`/${page.id}`);
    } catch (error) {
      console.error('Error restoring page:', error);
      toast.error("Failed to restore page");
    }
  };

  // Handle permanently deleting a page
  const handlePermanentlyDeletePage = async () => {
    if (!page || !user) return;

    try {
      // Import the deleteDoc function
      const { db } = await import('../../firebase/database');
      const { doc, deleteDoc } = await import('firebase/firestore');

      // Actually delete the document from Firestore
      await deleteDoc(doc(db, 'pages', page.id));



      // Redirect to deleted pages list
      router.push('/settings/deleted');
    } catch (error) {
      console.error('Error permanently deleting page:', error);
      toast.error("Failed to permanently delete page");
    }
  };

  // Calculate days until permanent deletion
  const getDaysUntilPermanentDeletion = (deletedAt) => {
    if (!deletedAt) return 30;

    try {
      const deletedDate = new Date(deletedAt);
      const now = new Date();
      const thirtyDaysLater = new Date(deletedDate.getTime() + (30 * 24 * 60 * 60 * 1000));
      const timeDiff = thirtyDaysLater.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return Math.max(0, daysDiff);
    } catch {
      return 30;
    }
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
    }
  }, [page]);

  // Check for deleted page preview mode
  useEffect(() => {
    const previewParam = searchParams?.get('preview');
    const isDeletedPreview = previewParam === 'deleted';

    setIsPreviewingDeleted(isDeletedPreview);

    // If we're previewing a deleted page, we need to allow access to deleted pages
    if (isDeletedPreview && page?.deleted) {
      setDeletedPageData({
        deletedAt: page.deletedAt,
        daysLeft: getDaysUntilPermanentDeletion(page.deletedAt)
      });
    }
  }, [searchParams, page]);

  // Memoized save function for the useUnsavedChanges hook
  const saveChanges = useCallback(() => {
    return handleSave(null, 'button'); // Let handleSave get current content from editor
  }, [handleSave]);

  // Keyboard save handler
  const handleKeyboardSave = useCallback(() => {
    return handleSave(null, 'keyboard'); // Let handleSave get current content from editor
  }, [handleSave]);

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
    // 3. Page isn't deleted (!isDeleted) and not previewing deleted
    // 4. User owns the page OR is a member of the group that owns the page
    canEdit: Boolean(
      !isLoading &&
      page !== null &&
      !isDeleted &&
      !isPreviewingDeleted &&
      user?.uid &&
      // User is the page owner
      (page?.userId && user.uid === page.userId)
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

      // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
      // Track the page view in Google Analytics with our improved tracking
      // This will wait until the page title and username/group are fully loaded
      // if (page.title) {
      //   // If we already have a title, use it as a starting point
      //   let initialTitle;

      //   // Format title based on page author
      //   if (page.username) {
      //     initialTitle = `Page: ${page.title} by ${page.username}`;
      //   } else {
      //     initialTitle = `Page: ${page.title}`;
      //   }

      //   trackPageViewWhenReady(params.id, initialTitle);
      // } else {
      //   // If we don't have a title yet, let the tracking function handle it
      //   trackPageViewWhenReady(params.id);
      // }
    }
  }, [params.id, isLoading, page, isPublic, user?.uid]);

  // Add a timeout ref to prevent infinite loading
  const loadingTimeoutRef = useRef(null);
  const emergencyTimeoutRef = useRef(null); // Track emergency timeout separately
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const maxLoadAttempts = 3;

  useEffect(() => {
    if (params.id) {
      // Emergency timeout to prevent infinite loading - INCREASED to 10 seconds to prevent premature override
      emergencyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.warn("SinglePageView: Emergency timeout triggered after 10 seconds");
          setIsLoading(false);
          // Set some basic content to show something
          if (!page) {
            setPage({
              id: params.id,
              title: "Loading...",
              username: "Unknown",
              isPublic: true
            });
          }
          if (!editorState || editorState.length === 0) {
            setEditorState([{
              type: "paragraph",
              children: [{ text: "Content is loading..." }]
            }]);
          }
        }
      }, 10000); // INCREASED to 10 seconds to prevent content disappearing

      // Wait for authentication to complete before setting up listener
      // This prevents permission denied errors when checking group access
      if (authLoading) {
        if (emergencyTimeoutRef.current) {
          clearTimeout(emergencyTimeoutRef.current); // Clear emergency timeout if we're waiting for auth
          emergencyTimeoutRef.current = null;
        }
        return;
      }

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
      // Set up page listener

      const unsubscribe = listenToPageById(params.id, (data) => {
        try {
          // Stop loading immediately when data is received
          setIsLoading(false);

          // Clear timeout and reset attempts
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          // CRITICAL: Clear emergency timeout when page loads successfully
          if (emergencyTimeoutRef.current) {
            clearTimeout(emergencyTimeoutRef.current);
            emergencyTimeoutRef.current = null;
          }
          setLoadingTimedOut(false);
          setLoadAttempts(0);

          // Handle errors
          if (data.error) {
            console.error("SinglePageView: Error loading page:", data.error);
            if (!isDeleted && isMountedRef.current) {
              setError(data.error);
            }
            return;
          }

          // Extract page data (handle both data.pageData and direct data formats)
          const pageData = data.pageData || data;

          if (pageData && pageData.id && !isDeletingPage) {
            setPage(pageData);
            setIsPublic(pageData.isPublic || false);
            setIsDeleted(pageData.deleted || false);

            // Set page title
            if (pageData.title) {
              setTitle(pageData.title === "Untitled"
                ? `Untitled (${pageData.id.substring(0, 6)})`
                : pageData.title
              );
            }
          }

          // Set content
          if (data.versionData?.content) {
            try {
              let content = data.versionData.content;
              if (typeof content === 'string') {
                content = JSON.parse(content);
              }
              setEditorState(Array.isArray(content) ? content : [content]);
            } catch (error) {
              console.error("Error parsing content:", error);
              setEditorState([{
                type: "paragraph",
                children: [{ text: "Error loading content." }]
              }]);
            }
          }
        } catch (error) {
          console.error("SinglePageView: Error in callback:", error);
          if (isMountedRef.current) {
            setIsLoading(false);
            setError("An unexpected error occurred while loading the page. Please try refreshing.");
          }
        }
      }, currentUserId); // Pass the user ID here

      return () => {
        // Clean up the listener when the component unmounts
        unsubscribe();

        // Clear the timeout if it exists
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        // CRITICAL: Clear emergency timeout on cleanup
        if (emergencyTimeoutRef.current) {
          clearTimeout(emergencyTimeoutRef.current);
          emergencyTimeoutRef.current = null;
        }

        // Reset state to prevent memory leaks
        setIsLoading(false);
        setLoadingTimedOut(false);
        setLoadAttempts(0);
      };
    }
  }, [params.id, user?.uid, loadAttempts, authLoading, isDeletingPage]); // Added authLoading to wait for auth completion



  // Handle initial edit mode from URL or initialEditMode prop
  useEffect(() => {
    if (!isLoading && page && user) {
      // Check if user has edit permissions
      const canEdit = user.uid === page.userId;

      if (canEdit) {
        // Check for edit=true URL parameter (legacy support)
        if (searchParams && searchParams.get('edit') === 'true') {
          setIsEditing(true);
        }
        // Check for initialEditMode prop (from /[id]/edit route)
        else if (initialEditMode) {
          // Wait for content to load before entering edit mode
          // This prevents the race condition where editor initializes with empty content
          if (editorState && editorState.length > 0) {
            setIsEditing(true);
          }
          // Content will trigger edit mode when it loads (see content loading effect below)
        }
      } else {
        // If user doesn't have permissions and they're on edit URL, redirect to normal view
        if (initialEditMode) {
          router.replace(`/${params.id}`);
        }
      }
    }
  }, [searchParams, isLoading, page, user, initialEditMode, params.id, router, editorState]);

  // Handle edit mode when content loads
  useEffect(() => {
    // If we're waiting for content to load for initial edit mode
    if (!isLoading && page && user && initialEditMode && !isEditing && editorState && editorState.length > 0) {
      const canEdit = user.uid === page.userId;
      if (canEdit) {
        setIsEditing(true);
      }
    }
  }, [isLoading, page, user, initialEditMode, isEditing, editorState]);

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
        if (user && page && (user.uid === page.userId)) {
          setIsEditing(true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditing, user, page]);



  // Listen for page-updated events to refresh the page data
  useEffect(() => {
    const handlePageUpdated = async (event) => {
      // Only refresh if this is the page that was updated
      if (event.detail && event.detail.pageId === params.id) {
        // Clear caches before refetching
        try {
          const { invalidatePageCache } = await import('../../utils/requestCache');
          invalidatePageCache(params.id);
        } catch (cacheError) {
          console.error('Error invalidating cache in event handler:', cacheError);
        }

        // Force a fresh fetch by creating a new listener
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
              // Prioritize content from versionData which is more reliable
              const content = data.versionData?.content || data.pageData?.content || data.content;
              if (content) {
                let parsedContent;

                // Handle different content formats
                if (typeof content === 'string') {
                  try {
                    // Check if content is already parsed (double parsing issue)
                    if (content.startsWith('[{"type":"paragraph"') || content.startsWith('[{\\\"type\\\":\\\"paragraph\\\"')) {
                      parsedContent = JSON.parse(content);
                    } else {
                      // Content might be double-stringified, try to parse twice
                      try {
                        const firstParse = JSON.parse(content);
                        if (typeof firstParse === 'string' &&
                            (firstParse.startsWith('[{"type":"paragraph"') ||
                             firstParse.startsWith('[{\\\"type\\\":\\\"paragraph\\\"'))) {
                          parsedContent = JSON.parse(firstParse);
                        } else {
                          parsedContent = firstParse;
                        }
                      } catch (doubleParseError) {
                        console.error("Error parsing potentially double-stringified content:", doubleParseError);
                        parsedContent = JSON.parse(content);
                      }
                    }
                  } catch (parseError) {
                    console.error("Error parsing string content:", parseError);
                    parsedContent = [{
                      type: "paragraph",
                      children: [{ text: "Error loading content. Please try refreshing the page." }]
                    }];
                  }
                } else if (Array.isArray(content)) {
                  parsedContent = content;
                } else if (content && typeof content === 'object') {
                  parsedContent = [content];
                } else {
                  parsedContent = [{
                    type: "paragraph",
                    children: [{ text: "No content available." }]
                  }];
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
                    const itemHash = JSON.stringify(item);
                    if (!seen.has(itemHash)) {
                      seen.add(itemHash);
                      uniqueItems.push(item);
                    }
                  });

                  parsedContent = uniqueItems;
                }

                setEditorState(parsedContent);
              }
            } catch (error) {
              console.error('Error parsing updated content:', error);
            }
          }
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
  // FIXED: Always provide page data to RelatedPages, don't wait for pageFullyRendered
  // The RelatedPages component can handle loading states internally
  // CRITICAL: Include the current content from editorState for proper related page analysis
  const memoizedPage = useMemo(() => {
    if (!page) return null;
    return {
      ...page,
      content: JSON.stringify(editorState) // Include current content for analysis
    };
  }, [page, editorState]);
  const memoizedLinkedPageIds = useMemo(() =>
    pageFullyRendered ? extractLinkedPageIds(editorState) : [],
    [pageFullyRendered, editorState]
  );

  // CRITICAL FIX: Cleanup effect to prevent state updates after unmounting
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const Layout = user ? React.Fragment : PublicLayout;

  // If the page is deleted and we're not previewing it, use NotFoundWrapper
  if (isDeleted && !isPreviewingDeleted) {
    const NotFoundWrapper = dynamic(() => import('../../not-found-wrapper'), { ssr: false });
    return <NotFoundWrapper />;
  }

  // If we're previewing a deleted page but the page data indicates it's deleted,
  // we need to check if the user is the owner
  if (isPreviewingDeleted && page?.deleted && (!user || user.uid !== page.userId)) {
    const NotFoundWrapper = dynamic(() => import('../../not-found-wrapper'), { ssr: false });
    return <NotFoundWrapper />;
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

  // Check if this is a private page
  if (!isPublic) {
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

  // All pages are now public by default, with only ownership-based editing permissions

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
        scrollDirection={scrollDirection}
        isPrivate={!isPublic}
        isEditing={isEditing}
        setIsEditing={handleSetIsEditing}
        onTitleChange={handleTitleChange}
        titleError={titleError}
        onDelete={handleDelete}
        canEdit={
          user?.uid && !isPreviewingDeleted && (
            // User is the page owner
            user.uid === page?.userId
          )
        }
      />

      {/* Deleted Page Banner - shown when previewing deleted pages */}
      {isPreviewingDeleted && page?.deleted && deletedPageData && (
        <DeletedPageBanner
          pageId={page.id}
          pageTitle={page.title}
          deletedAt={page.deletedAt}
          daysLeft={deletedPageData.daysLeft}
          onRestore={handleRestorePage}
          onPermanentDelete={handlePermanentlyDeletePage}
        />
      )}

      <div className="w-full max-w-none box-border">
        {/* Use global LineSettingsProvider - no need for page-specific provider */}
        <PageProvider>
          <PageContentWithLineSettings
                isEditing={isEditing}
                page={page}
                user={user}
                editorState={editorState}
                handlePageFullyRendered={handlePageFullyRendered}
                handleSetIsEditing={handleSetIsEditing}
                memoizedPage={memoizedPage}
                memoizedLinkedPageIds={memoizedLinkedPageIds}
                contentRef={contentRef}
                title={title}
                isPublic={isPublic}
                location={location}
                handleTitleChange={handleTitleChange}
                handleContentChange={handleContentChange}
                handleVisibilityChange={handleVisibilityChange}
                handleLocationChange={handleLocationChange}
                handleSave={handleSave}
                handleCancel={handleCancelWithCheck}
                handleDelete={handleDelete}
                isSaving={isSaving}
                error={error}
                titleError={titleError}
                hasUnsavedChanges={hasUnsavedChanges}
                clickPosition={clickPosition}
                isPreviewingDeleted={isPreviewingDeleted}
                editorRef={editorRef}
                getCurrentContentRef={getCurrentContentRef}
                isEditMode={isEditing}
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
        </PageProvider>
        </div>

      {/* Combined Links Section - positioned outside main content container */}
      {!isEditing && (
        <div className="mt-4 px-4">
          <CombinedLinksSection
            page={page}
            linkedPageIds={memoizedLinkedPageIds}
          />
        </div>
      )}


      <PageProvider>
        <PageFooter
          page={page}
          content={editorState}
          isOwner={
            user?.uid && !isPreviewingDeleted && (
              // User is the page owner
              user.uid === page.userId
            )
          }
          isEditing={isEditing}
          setIsEditing={handleSetIsEditing}
          onSave={() => handleSave(null, 'button')} // Let handleSave get current content from editor
          onCancel={handleCancelWithCheck}
          onDelete={handleDelete}
          onInsertLink={handleInsertLink} // Add Insert Link handler
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </PageProvider>
      {console.log('🔥 SinglePageView: isEditing =', isEditing, 'typeof =', typeof isEditing)}
      {!isEditing && (
        <TokenAllocationBar
          pageId={params.id}
          pageTitle={page?.title}
          authorId={page?.userId}
        />
      )}

    </Layout>
  );
}

// Inner component that has access to LineSettings context
const PageContentWithLineSettings = ({
  isEditing,
  page,
  user,
  editorState,
  handlePageFullyRendered,
  handleSetIsEditing,
  memoizedPage,
  memoizedLinkedPageIds,
  contentRef,
  title,
  isPublic,
  location,
  handleTitleChange,
  handleContentChange,
  handleVisibilityChange,
  handleLocationChange,
  handleSave,
  handleCancel,
  handleDelete,
  isSaving,
  error,
  titleError,
  hasUnsavedChanges,
  clickPosition,
  isPreviewingDeleted,
  editorRef,
  getCurrentContentRef,
  isEditMode
}) => {
  // Now we can access the LineSettings context since we're inside the provider
  const { lineMode, setLineMode } = useLineSettings();

  // Debug: Track lineMode changes
  useEffect(() => {
    console.log('🔧 PageContentWithLineSettings: lineMode changed to:', lineMode);
  }, [lineMode]);

  // CRITICAL FIX: Set up the getCurrentContent callback
  useEffect(() => {
    if (getCurrentContentRef && editorRef) {
      getCurrentContentRef.current = () => {
        if (editorRef.current && editorRef.current.getContent) {
          return editorRef.current.getContent();
        }
        return null;
      };
    }

    // Cleanup function
    return () => {
      if (getCurrentContentRef) {
        getCurrentContentRef.current = null;
      }
    };
  }, [getCurrentContentRef, editorRef]);

  // Calculate user edit permissions
  const canEdit = user?.uid && !isPreviewingDeleted && (
    user.uid === page.userId
  );



  return (
    <div
      className={`animate-in fade-in-0 duration-300 w-full pb-1 max-w-none box-border px-0`}
      style={{
        paddingTop: 'var(--page-header-height, 80px)', // Use dynamic header height with fallback
        transition: 'padding-top 300ms ease-in-out' // Smooth transition when header height changes
      }}
    >
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
            {isEditing ? (
              /* SIMPLIFIED EDIT MODE: Direct Editor component */
              <Editor
                ref={editorRef}
                key={`editor-${page.id}`}
                initialContent={editorState}
                onChange={handleContentChange}
                readOnly={false}
                canEdit={canEdit}
                onSetIsEditing={handleSetIsEditing}
                user={user}
                currentPage={page}
                contentType="wiki"
                placeholder="Start typing..."
                isEditMode={true}
                isNewPage={false}
              />
            ) : (
              /* SIMPLIFIED VIEW MODE: Direct TextView component */
              <TextView
                key={`textview-${page.id}`}
                content={editorState}
                page={page}
                canEdit={canEdit}
                setIsEditing={handleSetIsEditing}
                user={user}
                contentType="wiki"
                isEditing={false}
              />
            )}
          </TextViewErrorBoundary>

          <UnifiedTextHighlighter
            contentRef={contentRef}
            showNotification={true}
            autoScroll={true}
          />
        </div>
      </TextSelectionProvider>





      {/* Dense mode toggle - only show in view mode */}
      {!isEditing && (
        <div className="flex items-center justify-center py-2 transition-all duration-300 ease-in-out">
          <div className="flex items-center space-x-3 transition-all duration-200 ease-in-out hover:scale-105">
            <span className="text-sm text-muted-foreground transition-colors duration-200">Dense mode</span>
            <Switch
              checked={lineMode === LINE_MODES.DENSE}
              onCheckedChange={(checked) => {
                setLineMode(checked ? LINE_MODES.DENSE : LINE_MODES.NORMAL);
              }}
              aria-label="Toggle dense mode"
              className="transition-all duration-200 ease-in-out"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// AddToPageDialog component has been moved to PageActions.tsx
// This implementation is no longer used and has been removed to avoid duplication

export default SinglePageView;
