"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
// Firebase imports removed - using Firestore instead of Realtime Database
import { listenToPageById, getPageById } from "../../firebase/database";
import { getPageVersions, getPageVersionById } from "../../services/versionService";
import { recordPageView } from "../../firebase/pageViews";
import { trackPageViewWhenReady } from "../../utils/analytics-page-titles";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { DataContext } from "../../providers/DataProvider";
import { TextSelectionProvider } from "../../providers/TextSelectionProvider";
import { PageProvider } from "../../contexts/PageContext";
import { useRecentPages } from "../../contexts/RecentPagesContext";
import { useLineSettings } from "../../contexts/LineSettingsContext";
import logger, { createLogger } from '../../utils/logger';

// UI Components
import PublicLayout from "../layout/PublicLayout";
import PageHeader from "./PageHeader";
import PageFooter from "./PageFooter";
import PledgeBar from "../payments/PledgeBar";
import RelatedPagesSection from "../features/RelatedPagesSection";
import PageGraphView from "./PageGraphView";
import DeletedPageBanner from "../utils/DeletedPageBanner";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import TextViewErrorBoundary from "../editor/TextViewErrorBoundary";
import TextView from "../editor/TextView";
import { SmartLoader } from "../ui/smart-loader";
import { ErrorDisplay } from "../ui/error-display";
import { Button } from "../ui/button";
import { LineSettingsMenu } from "../utils/LineSettingsMenu";

// Editor Components
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
  const [isEditing, setIsEditing] = useState(false); // MY page = always true, NOT my page = always false
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Debug logging for hasUnsavedChanges state
  useEffect(() => {
    console.log('🔍 UNSAVED CHANGES: hasUnsavedChanges state changed to:', hasUnsavedChanges);
  }, [hasUnsavedChanges]);
  const [title, setTitle] = useState('');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [versionData, setVersionData] = useState<any>(null);
  const [compareVersionData, setCompareVersionData] = useState<any>(null);
  const [diffContent, setDiffContent] = useState<any>(null);
  const [contentPaddingTop, setContentPaddingTop] = useState<string>('2rem');

  // Empty lines tracking for alert banner
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Refs
  const editorRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRecorded = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const graphRefreshRef = useRef<(() => void) | null>(null);

  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentAccount } = useCurrentAccount();
  const { addRecentPage } = useRecentPages();

  // Logger
  const pageLogger = createLogger('PageView');

  // Callback to capture graph refresh function
  const handleGraphRefreshReady = useCallback((refreshFn: () => void) => {
    graphRefreshRef.current = refreshFn;
  }, []);

  // Constants
  const maxLoadAttempts = 3;
  const isPreviewingDeleted = searchParams?.get('preview') === 'deleted';

  // API fallback function
  const tryApiFallback = useCallback(async () => {
    try {
      pageLogger.debug('Trying API fallback for page load', { pageId });
      const result = await getPageById(pageId, currentAccount?.uid);

      if (result.error) {
        pageLogger.warn('API fallback failed', { error: result.error, pageId });
        setError(result.error);
        setIsLoading(false);
      } else if (result.pageData) {
        pageLogger.debug('API fallback successful', { pageId });
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
            pageLogger.error('Failed to parse content from API fallback', { parseError });
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
        pageLogger.warn('API fallback returned no data', { pageId });
        setError('Page not found');
        setIsLoading(false);
      }
    } catch (error) {
      pageLogger.error('API fallback error', { error, pageId });
      setError('Failed to load page');
      setIsLoading(false);
    }
  }, [pageId, currentAccount?.uid]);

  // Handle params Promise
  useEffect(() => {
    if (params && typeof params.then === 'function') {
      pageLogger.debug('Resolving params Promise');
      params.then((resolvedParams) => {
        setPageId(resolvedParams.id || '');
        pageLogger.debug('Params resolved', { id: resolvedParams.id });
      });
    } else if (unwrappedParams) {
      setPageId(unwrappedParams.id || '');
      pageLogger.debug('Using unwrapped params', { id: unwrappedParams.id });
    }
  }, [params, unwrappedParams]);

  // Page loading effect
  useEffect(() => {
    if (!pageId) {
      pageLogger.debug('No pageId provided');
      return;
    }

    pageLogger.debug('Starting page load', { pageId, userId: currentAccount?.uid });
    setIsLoading(true);
    setError(null);

    // Declare fallbackTimeout in the proper scope
    let fallbackTimeout: NodeJS.Timeout;

    // If showing version or diff, load version data instead of live page
    if (showVersion && versionId) {
      pageLogger.debug('Loading version data', { versionId });
      loadVersionData();
    } else if (showDiff && versionId) {
      pageLogger.debug('Loading diff data', { versionId });
      loadDiffData();
    } else {
      pageLogger.debug('Setting up page loading with API fallback', { pageId });

      // In development, use API fallback immediately due to Firestore connectivity issues
      if (process.env.NODE_ENV === 'development') {
        pageLogger.debug('Development mode detected, using API fallback immediately', { pageId });
        tryApiFallback();
        return;
      }

      // Try Firebase listener first, with aggressive fallback to API
      let hasReceivedData = false;

      // Set up Firebase listener for live page
      const unsubscribe = listenToPageById(pageId, (data) => {
        if (data.error) {
          pageLogger.warn('Page load error', { error: data.error, pageId });
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
            pageLogger.debug('Firebase listener failed, trying API fallback', { pageId });
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
            pageLogger.debug('Title updated from page data', {
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
              console.log('🔍 PAGE LOAD: Raw content before parsing:', {
                contentToUse,
                type: typeof contentToUse,
                length: typeof contentToUse === 'string' ? contentToUse.length : 'not string',
                contentSource,
                pageLastModified: page?.lastModified,
                versionTimestamp: versionData?.timestamp
              });

              const parsedContent = typeof contentToUse === 'string'
                ? JSON.parse(contentToUse)
                : contentToUse;

              console.log('📄 PageView parsed content:', {
                source: contentSource,
                type: typeof parsedContent,
                isArray: Array.isArray(parsedContent),
                length: Array.isArray(parsedContent) ? parsedContent.length : 'not array',
                firstElement: Array.isArray(parsedContent) && parsedContent.length > 0 ? parsedContent[0] : null,
                fullContent: parsedContent
              });

              // Validate that we have proper content structure
              if (!Array.isArray(parsedContent)) {
                console.warn('📄 PageView: Content is not an array, converting to array format');
                if (typeof parsedContent === 'string') {
                  // Legacy string content
                  setEditorState([{ type: "paragraph", children: [{ text: parsedContent }] }]);
                } else if (parsedContent && typeof parsedContent === 'object') {
                  // Try to extract text from object
                  const text = parsedContent.text || parsedContent.content || JSON.stringify(parsedContent);
                  setEditorState([{ type: "paragraph", children: [{ text }] }]);
                } else {
                  // Fallback
                  setEditorState([{ type: "paragraph", children: [{ text: "Content format not recognized" }] }]);
                }
              } else {
                console.log('🔍 PageView: Setting editorState with parsed content array');
                setEditorState(parsedContent);
              }
            } catch (error) {
              console.error("📄 PageView: Error parsing content:", error, { contentToUse });
              // Try to use raw content as text if JSON parsing fails
              if (typeof contentToUse === 'string') {
                console.log('📄 PageView: Using raw string content as fallback');
                setEditorState([{ type: "paragraph", children: [{ text: contentToUse }] }]);
              } else {
                setEditorState([{ type: "paragraph", children: [{ text: "Error loading content - please refresh the page" }] }]);
              }
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
          pageLogger.debug('Firebase listener timeout, trying API fallback', { pageId });
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

  // BULLETPROOF EDIT MODE LOGIC:
  // MY page = ALWAYS edit mode
  // NOT my page = ALWAYS view mode
  useEffect(() => {
    if (canEdit && !showVersion && !showDiff) {
      // This is MY page - ALWAYS edit mode
      setIsEditing(true);
    } else {
      // This is NOT my page OR showing version/diff - ALWAYS view mode
      setIsEditing(false);
    }
  }, [canEdit, showVersion, showDiff]);

  // Content padding: none for edit mode (static header), fixed for view mode (fixed header)
  useEffect(() => {
    if (isEditing) {
      setContentPaddingTop('0'); // Edit mode: header is static, no padding needed
    } else {
      setContentPaddingTop('160px'); // View mode: header is fixed, need padding
    }
  }, [isEditing]);

  // Event handlers
  const handleContentChange = useCallback((content: any) => {
    console.log('🔍 CONTENT CHANGE: handleContentChange called', {
      hasContent: !!content,
      contentType: typeof content,
      contentLength: content ? content.length : 0,
      hasPageContent: !!page?.content
    });

    setEditorState(content);

    // Only set unsaved changes if content actually differs from original
    const originalContent = page?.content ? JSON.parse(page.content) : [];
    const contentChanged = JSON.stringify(content) !== JSON.stringify(originalContent);

    console.log('🔍 CONTENT CHANGE: Comparing content', {
      originalContentLength: originalContent.length,
      newContentLength: content ? content.length : 0,
      contentChanged,
      originalSample: JSON.stringify(originalContent).substring(0, 100),
      newSample: content ? JSON.stringify(content).substring(0, 100) : 'null'
    });

    if (contentChanged) {
      console.log('✅ CONTENT CHANGE: Setting hasUnsavedChanges to true');
      setHasUnsavedChanges(true);
    } else {
      console.log('⚪ CONTENT CHANGE: No changes detected, not setting hasUnsavedChanges');
    }
  }, [page?.content]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (newTitle !== title) {
      pageLogger.debug('Title changed', { oldTitle: title, newTitle });
    }
    setTitle(newTitle);

    // Only set unsaved changes if title actually differs from original page title
    if (newTitle !== (page?.title || '')) {
      setHasUnsavedChanges(true);
    }
    setTitleError(null);
  }, [title, page?.title]);



  const handleLocationChange = useCallback((newLocation: Location | null) => {
    setLocation(newLocation);

    // Only set unsaved changes if location actually differs from original
    const originalLocation = page?.location || null;
    const locationChanged = JSON.stringify(newLocation) !== JSON.stringify(originalLocation);

    if (locationChanged) {
      setHasUnsavedChanges(true);
    }
  }, [page?.location]);

  const handleCustomDateChange = useCallback((newCustomDate: string | null) => {
    setCustomDate(newCustomDate);

    // Only set unsaved changes if custom date actually differs from original
    const originalCustomDate = page?.customDate || null;

    if (newCustomDate !== originalCustomDate) {
      setHasUnsavedChanges(true);
    }
  }, [page?.customDate]);

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

  // No need for handleSetIsEditing - always in edit mode

  const handleSave = useCallback(async (passedContent?: any) => {
    console.log('🔵 PAGE SAVE: Save initiated', {
      pageId,
      hasPage: !!page,
      title,
      editorStateLength: editorState ? editorState.length : 0,
      editorStateType: typeof editorState,
      editorStateSample: editorState ? JSON.stringify(editorState).substring(0, 200) : 'null',
      passedContentLength: passedContent ? passedContent.length : 0,
      passedContentType: typeof passedContent
    });


    pageLogger.info('Page save initiated', { pageId, hasPage: !!page, title });

    if (!page || !pageId) {
      console.error('🔴 PAGE SAVE: Save aborted - no page or pageId', { pageId, hasPage: !!page });
      pageLogger.warn('Save aborted - no page or pageId', { pageId, hasPage: !!page });
      return;
    }

    // Validate title is not empty
    if (!title || title.trim() === '') {
      console.error('🔴 PAGE SAVE: Save aborted - no title provided', { pageId });
      pageLogger.warn('Save aborted - no title provided', { pageId });
      setTitleError("Title is required");
      setError("Please add a title before saving");
      return;
    }

    console.log('🔵 PAGE SAVE: Starting page save process', {
      pageId,
      title,
      contentType: typeof editorState,
      contentLength: editorState ? editorState.length : 0
    });
    pageLogger.info('Starting page save process', { pageId, title });
    setIsSaving(true);
    setError(null);
    setTitleError(null);

    try {
      // Use API route instead of direct Firebase calls
      const contentToSave = editorState;
      console.log('🔵 PAGE SAVE: Content to save prepared', {
        contentToSaveType: typeof contentToSave,
        contentToSaveLength: contentToSave ? contentToSave.length : 0,
        contentToSaveSample: contentToSave ? JSON.stringify(contentToSave).substring(0, 200) : 'null'
      });

      const updateData = {
        id: pageId,
        title: title.trim(),
        content: contentToSave, // Pass as object, not stringified - API will handle stringification
        location: location,
        customDate: customDate
      };

      console.log('🔵 PAGE SAVE: Update data prepared', {
        id: updateData.id,
        title: updateData.title,
        hasContent: !!updateData.content,
        contentType: typeof updateData.content,
        contentLength: updateData.content ? JSON.stringify(updateData.content).length : 0,
        hasLocation: !!updateData.location,
        customDate: updateData.customDate
      });

      pageLogger.debug('API request: PUT /api/pages', {
        pageId: pageId,
        title,
        hasContent: !!contentToSave,
        contentLength: contentToSave ? JSON.stringify(contentToSave).length : 0
      });

      console.log('🔵 PAGE SAVE: Making API request to /api/pages');
      const response = await fetch('/api/pages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('🔵 PAGE SAVE: API response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        console.error('🔴 PAGE SAVE: API response not ok', {
          status: response.status,
          statusText: response.statusText
        });

        let errorData = {};
        try {
          errorData = await response.json();
          console.error('🔴 PAGE SAVE: Error response data', errorData);
        } catch (parseError) {
          console.error('🔴 PAGE SAVE: Failed to parse error response', parseError);
        }

        pageLogger.error('API response error: PUT /api/pages', { status: response.status, error: errorData });

        // Handle authentication errors specifically
        if (response.status === 401) {
          console.error('🔴 PAGE SAVE: Authentication error - attempting to refresh auth');

          // Try to refresh the authentication
          try {
            const { getAuth } = await import('firebase/auth');
            const auth = getAuth();
            const user = auth.currentUser;

            if (user) {
              console.log('🔄 PAGE SAVE: Refreshing auth token');
              const newToken = await user.getIdToken(true); // Force refresh

              // Create new session cookie
              const sessionResponse = await fetch('/api/create-session-cookie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: newToken })
              });

              if (sessionResponse.ok) {
                console.log('✅ PAGE SAVE: Auth refreshed, retrying save');
                // Retry the save operation
                const retryResponse = await fetch('/api/pages', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updateData),
                });

                if (retryResponse.ok) {
                  console.log('✅ PAGE SAVE: Retry successful');
                  // Continue with normal success flow
                  const responseData = await retryResponse.json();
                  console.log('✅ PAGE SAVE: Page saved successfully via API (after retry)', { pageId });
                  // Skip to success handling
                  setHasUnsavedChanges(false);
                  setError(null);
                  return;
                }
              }
            }
          } catch (refreshError) {
            console.error('🔴 PAGE SAVE: Auth refresh failed:', refreshError);
          }

          setError("Your session has expired. Please refresh the page and log in again.");
          return; // Don't throw, just show error message
        }

        const errorMessage = errorData.message || `API request failed: ${response.status} ${response.statusText}`;
        console.error('🔴 PAGE SAVE: Throwing error', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('🔵 PAGE SAVE: Parsing successful response');
      const result = await response.json();
      console.log('🔵 PAGE SAVE: Response parsed successfully', {
        success: result.success,
        hasData: !!result.data,
        message: result.message,
        resultKeys: Object.keys(result)
      });

      pageLogger.debug('API response success: PUT /api/pages', { status: response.status, result });

      if (!result.success) {
        console.error('🔴 PAGE SAVE: Result indicates failure', result);
        throw new Error(result.message || 'Failed to update page');
      }

      console.log('✅ PAGE SAVE: Page saved successfully via API', { pageId });
      pageLogger.info('Page saved successfully via API', { pageId });

      // CRITICAL: Update local page state with saved content to fix comparison logic
      console.log('🔍 PAGE SAVE: Updating local page state with saved content');
      if (page) {
        const updatedPage = {
          ...page,
          content: JSON.stringify(contentToSave), // Store as string like it comes from DB
          title: title.trim(),
          location: location,
          customDate: customDate,
          lastModified: new Date().toISOString()
        };
        setPage(updatedPage);
        console.log('✅ PAGE SAVE: Local page state updated');
      }

      // Emit page save event for real-time updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pageSaved', {
          detail: { pageId, title: title.trim(), content: contentToSave }
        }));
        console.log('✅ PAGE SAVE: pageSaved event emitted for real-time updates');
      }

      // CRITICAL: Clear all caches to ensure updated content is loaded
      console.log('🔍 PAGE SAVE: Clearing all caches for page', { pageId });

      // Clear localStorage and sessionStorage caches
      if (typeof window !== 'undefined') {
        const cacheKeys = [
          `page_${pageId}_${currentAccount?.uid || 'public'}`,
          `page_${pageId}_public`,
          `page_${pageId}_undefined`,
          `cache_page_${pageId}`,
          `cache_page_${pageId}_${currentAccount?.uid}`
        ];
        cacheKeys.forEach(key => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
        console.log('🔍 PAGE SAVE: Browser cache cleared for keys', cacheKeys);
      }

      // Trigger cache invalidation to refresh daily notes and other components
      try {
        const { invalidateUserPagesCache } = await import('../../utils/cacheInvalidation');
        invalidateUserPagesCache(page?.userId);
        console.log('✅ Cache invalidation triggered after page update for user:', page?.userId);
      } catch (cacheError) {
        console.error('Error triggering cache invalidation (non-fatal):', cacheError);
      }

      console.log('🔍 PAGE SAVE: Resetting hasUnsavedChanges to false');
      setHasUnsavedChanges(false);
      // Keep isEditing true - ALWAYS edit mode

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

      // Clear unsaved changes flag and stay in always-editable mode
      pageLogger.info('Page saved successfully', { pageId, title });
      setHasUnsavedChanges(false);
      setError(null);

      // Clear version cache to ensure fresh data
      const { clearPageVersionCache } = await import('../../services/versionService');
      clearPageVersionCache(pageId);

      // Page connections will refresh automatically via the pageSaved event
      // No manual refresh needed since we now have real-time updates

      // REMOVED: Page reload was causing issues with subsequent saves
      // The content should update automatically without needing a reload

      // Page data should already be updated after save
      // No need to reload since the save operation updates the page state
    } catch (error) {
      pageLogger.error('Page save failed', { pageId, error: error.message, title });
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
    // Keep isEditing true - ALWAYS edit mode
    setClickPosition(null);
  }, [hasUnsavedChanges, page]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + E removed - always in edit mode

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
            className="animate-in fade-in-0 duration-300 w-full pb-32 max-w-none box-border px-4"
            style={{
              paddingTop: contentPaddingTop,
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
                  {console.log('🔍 PageView: Rendering content - canEdit:', canEdit, 'isEditing:', isEditing, 'showVersion:', showVersion, 'showDiff:', showDiff)}

                  {/* Use Editor only when user is actively editing their own content */}
                  {canEdit && isEditing ? (
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
                      onDelete={handleDelete}
                      isSaving={isSaving}
                      error={error || ""}
                      isNewPage={false}
                      placeholder="Start typing..."
                      showToolbar={false}
                      readOnly={false}
                    />
                  ) : (
                    /* Use TextView for viewing content (other users' pages or when not editing) */
                    <TextView
                      content={editorState}
                      viewMode="normal"
                      // setIsEditing removed - no manual edit mode toggling allowed
                      canEdit={canEdit}
                      showDiff={showDiff}
                      isEditing={false}
                      showLineNumbers={true}
                    />
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
              content={editorState}
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
              // setIsEditing removed - no manual edit mode toggling allowed
              isSaving={isSaving}
              error={error}
              titleError={titleError}
              hasUnsavedChanges={hasUnsavedChanges}
            />

            {/* Page Connections and Related Pages - show for all pages */}
            {page && (
              <>
                {/* Page Graph View */}
                <PageGraphView
                  pageId={page.id}
                  pageTitle={page.title}
                  onRefreshReady={handleGraphRefreshReady}
                />

                <RelatedPagesSection
                  page={page}
                  linkedPageIds={memoizedLinkedPageIds}
                />
              </>
            )}
          </div>

          {/* Pledge Bar - Only shows on other users' pages */}
          {page && (
            <PledgeBar
              pageId={page.id}
              pageTitle={page.title}
              authorId={page.userId}
              visible={true}
            />
          )}

          {/* Empty Lines Alert - Shows when page is editable and there are empty lines */}
          {canEdit && !showVersion && !showDiff && (
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