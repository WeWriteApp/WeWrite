"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
// Firebase imports removed - using Firestore instead of Realtime Database
import { listenToPageById, getPageById } from "../../firebase/database";
import { getPageVersions, getPageVersionById } from "../../services/versionService";
import { recordPageView } from "../../firebase/pageViews";
import { trackPageViewWhenReady } from "../../utils/analytics-page-titles";
import { useAuth } from '../../providers/AuthProvider';
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
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import TextViewErrorBoundary from "../editor/TextViewErrorBoundary";
import TextView from "../editor/TextView";

import DenseModeToggle from "../viewer/DenseModeToggle";
import UnifiedLoader from "../ui/unified-loader";
import { ErrorDisplay } from "../ui/error-display";
import { LineSettingsMenu } from "../utils/LineSettingsMenu";
import StickySaveHeader from "../layout/StickySaveHeader";

// Duplicate title checking imports
import { TitleValidationInput } from "../forms/TitleValidationInput";

// Content Display Components - Unified system
const ContentDisplay = dynamic(() => import("../content/ContentDisplay"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center">
      <div className="animate-pulse">Loading content...</div>
    </div>
  )
});
import EmptyLinesAlert from "../editor/EmptyLinesAlert";
import PageActions from "./PageActions";
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
  const [saveSuccess, setSaveSuccess] = useState(false);
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
  // Removed complex loading timeout logic - using UnifiedLoader now
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [versionData, setVersionData] = useState<any>(null);
  const [compareVersionData, setCompareVersionData] = useState<any>(null);
  const [diffContent, setDiffContent] = useState<any>(null);
  const [contentPaddingTop, setContentPaddingTop] = useState<string>('2rem');

  // Empty lines tracking for alert banner
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Link insertion trigger function
  const [linkInsertionTrigger, setLinkInsertionTrigger] = useState<(() => void) | null>(null);

  // Title validation state
  const [isTitleValid, setIsTitleValid] = useState<boolean>(true);
  const [isTitleDuplicate, setIsTitleDuplicate] = useState<boolean>(false);
  const [originalTitle, setOriginalTitle] = useState<string>('');

  // Refs
  const editorRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRecorded = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const graphRefreshRef = useRef<(() => void) | null>(null);

  // Focus state management - coordinate with title focus
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { addRecentPage } = useRecentPages();

  // Logger
  const pageLogger = createLogger('PageView');

  // Callback to capture graph refresh function
  const handleGraphRefreshReady = useCallback((refreshFn: () => void) => {
    graphRefreshRef.current = refreshFn;
  }, []);

  // Constants - simplified loading approach
  const isPreviewingDeleted = searchParams?.get('preview') === 'deleted';

  // Listen for focus changes to coordinate with title focus
  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement;

      // Check if the editor or content area is focused
      const editorElement = document.querySelector('[contenteditable="true"]');
      const contentContainer = contentRef.current;

      const isEditorActive = editorElement && (
        activeElement === editorElement ||
        editorElement.contains(activeElement) ||
        (contentContainer && contentContainer.contains(activeElement))
      );

      setIsEditorFocused(!!isEditorActive);

      // Remove title-focused class when editor is focused
      if (isEditorActive) {
        document.body.classList.remove('title-focused');
      }
    };

    // Listen for focus events on the document
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

  // API fallback function
  const tryApiFallback = useCallback(async () => {
    try {
      pageLogger.debug('Trying API fallback for page load', { pageId });
      const result = await getPageById(pageId, user?.uid);

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
        setOriginalTitle(pageData.title || '');
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
              recordPageView(pageData.id, user?.uid || null);
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
  }, [pageId, user?.uid]);

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

    pageLogger.debug('Starting page load', { pageId, userId: user?.uid });
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
          setOriginalTitle(pageData.title || '');
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
      }, user?.uid || null);

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
  }, [pageId, user?.uid, showVersion, versionId, showDiff, compareVersionId]);

  // Record page view and add to recent pages
  useEffect(() => {
    if (!viewRecorded.current && !isLoading && page && pageId) {
      viewRecorded.current = true;
      recordPageView(pageId, user?.uid);

      // Add to recent pages if user is logged in
      if (user && page) {
        // Get the correct username - prefer page.username, fallback to fetching from user profile
        const getCorrectUsername = async () => {
          // If we have a valid username that's not "Anonymous", use it
          if (page.username && page.username !== 'Anonymous') {
            return page.username;
          }

          // If it's the current user's page, use their username
          if (page.userId === user.uid && user.username) {
            return user.username;
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
  }, [isLoading, page, pageId, user?.uid, user, addRecentPage]);



  // Version loading functions
  const loadVersionData = async () => {
    try {
      console.log('Loading version data for pageId:', pageId, 'versionId:', versionId);

      // Use the new API-based version service
      const response = await fetch(`/api/pages/${pageId}/versions?limit=50&includeNoOp=false`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const versions = result.data?.versions || result.versions || [];
        console.log('Found versions:', versions.length);
        const version = versions.find(v => v.id === versionId);

        if (version) {
          console.log('Found version:', version);
          setVersionData(version);
          setPage({
            id: pageId,
            title: version.title || 'Untitled',
            userId: version.userId,
            username: version.username,
            createdAt: version.createdAt,
            lastModified: version.createdAt,
            isPublic: false, // Assume private for versions
            deleted: false
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
          console.error("Version not found in versions list");
          setError("Version not found");
        }
      } else {
        console.error("API response not ok:", response.status);
        setError("Failed to load version");
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
      console.log('Loading diff data for pageId:', pageId, 'versionId:', versionId, 'compareVersionId:', compareVersionId);

      // Use the new API-based version service
      const response = await fetch(`/api/pages/${pageId}/versions?limit=50&includeNoOp=false`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const versions = result.data?.versions || result.versions || [];
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
            username: currentVersion.username,
            createdAt: currentVersion.createdAt,
            lastModified: currentVersion.createdAt,
            isPublic: false,
            deleted: false
          });
          setTitle(`Diff: ${currentVersion.title || 'Untitled'}`);
        } else {
          setError("Version not found for comparison");
        }
      } else {
        setError("Failed to load versions for comparison");
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading diff:", error);
      setError("Failed to load version comparison");
      setIsLoading(false);
    }
  };

  // Computed values
  const canEdit = user?.uid && !isPreviewingDeleted && !showVersion && !showDiff && (user.uid === page?.userId);

  // Debug canEdit logic
  console.log('🔗 PAGE_VIEW: canEdit calculation:', {
    userUid: user?.uid,
    pageUserId: page?.userId,
    isPreviewingDeleted,
    showVersion,
    showDiff,
    userOwnsPage: user?.uid === page?.userId,
    finalCanEdit: canEdit
  });
  const memoizedPage = useMemo(() => page, [page?.id, page?.title, page?.updatedAt]);
  const memoizedLinkedPageIds = useMemo(() => [], [editorState]); // TODO: Extract linked page IDs

  // BULLETPROOF EDIT MODE LOGIC:
  // MY page = ALWAYS edit mode
  // NOT my page = ALWAYS view mode
  useEffect(() => {
    console.log('🔗 PAGE_VIEW: Setting edit mode based on permissions:', {
      canEdit,
      showVersion,
      showDiff,
      willBeEditing: canEdit && !showVersion && !showDiff
    });

    if (canEdit && !showVersion && !showDiff) {
      // This is MY page - ALWAYS edit mode
      console.log('🔗 PAGE_VIEW: Entering edit mode');
      setIsEditing(true);
    } else {
      // This is NOT my page OR showing version/diff - ALWAYS view mode
      console.log('🔗 PAGE_VIEW: Staying in view mode');
      setIsEditing(false);
    }
  }, [canEdit, showVersion, showDiff]);

  // Handle link insertion request - memoized to prevent infinite loops
  const handleInsertLinkRequest = useCallback((triggerFn) => {
    setLinkInsertionTrigger(() => triggerFn);
  }, []);

  // Track scroll position for save header behavior
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // SIMPLIFIED: Remove complex padding logic - let body padding handle everything
  useEffect(() => {
    if (isEditing) {
      setContentPaddingTop('0px'); // No padding needed - body handles save header
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
  }, [title, page?.title, pageLogger]);

  // Handle title validation changes from the validation component
  const handleTitleValidationChange = useCallback((isValid: boolean, isDuplicate: boolean) => {
    console.log('🔍 PAGEVIEW_VALIDATION: Title validation changed:', { isValid, isDuplicate, title });
    setIsTitleValid(isValid);
    setIsTitleDuplicate(isDuplicate);
  }, [title]);



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

  // Helper function to extract new page references from content
  const extractNewPageReferences = (content: any[]): Array<{pageId: string, title: string}> => {
    const newPages: Array<{pageId: string, title: string}> = [];

    const processNode = (node: any) => {
      if (node.type === 'link' && node.isNew && node.pageId && node.pageTitle) {
        newPages.push({
          pageId: node.pageId,
          title: node.pageTitle
        });
      }

      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    content.forEach(processNode);
    return newPages;
  };

  // Helper function to create new pages referenced in links
  const createNewPagesFromLinks = async (newPageRefs: Array<{pageId: string, title: string}>): Promise<void> => {
    if (!user?.uid || newPageRefs.length === 0) return;

    console.log('🔵 PAGE SAVE: Creating new pages from links:', newPageRefs);

    for (const pageRef of newPageRefs) {
      try {
        const pageData = {
          title: pageRef.title,
          content: JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }]), // Empty content
          userId: user.uid,
          username: user.username || user.displayName || 'Anonymous',
          lastModified: new Date().toISOString(),
          isReply: false,
          groupId: null,
          customDate: null
        };

        const response = await fetch('/api/pages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pageData),
          credentials: 'include'
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ PAGE SAVE: Created new page from link:', { title: pageRef.title, id: result.id });
        } else {
          console.error('🔴 PAGE SAVE: Failed to create new page from link:', pageRef.title);
        }
      } catch (error) {
        console.error('🔴 PAGE SAVE: Error creating new page from link:', error);
      }
    }
  };

  const handleSave = useCallback(async (passedContent?: any) => {
    console.log('🔵 PAGE SAVE: Save initiated', {
      pageId,
      hasPage: !!page,
      title,
      editorStateLength: editorState ? editorState.length : 0
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

    // Check for duplicate titles before saving
    if (isTitleDuplicate) {
      console.log('🔴 PAGE_EDIT: Cannot save - duplicate title detected');
      setTitleError("Cannot save page with duplicate title. Please choose a different title or go to the existing page.");
      setError("Cannot save page with duplicate title. Please choose a different title or go to the existing page.");
      setIsSaving(false);
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

      // Extract and create new pages referenced in links before saving the main page
      const newPageRefs = extractNewPageReferences(contentToSave);
      if (newPageRefs.length > 0) {
        console.log('🔵 PAGE SAVE: Found new page references, creating them first:', newPageRefs);
        await createNewPagesFromLinks(newPageRefs);
      }

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
        credentials: 'include'
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

        // Simplified LogRocket error logging (reduced to prevent performance issues)
        try {
          const { logRocketService } = await import('../../utils/logrocket');
          if (logRocketService.isReady) {
            logRocketService.logApiError('/api/pages', 'PUT', response.status, errorData?.message || 'API Error');
          }
        } catch (logRocketError) {
          // Silently fail to prevent performance issues
        }

        pageLogger.error('API response error: PUT /api/pages', { status: response.status, error: errorData });

        // Handle authentication errors specifically
        if (response.status === 401) {
          console.error('🔴 PAGE SAVE: Authentication error - attempting to refresh user');

          // Try to refresh the user using the API-based approach
          try {
            console.log('🔄 PAGE SAVE: Attempting user refresh via API');

            // First, try to refresh the user using the user API
            const sessionRefreshResponse = await fetch('/api/auth/user', {
              method: 'GET',
              credentials: 'include'
            });

            if (sessionRefreshResponse.ok) {
              console.log('✅ PAGE SAVE: Session refreshed via API, retrying save');

              // Retry the save operation
              const retryResponse = await fetch('/api/pages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
                credentials: 'include'
              });

              if (retryResponse.ok) {
                console.log('✅ PAGE SAVE: Retry successful after user refresh');
                const responseData = await retryResponse.json();
                console.log('✅ PAGE SAVE: Page saved successfully via API (after user refresh)', { pageId });
                // Skip to success handling
                setHasUnsavedChanges(false);
                setError(null);
                return;
              } else {
                console.error('🔴 PAGE SAVE: Retry failed after user refresh:', retryResponse.status);
              }
            } else {
              console.log('🔄 PAGE SAVE: Session API refresh failed, trying Firebase token refresh');

              // Fallback to Firebase token refresh
              const { getAuth } = await import('firebase/auth');
              const auth = getAuth();
              const user = auth.currentUser;

              if (user) {
                console.log('🔄 PAGE SAVE: Refreshing Firebase auth token');
                const newToken = await user.getIdToken(true); // Force refresh

                // Create new user cookie
                const sessionResponse = await fetch('/api/create-user-cookie', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: newToken }),
                  credentials: 'include'
                });

                if (sessionResponse.ok) {
                  console.log('✅ PAGE SAVE: Firebase auth refreshed, retrying save');
                  // Retry the save operation
                  const retryResponse = await fetch('/api/pages', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData),
                    credentials: 'include'
                  });

                  if (retryResponse.ok) {
                    console.log('✅ PAGE SAVE: Retry successful after Firebase refresh');
                    const responseData = await retryResponse.json();
                    console.log('✅ PAGE SAVE: Page saved successfully via API (after Firebase refresh)', { pageId });
                    // Skip to success handling
                    setHasUnsavedChanges(false);
                    setError(null);
                    return;
                  }
                }
              } else {
                console.error('🔴 PAGE SAVE: No Firebase user available for token refresh');
              }
            }
          } catch (refreshError) {
            console.error('🔴 PAGE SAVE: Session/auth refresh failed:', refreshError);
          }

          setError("Your user has expired. Please refresh the page and log in again.");
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



      console.log('🔍 PAGE SAVE: Resetting hasUnsavedChanges to false');
      setHasUnsavedChanges(false);

      // Trigger save success animation
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 500); // Reset after animation

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



      // Page connections will refresh automatically via the pageSaved event
      // No manual refresh needed since we now have real-time updates

      // REMOVED: Page reload was causing issues with subsequent saves
      // The content should update automatically without needing a reload

      // Page data should already be updated after save
      // No need to reload since the save operation updates the page state
    } catch (error) {
      console.error('🔴 PAGE SAVE: Save operation failed', {
        pageId,
        error: error.message,
        title,
        stack: error.stack,
        name: error.name
      });

      // Simplified LogRocket error logging (reduced to prevent performance issues)
      try {
        const { logRocketService } = await import('../../utils/logrocket');
        if (logRocketService.isReady) {
          logRocketService.logError(error, { operation: 'page_save', pageId });
        }
      } catch (logRocketError) {
        // Silently fail to prevent performance issues
      }

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

    // Refresh the page to show the reverted state from the database
    // This ensures the page content is properly reverted to the saved state
    window.location.reload();
  }, [hasUnsavedChanges]);

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

  // Loading state - maintain layout structure to prevent shifts
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <UnifiedLoader
            isLoading={isLoading}
            message="Loading page..."
            fullScreen={false}
            onRetry={() => window.location.reload()}
          />
        </div>
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
      {/* Sticky Save Header - slides down from top when there are unsaved changes */}
      <StickySaveHeader
        hasUnsavedChanges={hasUnsavedChanges && canEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isSaving}
        isAnimatingOut={saveSuccess && !hasUnsavedChanges}
      />

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
            titleError={!!titleError || isTitleDuplicate}
            pageId={pageId}
          />

          {/* REMOVED: Hidden Title Validation - will integrate directly into PageHeader */}

          {isPreviewingDeleted && (
            <DeletedPageBanner
              pageId={pageId}
              deletedAt={page.deletedAt}
            />
          )}

          {/* Full-width header area */}
          <div
            className="w-full"
            style={{
              paddingTop: contentPaddingTop,
              transition: 'padding-top 300ms ease-in-out'
            }}
          >
            {/* Content container with title-like styling */}
            <div className="px-4 pb-32">
              <div
                className={`px-4 py-4 outline-none transition-all duration-200 ${
                  isEditing && canEdit
                    ? `bg-background/80 border rounded-lg ${
                        isEditorFocused
                          ? "border-primary/50 ring-2 ring-primary/20"
                          : "border-muted-foreground/30"
                      }`
                    : "bg-transparent border-none"
                } min-h-[200px] w-full max-w-none`}
                onClick={() => {
                  // Focus the editor when clicking the container
                  if (isEditing && canEdit) {
                    const editorElement = document.querySelector('[contenteditable="true"]');
                    if (editorElement) {
                      (editorElement as HTMLElement).focus();
                    }
                  }
                }}
              >
                <TextSelectionProvider
                  contentRef={contentRef}
                  enableCopy={true}
                  enableShare={true}
                  enableAddToPage={true}
                  username={user?.username}
                >
                  <div ref={contentRef}>
                    <TextViewErrorBoundary fallbackContent={
                      <div className="p-4 text-muted-foreground">
                        <p>Unable to display page content. The page may have formatting issues.</p>
                        <p className="text-sm mt-2">Page ID: {page.id}</p>
                      </div>
                    }>

                      {/* Unified content display system */}
                      {(() => {
                        console.log('🔗 PAGE_VIEW: Rendering unified content display:', {
                          canEdit,
                          isEditable: canEdit,
                          hasContent: !!editorState?.length
                        });

                        return (
                          <div className="space-y-4">
                            <ContentDisplay
                              content={editorState}
                              isEditable={canEdit}
                              onChange={handleContentChange}
                              onEmptyLinesChange={handleEmptyLinesChange}
                              placeholder="Start typing..."
                              location={location}
                              setLocation={handleLocationChange}
                              onSave={handleSave}
                              onCancel={handleCancel}
                              onDelete={handleDelete}
                              isSaving={isSaving}
                              error={error || ""}
                              isNewPage={false}
                              showToolbar={false}
                              onInsertLinkRequest={handleInsertLinkRequest}
                              pageId={pageId}
                              showDiff={showDiff}
                              showLineNumbers={true}
                            />

                            {/* Dense mode toggle below content - only show in view mode */}
                            {!canEdit && (
                              <div className="flex justify-center pt-4 border-t border-border/50">
                                <DenseModeToggle />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TextViewErrorBoundary>

                    {/* Custom Date Field and Location Field are now handled by PageFooter */}

                    <UnifiedTextHighlighter
                      contentRef={contentRef}
                      showNotification={true}
                      autoScroll={true}
                    />
                  </div>
                </TextSelectionProvider>
              </div>
            </div>

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
              onInsertLink={() => linkInsertionTrigger && linkInsertionTrigger()}
              // setIsEditing removed - no manual edit mode toggling allowed
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              error={error}
              titleError={titleError}
              hasUnsavedChanges={hasUnsavedChanges}
            />

            {/* Page Actions - Reply and Add to Page buttons for other users' pages */}
            {page && !canEdit && (
              <div className="px-4 mb-8">
                <PageActions page={page} />
              </div>
            )}

            {/* Page Connections and Related Pages - show for all pages */}
            {page && (
              <>
                {/* Page Graph View */}
                <div className="px-4">
                  <PageGraphView
                    pageId={page.id}
                    pageTitle={page.title}
                    onRefreshReady={handleGraphRefreshReady}
                  />
                </div>

                <div className="px-4">
                  <RelatedPagesSection
                    page={page}
                    linkedPageIds={memoizedLinkedPageIds}
                  />
                </div>

                {/* Delete button - positioned at the very bottom for page owners */}
                {canEdit && (
                  <div className="mt-8 mb-6 px-4">
                    <Button
                      variant="destructive"
                      size="lg"
                      className="gap-2 w-full md:w-auto rounded-2xl font-medium text-white"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-5 w-5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                )}
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