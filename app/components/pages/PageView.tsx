"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
// Firebase imports removed - using Firestore instead of Realtime Database
import { listenToPageById, getPageVersions, getPageById } from "../../firebase/database";
import { recordPageView } from "../../firebase/pageViews";
import { trackPageViewWhenReady } from "../../utils/analytics-page-titles";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { DataContext } from "../../providers/DataProvider";
import { TextSelectionProvider } from "../../providers/TextSelectionProvider";
import { PageProvider } from "../../contexts/PageContext";
import { useRecentPages } from "../../contexts/RecentPagesContext";
import { useLineSettings } from "../../contexts/LineSettingsContext";
import { createLogger } from '../../utils/logger';

// UI Components
import PublicLayout from "../layout/PublicLayout";
import PageHeader from "./PageHeader";
import PageFooter from "./PageFooter";
import PledgeBar from "../payments/PledgeBar";
import BacklinksSection from "../features/BacklinksSection";
import RelatedPagesSection from "../features/RelatedPagesSection";
import PageGraphView from "./PageGraphView";
import DeletedPageBanner from "../utils/DeletedPageBanner";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import TextViewErrorBoundary from "../editor/TextViewErrorBoundary";
import { SmartLoader } from "../ui/smart-loader";
import { ErrorDisplay } from "../ui/error-display";
import { Button } from "../ui/button";
import { LineSettingsMenu } from "../utils/LineSettingsMenu";

// Editor Components
import TextView from "../editor/TextView";
import Editor from "../editor/Editor";
import EmptyLinesAlert from "../editor/EmptyLinesAlert";
// CustomDateField and LocationField are now handled by PageFooter

// Types
interface PageViewProps {
  params: Promise<{ id: string }> | { id: string };
  initialEditMode?: boolean;
  showVersion?: boolean;
  versionId?: string;
  showDiff?: boolean;
  compareVersionId?: string; // For diff comparison between two versions
}

interface Location {
  lat: number;
  lng: number;
}

interface Page {
  id: string;
  title: string;
  content: any;
  userId: string;

  location?: Location | null;
  createdAt: any;
  updatedAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

/**
 * PageView - Consolidated TypeScript page viewing component
 * 
 * This component replaces SinglePageView.js, ClientPage.tsx, and consolidates
 * all page viewing functionality into a single maintainable TypeScript component.
 * 
 * Features:
 * - Page loading and Firebase listeners
 * - Edit/view mode switching
 * - Page saving, deletion, and visibility controls
 * - Error handling and loading states
 * - Page view recording
 * - Keyboard shortcuts
 * - Title editing
 * - Content editing and viewing
 * - Page header and footer
 * - Backlinks and related pages
 * - Pledge bar integration
 * - Text selection and highlighting
 * - Deleted page preview
 * - Version history support
 */
export default function PageView({
  params,
  initialEditMode = false,
  showVersion = false,
  versionId,
  showDiff = false,
  compareVersionId
}: PageViewProps) {
  // Handle both Promise and object params
  const unwrappedParams = useMemo(() => {
    if (params && typeof params.then === 'function') {
      // This is a Promise, we'll handle it in useEffect
      return null;
    }
    return params as { id: string };
  }, [params]);

  // State
  const [pageId, setPageId] = useState<string>('');
  const [page, setPage] = useState<Page | null>(null);
  const [editorState, setEditorState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [title, setTitle] = useState('');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [versionData, setVersionData] = useState<any>(null);
  const [compareVersionData, setCompareVersionData] = useState<any>(null);
  const [diffContent, setDiffContent] = useState<any>(null);

  // Empty lines tracking for alert banner
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Refs
  const editorRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRecorded = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentAccount } = useCurrentAccount();
  const { addRecentPage } = useRecentPages();

  // Logger
  const logger = createLogger('PageView');

  // Constants
  const maxLoadAttempts = 3;
  const isPreviewingDeleted = searchParams?.get('preview') === 'deleted';

  // API fallback function
  const tryApiFallback = useCallback(async () => {
    try {
      logger.debug('Trying API fallback for page load', { pageId });
      const result = await getPageById(pageId, currentAccount?.uid);

      if (result.error) {
        logger.warn('API fallback failed', { error: result.error, pageId });
        setError(result.error);
        setIsLoading(false);
      } else if (result.pageData) {
        logger.debug('API fallback successful', { pageId });
        const pageData = result.pageData;
        const versionData = result.versionData;

        setPage(pageData);
        setTitle(pageData.title || '');
        setCustomDate(pageData.customDate || null);
        setLocation(pageData.location || null);

        // Parse content - try page content first, then version content
        let contentToUse = pageData.content;
        let contentSource = 'page';

        if (!contentToUse && versionData?.content) {
          contentToUse = versionData.content;
          contentSource = 'version';
        }

        if (contentToUse) {
          try {
            const parsedContent = typeof contentToUse === 'string'
              ? JSON.parse(contentToUse)
              : contentToUse;

            setEditorState(parsedContent);
            setVersionData(versionData);
            setIsLoading(false);

            // Record page view
            if (!viewRecorded.current && pageData.id) {
              recordPageView(pageData.id, currentAccount?.uid || null);
              viewRecorded.current = true;
            }
          } catch (parseError) {
            logger.error('Failed to parse content from API fallback', { parseError });
            setError('Failed to parse page content');
            setIsLoading(false);
          }
        } else {
          // No content, but page exists
          setEditorState([]);
          setVersionData(versionData);
          setIsLoading(false);
        }
      } else {
        logger.warn('API fallback returned no data', { pageId });
        setError('Page not found');
        setIsLoading(false);
      }
    } catch (error) {
      logger.error('API fallback error', { error, pageId });
      setError('Failed to load page');
      setIsLoading(false);
    }
  }, [pageId, currentAccount?.uid, logger]);

  // Handle params Promise
  useEffect(() => {
    if (params && typeof params.then === 'function') {
      logger.debug('Resolving params Promise');
      params.then((resolvedParams) => {
        setPageId(resolvedParams.id || '');
        logger.debug('Params resolved', { id: resolvedParams.id });
      });
    } else if (unwrappedParams) {
      setPageId(unwrappedParams.id || '');
      logger.debug('Using unwrapped params', { id: unwrappedParams.id });
    }
  }, [params, unwrappedParams]);

  // Page loading effect
  useEffect(() => {
    if (!pageId) {
      logger.debug('No pageId provided');
      return;
    }

    logger.debug('Starting page load', { pageId, userId: currentAccount?.uid });
    setIsLoading(true);
    setError(null);

    // If showing version or diff, load version data instead of live page
    if (showVersion && versionId) {
      logger.debug('Loading version data', { versionId });
      loadVersionData();
    } else if (showDiff && versionId) {
      logger.debug('Loading diff data', { versionId });
      loadDiffData();
    } else {
      logger.debug('Setting up page loading with API fallback', { pageId });

      // In development, use API fallback immediately due to Firestore connectivity issues
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Development mode detected, using API fallback immediately', { pageId });
        tryApiFallback();
        return;
      }

      // Try Firebase listener first, with aggressive fallback to API
      let hasReceivedData = false;
      let fallbackTimeout: NodeJS.Timeout;

      // Set up Firebase listener for live page
      const unsubscribe = listenToPageById(pageId, (data) => {
        if (data.error) {
          logger.warn('Page load error', { error: data.error, pageId });
        } else {
          console.log('🔍 PageView: Firebase listener - Page data received', {
            hasPageData: !!(data.pageData || data),
            hasVersionData: !!data.versionData,
            pageData: data.pageData || data,
            content: (data.pageData || data)?.content,
            contentType: typeof (data.pageData || data)?.content,
            contentLength: (data.pageData || data)?.content?.length || 0
          });
        }

        if (data.error) {
          // If Firebase listener fails, try API fallback
          if (!hasReceivedData) {
            logger.debug('Firebase listener failed, trying API fallback', { pageId });
            tryApiFallback();
          } else {
            setError(data.error);
            setIsLoading(false);
          }
        } else {
          hasReceivedData = true;
          clearTimeout(fallbackTimeout);
          const pageData = data.pageData || data;
          const versionData = data.versionData;

          setPage(pageData);
          if (pageData.title !== title) {
            logger.debug('Title updated from page data', {
              oldTitle: title,
              newTitle: pageData.title
            });
          }
          setTitle(pageData.title || '');
          setCustomDate(pageData.customDate || null);
          setLocation(pageData.location || null);

          // Parse content - try page content first, then version content
          let contentToUse = pageData.content;
          let contentSource = 'page';

          if (!contentToUse && versionData?.content) {
            contentToUse = versionData.content;
            contentSource = 'version';
          }

          if (contentToUse) {
            try {
              const parsedContent = typeof contentToUse === 'string'
                ? JSON.parse(contentToUse)
                : contentToUse;
              console.log('📄 PageView parsed content:', {
                source: contentSource,
                type: typeof parsedContent,
                isArray: Array.isArray(parsedContent),
                length: Array.isArray(parsedContent) ? parsedContent.length : 'not array',
                firstElement: Array.isArray(parsedContent) && parsedContent.length > 0 ? parsedContent[0] : null
              });

              console.log('🔍 PageView: Setting editorState with parsed content:', {
                parsedContent,
                isArray: Array.isArray(parsedContent),
                length: Array.isArray(parsedContent) ? parsedContent.length : 'not array'
              });
              setEditorState(parsedContent);
            } catch (error) {
              console.error("Error parsing content:", error);
              setEditorState([{ type: "paragraph", children: [{ text: "Error loading content." }] }]);
            }
          } else {
            console.log('📄 PageView: No content found in page or version, using empty content');
            setEditorState([{ type: "paragraph", children: [{ text: "" }] }]);
          }

          setIsLoading(false);
        }
      }, currentAccount?.uid || null);

      unsubscribeRef.current = unsubscribe;

      // Set up fallback timeout in case Firebase listener doesn't respond
      fallbackTimeout = setTimeout(() => {
        if (!hasReceivedData) {
          logger.debug('Firebase listener timeout, trying API fallback', { pageId });
          tryApiFallback();
        }
      }, 3000); // 3 second timeout
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clearTimeout(fallbackTimeout);
    };
  }, [pageId, currentAccount?.uid, showVersion, versionId, showDiff, compareVersionId]);

  // Record page view and add to recent pages
  useEffect(() => {
    if (!viewRecorded.current && !isLoading && page && pageId) {
      viewRecorded.current = true;
      recordPageView(pageId, currentAccount?.uid);

      // Add to recent pages if user is logged in
      if (currentAccount && page) {
        // Get the correct username - prefer page.username, fallback to fetching from user profile
        const getCorrectUsername = async () => {
          // If we have a valid username that's not "Anonymous", use it
          if (page.username && page.username !== 'Anonymous') {
            return page.username;
          }

          // If it's the current user's page, use their username
          if (page.userId === currentAccount.uid && currentAccount.username) {
            return currentAccount.username;
          }

          // Otherwise, try to fetch from Firebase Realtime Database
          try {
            const { getDatabase, ref, get } = await import('firebase/database');
            const { app } = await import('../../firebase/config');

            const rtdb = getDatabase(app);
            const userRef = ref(rtdb, `users/${page.userId}`);
            const userSnapshot = await get(userRef);

            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              return userData.username || 'Anonymous';
            }
          } catch (error) {
            console.error('Error fetching username for recent page:', error);
          }

          return 'Anonymous';
        };

        getCorrectUsername().then(username => {
          addRecentPage({
            id: pageId,
            title: page.title || 'Untitled',
            userId: page.userId,
            username: username
          }).catch(error => {
            console.error('Error adding page to recent pages:', error);
          });
        });
      }
    }
  }, [isLoading, page, pageId, currentAccount?.uid, currentAccount, addRecentPage]);



  // Version loading functions
  const loadVersionData = async () => {
    try {
      const versions = await getPageVersions(pageId);
      const version = versions.find(v => v.id === versionId);

      if (version) {
        setVersionData(version);
        setPage({
          id: pageId,
          title: version.title || 'Untitled',
          userId: version.userId,

        });
        setTitle(version.title || 'Untitled');

        // Parse version content
        if (version.content) {
          try {
            const parsedContent = typeof version.content === 'string'
              ? JSON.parse(version.content)
              : version.content;
            setEditorState(parsedContent);
          } catch (error) {
            console.error("Error parsing version content:", error);
            setEditorState([{ type: "paragraph", children: [{ text: "Error loading version content." }] }]);
          }
        } else {
          setEditorState([{ type: "paragraph", children: [{ text: "This version has no content" }] }]);
        }
      } else {
        setError("Version not found");
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading version:", error);
      setError("Failed to load version");
      setIsLoading(false);
    }
  };

  const loadDiffData = async () => {
    try {
      const versions = await getPageVersions(pageId);
      const currentVersion = versions.find(v => v.id === versionId);
      const compareVersion = compareVersionId ? versions.find(v => v.id === compareVersionId) : null;

      if (currentVersion) {
        setVersionData(currentVersion);
        if (compareVersion) {
          setCompareVersionData(compareVersion);
        }

        // Generate diff content using centralized diff service
        const { calculateDiff } = await import('../../utils/diffService');
        const diffResult = await calculateDiff(
          currentVersion.content || '',
          compareVersion?.content || ''
        );

        setDiffContent(diffResult);
        setEditorState(diffResult);

        setPage({
          id: pageId,
          title: `Diff: ${currentVersion.title || 'Untitled'}`,
          userId: currentVersion.userId,

        });
        setTitle(`Diff: ${currentVersion.title || 'Untitled'}`);
      } else {
        setError("Version not found for comparison");
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading diff:", error);
      setError("Failed to load version comparison");
      setIsLoading(false);
    }
  };

  // Computed values
  const canEdit = currentAccount?.uid && !isPreviewingDeleted && !showVersion && !showDiff && (currentAccount.uid === page?.userId);
  const memoizedPage = useMemo(() => page, [page?.id, page?.title, page?.updatedAt]);
  const memoizedLinkedPageIds = useMemo(() => [], [editorState]); // TODO: Extract linked page IDs

  // Event handlers
  const handleContentChange = useCallback((content: any) => {
    setEditorState(content);
    setHasUnsavedChanges(true);
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (newTitle !== title) {
      logger.debug('Title changed', { oldTitle: title, newTitle });
    }
    setTitle(newTitle);
    setHasUnsavedChanges(true);
    setTitleError(null);
  }, [title]);



  const handleLocationChange = useCallback((newLocation: Location | null) => {
    setLocation(newLocation);
    setHasUnsavedChanges(true);
  }, []);

  const handleCustomDateChange = useCallback((newCustomDate: string | null) => {
    setCustomDate(newCustomDate);
    setHasUnsavedChanges(true);
  }, []);

  // Handle empty lines count changes
  const handleEmptyLinesChange = useCallback((count: number) => {
    setEmptyLinesCount(count);
  }, []);

  // Handle delete all empty lines
  const handleDeleteAllEmptyLines = useCallback(() => {
    if (editorRef.current && editorRef.current.deleteAllEmptyLines) {
      editorRef.current.deleteAllEmptyLines();
    }
  }, []);

  const handleSetIsEditing = useCallback((editing: boolean, position?: { x: number; y: number }) => {
    setIsEditing(editing);
    if (position) {
      setClickPosition(position);
    }
  }, []);

  const handleSave = useCallback(async () => {
    console.log('🚨 SAVE DEBUG: handleSave called', { pageId, hasPage: !!page, title });

    if (!page || !pageId) {
      console.log('🚨 SAVE DEBUG: Early return - no page or pageId');
      return;
    }

    // Validate title is not empty
    if (!title || title.trim() === '') {
      console.log('🚨 SAVE DEBUG: Early return - no title');
      setTitleError("Title is required");
      setError("Please add a title before saving");
      return;
    }

    console.log('🚨 SAVE DEBUG: Starting save process...');
    setIsSaving(true);
    setError(null);
    setTitleError(null);

    try {
      // Use API route instead of direct Firebase calls
      const contentToSave = editorState;
      const editorStateJSON = JSON.stringify(contentToSave);

      const updateData = {
        id: pageId,
        title: title.trim(),
        content: editorStateJSON,
        location: location,
        customDate: customDate
      };

      console.log('🚨 SAVE DEBUG: Calling API route with data:', { ...updateData, content: '(content omitted)' });

      const response = await fetch('/api/pages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🚨 SAVE DEBUG: API error response:', errorData);

        // Handle authentication errors specifically
        if (response.status === 401) {
          setError("Your session has expired. Please refresh the page and log in again.");
          return; // Don't throw, just show error message
        }

        throw new Error(errorData.message || `API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🚨 SAVE DEBUG: API response:', result);

      if (!result.success) {
        throw new Error(result.message || 'Failed to update page');
      }

      logger.info('Page saved successfully via API', { pageId });

      // Trigger cache invalidation to refresh daily notes and other components
      try {
        const { invalidateUserPagesCache } = await import('../../utils/cacheInvalidation');
        invalidateUserPagesCache(page?.userId);
        console.log('✅ Cache invalidation triggered after page update for user:', page?.userId);
      } catch (cacheError) {
        console.error('Error triggering cache invalidation (non-fatal):', cacheError);
      }

      setHasUnsavedChanges(false);
      setIsEditing(false);

      // Show success feedback to user
      try {
        const { toast } = await import('../../components/ui/use-toast');
        toast({
          title: "Page Saved",
          description: "Your changes have been saved successfully.",
          variant: "default"
        });
      } catch (toastError) {
        console.error('Error showing success toast (non-fatal):', toastError);
      }

      // CRITICAL FIX: Redirect to page view after successful save to prevent error boundary issues
      // This ensures the user sees the saved page instead of staying in edit mode
      setTimeout(() => {
        try {
          // Use window.location for more reliable navigation that doesn't trigger React errors
          window.location.href = `/${pageId}`;
        } catch (routerError) {
          console.error('Error during post-save redirect (non-fatal):', routerError);
          // If redirect fails, just stay on the page - it's already saved
          // Show success message to user
          setError(null);
          // Could add a success toast here if needed
        }
      }, 500); // Increased delay to ensure save is fully processed
    } catch (error) {
      console.error("Error saving page:", error);
      setError("Failed to save page. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [page, pageId, editorState, title, location]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
      if (!confirmCancel) return;
    }
    
    // Reset to original values
    setTitle(page?.title || '');
    setLocation(page?.location || '');
    setEditorState(page?.content ? JSON.parse(page.content) : [{ type: "paragraph", children: [{ text: "" }] }]);
    setHasUnsavedChanges(false);
    setIsEditing(false);
    setClickPosition(null);
  }, [hasUnsavedChanges, page]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + E to toggle edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (canEdit) {
          setIsEditing(!isEditing);
        }
      }

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isEditing && hasUnsavedChanges) {
          handleSave();
        }
      }

      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isEditing && hasUnsavedChanges) {
          handleSave();
        }
      }

      // Escape to cancel editing
      if (e.key === 'Escape' && isEditing) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, hasUnsavedChanges, handleSave, canEdit, handleCancel]);

  const handleDelete = useCallback(async () => {
    if (!page || !pageId) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this page? You'll have 30 days to recover it from your Recently Deleted pages."
    );
    if (!confirmDelete) return;

    try {
      // Use API instead of direct Firebase calls
      const response = await fetch(`/api/pages?id=${pageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`Successfully soft deleted page ${pageId}`);
        router.push('/');
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete page. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      setError("Failed to delete page. Please try again.");
    }
  }, [page, pageId, router]);

  // Loading state
  if (isLoading) {
    return (
      <PublicLayout>
        <SmartLoader
          isLoading={isLoading}
          message={`Loading page${loadAttempts > 0 ? ` (attempt ${loadAttempts + 1}/${maxLoadAttempts})` : ''}...`}
          timeoutMs={10000}
          autoRecover={true}
          onRetry={() => window.location.reload()}
        />
      </PublicLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <ErrorDisplay
            message={error}
            severity="error"
            title="Page Error"
            showRetry={true}
            onRetry={() => window.location.reload()}
          />
        </div>
      </PublicLayout>
    );
  }

  // No page found
  if (!page) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
            <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
            <Button onClick={() => router.push('/')} className="mt-4">
              Go Home
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PageProvider>
        <div className="w-full max-w-none box-border">
          <PageHeader
            title={title}
            username={page?.username}
            userId={page?.userId}
            isLoading={isLoading}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onTitleChange={handleTitleChange}
            canEdit={canEdit}
            titleError={!!titleError}
            pageId={pageId}
          />
          
          {isPreviewingDeleted && (
            <DeletedPageBanner 
              pageId={pageId}
              deletedAt={page.deletedAt}
            />
          )}

          <div
            className="animate-in fade-in-0 duration-300 w-full pb-32 max-w-none box-border"
            style={{
              paddingTop: isEditing ? '1rem' : 'calc(var(--page-header-height, 140px) + 0.5rem)', // No extra padding in edit mode since header is not fixed
              transition: 'padding-top 300ms ease-in-out'
            }}
          >
            <TextSelectionProvider
              contentRef={contentRef}
              enableCopy={true}
              enableShare={true}
              enableAddToPage={true}
              username={currentAccount?.username}
            >
              <div ref={contentRef}>
                <TextViewErrorBoundary fallbackContent={
                  <div className="p-4 text-muted-foreground">
                    <p>Unable to display page content. The page may have formatting issues.</p>
                    <p className="text-sm mt-2">Page ID: {page.id}</p>
                  </div>
                }>
                  {console.log('🔍 PageView: Rendering decision - isEditing:', isEditing, 'showVersion:', showVersion, 'showDiff:', showDiff)}
                  {isEditing ? (
                    <Editor
                      ref={editorRef}
                      title={title}
                      setTitle={handleTitleChange}
                      initialContent={editorState}
                      onChange={handleContentChange}
                      onEmptyLinesChange={handleEmptyLinesChange}

                      location={location}
                      setLocation={handleLocationChange}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      onDelete={canEdit ? handleDelete : null}
                      isSaving={isSaving}
                      error={error || ""}
                      isNewPage={false}
                      placeholder="Start typing..."
                      showToolbar={true}
                    />
                  ) : (
                    <>
                      {console.log('🔍 PageView: NOT in editing mode, about to render TextView')}
                      {console.log('🔍 PageView: About to render TextView with editorState:', {
                        editorState,
                        editorStateType: typeof editorState,
                        isArray: Array.isArray(editorState),
                        length: Array.isArray(editorState) ? editorState.length : editorState?.length || 0,
                        pageId: page.id,
                        hasContent: !!editorState
                      })}
                      <TextView
                        key={`textview-${page.id}-${showVersion ? 'version' : showDiff ? 'diff' : 'normal'}`}
                        content={editorState?.content || editorState}
                        page={page}
                        canEdit={canEdit}
                        setIsEditing={handleSetIsEditing}
                        user={currentAccount}
                        contentType="wiki"
                        isEditing={false}
                        showDiff={showDiff}
                        viewMode={showDiff ? "diff" : "normal"}
                      />
                    </>
                  )}
                </TextViewErrorBoundary>

                {/* Custom Date Field and Location Field are now handled by PageFooter */}

                <UnifiedTextHighlighter
                  contentRef={contentRef}
                  showNotification={true}
                  autoScroll={true}
                />
              </div>
            </TextSelectionProvider>

            {/* Page Footer with actions */}
            <PageFooter
              page={memoizedPage}
              linkedPageIds={memoizedLinkedPageIds}
              isEditing={isEditing}
              canEdit={canEdit}
              isOwner={canEdit} // Add isOwner prop - same logic as canEdit for ownership
              title={title}

              location={location}
              onTitleChange={handleTitleChange}
              onLocationChange={handleLocationChange}
              onSave={handleSave}
              onCancel={handleCancel}
              onDelete={handleDelete}
              setIsEditing={setIsEditing} // Fix: Pass setIsEditing instead of onEdit
              isSaving={isSaving}
              error={error}
              titleError={titleError}
              hasUnsavedChanges={hasUnsavedChanges}
            />

            {/* Backlinks and Related Pages */}
            {page && !isEditing && (
              <>
                <BacklinksSection page={page} linkedPageIds={memoizedLinkedPageIds} />
                <RelatedPagesSection
                  page={page}
                  linkedPageIds={memoizedLinkedPageIds}
                />

                {/* Page Graph View */}
                <PageGraphView
                  pageId={page.id}
                  pageTitle={page.title}
                />
              </>
            )}
          </div>

          {/* Pledge Bar - Always floating at bottom */}
          {page && !isEditing && (
            <PledgeBar
              pageId={page.id}
              pageTitle={page.title}
              authorId={page.userId}
              visible={true}
            />
          )}

          {/* Empty Lines Alert - Shows when editing and there are empty lines */}
          {isEditing && (
            <EmptyLinesAlert
              emptyLinesCount={emptyLinesCount}
              onDeleteAllEmptyLines={handleDeleteAllEmptyLines}
            />
          )}
        </div>
      </PageProvider>
    </PublicLayout>
  );
}