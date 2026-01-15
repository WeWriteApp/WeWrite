"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Icon } from '@/components/ui/Icon';
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getPageById, recordPageView } from "../../utils/apiClient";
import { getOptimizedPageData } from "../../utils/readOptimizer";
import { useAuth } from '../../providers/AuthProvider';
import { TextSelectionProvider } from "../../providers/TextSelectionProvider";
import { PageProvider } from "../../contexts/PageContext";
import { useRecentPages } from "../../contexts/RecentPagesContext";
import { useFeatureFlags } from "../../contexts/FeatureFlagContext";
import { createLogger } from '../../utils/logger';
import { extractNewPageReferences, createNewPagesFromLinks } from '../../utils/pageContentHelpers';
import { createReplyContent } from '../../utils/replyUtils';

// UI Components
import PublicLayout from "../layout/PublicLayout";
import ContentPageHeader from "./ContentPageHeader";
import ContentPageFooter from "./ContentPageFooter";
import AllocationBar from "../payments/AllocationBar";

// PERFORMANCE: Lazy-load below-the-fold components to reduce initial bundle size
// These components are heavy and not needed for initial page render
// No loading fallbacks - instant render when ready (no skeleton flicker)
const RelatedPagesSection = dynamic(() => import("../features/RelatedPagesSection"), {
  ssr: false
});

const RepliesSection = dynamic(() => import("../features/RepliesSection"), {
  ssr: false
});

const PageGraphView = dynamic(() => import("./PageGraphView"), {
  ssr: false
});

const WhatLinksHere = dynamic(() => import("./WhatLinksHere"), {
  ssr: false
});

// Writing ideas banner - shown for new pages to suggest topics
const WritingIdeasBanner = dynamic(() => import("../writing/WritingIdeasBanner").then(mod => ({ default: mod.WritingIdeasBanner })), {
  ssr: false
});

import DeletedPageBanner from "../utils/DeletedPageBanner";
import { Button } from "../ui/button";
import { InlineError } from "../ui/InlineError";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import { UnifiedErrorBoundary } from "../utils/UnifiedErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import Link from "next/link";

import DenseModeToggle from "../viewer/DenseModeToggle";
import FullPageError from "../ui/FullPageError";
import UnsavedChangesDialog from "../utils/UnsavedChangesDialog";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useConfirmation } from "../../hooks/useConfirmation";
import { ConfirmationModal } from "../utils/UnifiedModal";
import StickySaveHeader from "../layout/StickySaveHeader";
import AutoSaveIndicator from "../layout/AutoSaveIndicator";
import { motion } from "framer-motion";
import { ContentPageSkeleton, ContentPageMinimalSkeleton } from "./ContentPageSkeleton";
import { LoadingState } from "../ui/LoadingState";



// Content Display Components - Unified system with preloading
const ContentDisplay = dynamic(() => import("../content/ContentDisplay"), {
  ssr: false,
  loading: () => (
    <LoadingState
      message="Loading content..."
      showBorder
      size="md"
      minHeight="h-32"
    />
  )
});

// OPTIMIZATION: Preload ContentDisplay component
if (typeof window !== 'undefined') {
  import("../content/ContentDisplay");
}
import EmptyLinesAlert from "../editor/EmptyLinesAlert";

// Types
interface PageViewProps {
  params: Promise<{ id: string }> | { id: string };
  showVersion?: boolean;
  versionId?: string;
  showDiff?: boolean;
  compareVersionId?: string; // For diff comparison between two versions
  initialPageData?: any; // PERFORMANCE: Pre-fetched data from server component
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
  username?: string;
  location?: Location | null;
  createdAt: any;
  updatedAt: any;
  lastModified?: any;
  customDate?: string | null;
  isDeleted?: boolean;
  deletedAt?: any;
  isNewPage?: boolean;
  replyTo?: string | null;
  replyType?: 'agree' | 'disagree' | 'neutral';
  replyToTitle?: string | null;
  replyToUsername?: string | null;
}

const extractReplyType = (content: any): 'agree' | 'disagree' | 'neutral' => {
  try {
    const raw = content?.replyType || content?.metadata?.replyType;
    if (raw === 'agree' || raw === 'disagree') return raw;
  } catch (e) {
    // ignore parsing errors and fall back to neutral
  }
  return 'neutral';
};

/**
 * PageView - Consolidated TypeScript page viewing component
 *
 * This component replaces SinglePageView.js, ClientPage.tsx, and consolidates
 * all page viewing functionality into a single maintainable TypeScript component.
 *
 * VISIBILITY RULES: The source of truth for element visibility is defined in:
 * app/config/contentPageVisibility.ts
 *
 * That file documents what elements are shown/hidden for:
 * - myPageSaved: Viewing/editing my own saved page
 * - myPageNew: Creating a new page (not yet saved)
 * - otherPage: Viewing someone else's page
 *
 * The design system (admin/design-system) displays a table generated from that config.
 * When making visibility changes, update both this component and the config.
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
export default function ContentPageView({
  params,
  showVersion = false,
  versionId,
  showDiff = false,
  compareVersionId,
  initialPageData
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
  const [hasOptimisticPage, setHasOptimisticPage] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // MY page = always true, NOT my page = always false
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  // Auto-save state (only used when auto_save feature flag is enabled)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Auto-save session ID for version batching - generated once per page load/session
  // All auto-saves with the same session ID will be batched into a single version
  const autoSaveSessionIdRef = useRef<string | null>(null);
  // NOTE: hasUnsavedChanges state removed - now computed via hasChanges memo for accuracy
  const [justSaved, setJustSaved] = useState(false); // Flag to prevent data reload after save
  const justSavedRef = useRef(false); // Ref-based flag for immediate sync access
  const isNewPageRef = useRef(false); // Ref-based flag to track new page status without re-renders

  const [title, setTitle] = useState('');
  const authorUsername = page?.username || (page as any)?.authorUsername || (page as any)?.user?.username || '';
  const authorUserId = page?.userId || (page as any)?.authorUserId || (page as any)?.user?.id || '';
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const replyTypeForGraph = useMemo<'agree' | 'disagree' | 'neutral'>(() => {
    if (!page) return 'neutral';
    const explicit = page.replyType;
    if (explicit === 'agree' || explicit === 'disagree') return explicit;
    return extractReplyType(page.content);
  }, [page]);
  // Removed complex loading timeout logic - using UnifiedLoader now
  const [versionData, setVersionData] = useState<any>(null);
  const [contentPaddingTop, setContentPaddingTop] = useState<string>('2rem');

  // Empty lines tracking for alert banner
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Link insertion trigger function
  const [linkInsertionTrigger, setLinkInsertionTrigger] = useState<(() => void) | null>(null);

  // Link suggestions toggle state
  const [showLinkSuggestions, setShowLinkSuggestions] = useState(false);
  const [linkSuggestionCount, setLinkSuggestionCount] = useState(0);


  // Refs
  const editorRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRecorded = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const graphRefreshRef = useRef<(() => void) | null>(null);

  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { addRecentPage } = useRecentPages();
  const { isEnabled: isFeatureEnabled } = useFeatureFlags();
  const autoSaveEnabled = isFeatureEnabled('auto_save');

  // Confirmation modals hook (replaces window.confirm)
  const { confirmationState, confirm, closeConfirmation } = useConfirmation();

  // Logger
  const pageLogger = createLogger('PageView');

  // Callback to capture graph refresh function
  const handleGraphRefreshReady = useCallback((refreshFn: () => void) => {
    graphRefreshRef.current = refreshFn;
  }, []);

  // Constants - simplified loading approach
  const isPreviewingDeleted = searchParams?.get('preview') === 'deleted';
  // New page mode: when navigating to /{pageId}?new=true, create the page first
  // Also support legacy 'draft=true' param for backwards compatibility
  const isNewPageMode = searchParams?.get('new') === 'true' || searchParams?.get('draft') === 'true';
  const [isClosingNewPage, setIsClosingNewPage] = useState(false);
  const [newPageCreated, setNewPageCreated] = useState(false);
  // Track if we've scrolled to top - prevents rendering full page at wrong scroll position
  const [isScrollReady, setIsScrollReady] = useState(!isNewPageMode);

  // For new page mode, scroll to top and mark ready before rendering content
  React.useLayoutEffect(() => {
    if (isNewPageMode && !isScrollReady) {
      window.scrollTo(0, 0);
      setIsScrollReady(true);
    }
  }, [isNewPageMode, isScrollReady]);

  // Handle location update from URL params (after returning from location picker)
  // Track if we've already processed the location update to prevent loops
  const locationUpdateProcessedRef = useRef(false);

  // Ref to update lastSavedLocationRef when location is updated from picker
  // This is declared before the refs are defined, so we use a callback pattern
  const updateSavedLocationRef = useRef<((loc: Location | null) => void) | null>(null);

  useEffect(() => {
    const updatedLocationParam = searchParams?.get('updatedLocation');
    if (updatedLocationParam && !locationUpdateProcessedRef.current) {
      locationUpdateProcessedRef.current = true;
      try {
        const newLocation = updatedLocationParam ? JSON.parse(decodeURIComponent(updatedLocationParam)) : null;
        setLocation(newLocation);
        // Also update the page object if it exists - use functional update to avoid dependency on page
        setPage(prevPage => prevPage ? { ...prevPage, location: newLocation } : prevPage);
        // Update the saved location ref to match - this location was just saved in the picker
        // This prevents the save/revert bar from appearing after returning
        if (updateSavedLocationRef.current) {
          updateSavedLocationRef.current(newLocation);
        }
        // Clean up the URL by removing the param (use replace to avoid adding to history)
        const url = new URL(window.location.href);
        url.searchParams.delete('updatedLocation');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Failed to parse location param - ignore
        locationUpdateProcessedRef.current = false;
      }
    } else if (!updatedLocationParam) {
      // Reset the flag when there's no param
      locationUpdateProcessedRef.current = false;
    }
  }, [searchParams]);

  // PERFORMANCE: Hydrate from server-side pre-fetched data
  // This eliminates the client-side fetch waterfall for page loads
  useEffect(() => {
    if (initialPageData && !page && !hasOptimisticPage) {
      pageLogger.debug('Hydrating from server-side initialPageData', {
        pageId: initialPageData.id,
        title: initialPageData.title
      });

      setPage(initialPageData);
      setPageId(initialPageData.id);
      setTitle(initialPageData.title || '');
      setCustomDate(initialPageData.customDate || null);
      setLocation(initialPageData.location || null);

      // Parse and set content
      if (initialPageData.content) {
        try {
          const parsedContent = typeof initialPageData.content === 'string'
            ? JSON.parse(initialPageData.content)
            : initialPageData.content;
          setEditorState(parsedContent);
        } catch (parseError) {
          pageLogger.warn('Failed to parse initialPageData content', { parseError });
          setEditorState([]);
        }
      } else {
        setEditorState([]);
      }

      setIsLoading(false);

      // Record page view for SSR-hydrated pages
      if (!viewRecorded.current && initialPageData.id) {
        recordPageView(initialPageData.id, user?.uid || null);
        viewRecorded.current = true;
      }
    }
  }, [initialPageData, page, hasOptimisticPage, user?.uid]);

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
      pageLogger.debug('Trying API fallback for page load', { pageId, userId: user?.uid });

      // Skip client-side cache when user is logged in to ensure fresh content for editors
      const result = await getPageById(pageId, user?.uid, { skipCache: !!user?.uid });

      pageLogger.debug('API fallback result', {
        hasPageData: !!result.pageData,
        hasError: !!result.error,
        error: result.error,
        pageData: result.pageData ? {
          id: result.pageData.id,
          title: result.pageData.title,
          userId: result.pageData.userId,
          username: result.pageData.username,
          hasContent: !!result.pageData.content
        } : null
      });

      if (result.error) {
        pageLogger.warn('API fallback failed', { error: result.error, pageId });
        const errorMessage = result.error === 'Page not found'
          ? `Page "${pageId}" was not found. It may have been deleted or you may not have permission to view it.`
          : `Failed to load page: ${result.error}`;
        setError(errorMessage);
        setIsLoading(false);
      } else if (result.pageData) {
        pageLogger.debug('API fallback successful', { pageId });
        let pageData = result.pageData;
        const versionData = result.versionData;

        // If username is missing or potentially outdated, fetch it from user profile
        if (pageData && pageData.userId) {
          try {
            const userResponse = await fetch(`/api/users/profile?id=${encodeURIComponent(pageData.userId)}`);
            if (userResponse.ok) {
              const userResult = await userResponse.json();
              if (userResult.success && userResult.data?.username) {
                if (!pageData.username || pageData.username === 'Anonymous' || pageData.username !== userResult.data.username) {
                  pageData = { ...pageData, username: userResult.data.username };
                }
              }
            }
          } catch (userError) {
            // Failed to fetch username, will use existing value
          }
        }

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
        pageLogger.warn('API fallback returned no data', { pageId, result });
        setError(`Page "${pageId}" was not found. It may have been deleted, moved, or you may not have permission to view it. Please check the URL and try again.`);
        setIsLoading(false);
      }
    } catch (error) {
      pageLogger.error('API fallback error', {
        error,
        pageId,
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack
      });
      setError(`Network error while loading page "${pageId}". Please check your internet connection and try again. If the problem persists, contact support.`);
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

  // Optimistic page hydrate when coming from /new save to avoid skeleton flash
  useEffect(() => {
    if (!pageId || typeof window === 'undefined') return;
    const key = `wewrite:optimisticPage:${pageId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;

    try {
      const optimistic = JSON.parse(raw);
      const fallbackTitle = optimistic.title || 'Untitled';
      const fallbackContent = optimistic.content || [{ type: 'paragraph', children: [{ text: '' }] }];

      setPage({
        id: pageId,
        title: fallbackTitle,
        userId: optimistic.userId,
        username: optimistic.username,
        content: fallbackContent,
        createdAt: optimistic.createdAt,
        lastModified: optimistic.lastModified,
        isPublic: !!optimistic.isPublic,
        deleted: !!optimistic.deleted
      } as any);

      setEditorState(fallbackContent);
      setTitle(fallbackTitle);
      setIsLoading(false);
      setHasOptimisticPage(true);
      sessionStorage.removeItem(key);
    } catch (optimisticError) {
      console.warn('Failed to apply optimistic page cache (non-fatal):', optimisticError);
      sessionStorage.removeItem(key);
    }
  }, [pageId]);

  // Version loading functions - declared before useEffect to avoid hoisting issues
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
        const version = versions.find(v => v.id === versionId);

        if (version) {
          setVersionData(version);

          // Parse version content
          let versionContent = version.content;
          if (typeof versionContent === 'string') {
            try {
              versionContent = JSON.parse(versionContent);
            } catch (error) {
              console.error("Error parsing version content:", error);
              versionContent = [{ type: "paragraph", children: [{ text: versionContent }] }];
            }
          }

          setEditorState(versionContent || [{ type: "paragraph", children: [{ text: "" }] }]);

          setPage({
            id: pageId,
            title: version.title || 'Untitled',
            userId: version.userId,
            username: version.username,
            createdAt: version.createdAt,
            lastModified: version.createdAt,
            isPublic: false,
            deleted: false
          });
          setTitle(version.title || 'Untitled');
        } else {
          setError("Version not found");
        }
      } else {
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
          // Generate diff content using centralized diff service
          const { calculateDiff } = await import('../../utils/diffService');
          const { processDiffForDisplay } = await import('../../utils/diffContentProcessor');

          const diffResult = await calculateDiff(
            currentVersion.content || '',
            compareVersion?.content || ''
          );

          // Process diff result into displayable content with annotations
          const processedDiff = processDiffForDisplay(
            currentVersion.content || '',
            compareVersion?.content || '',
            diffResult
          );

          setEditorState(processedDiff.content); // Use processed content for display

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

  // NEW PAGE MODE SETUP EFFECT
  // When navigating to /{pageId}?new=true, set up the editor for a new page
  // The page is NOT created in the database until the user saves
  useEffect(() => {
    if (!isNewPageMode || !pageId || !user || newPageCreated) {
      return;
    }

    // Extract URL parameters for the new page
    const replyTo = searchParams?.get('replyTo');
    const replyToTitle = searchParams?.get('page');
    // Note: pageUsername is the page owner's username, username is the reply author's username
    // For the reply attribution, we need the page owner's username
    const replyToUsername = searchParams?.get('pageUsername') || searchParams?.get('username');
    const replyType = searchParams?.get('replyType');
    const pageUserId = searchParams?.get('pageUserId');
    const groupId = searchParams?.get('groupId');
    const customDate = searchParams?.get('customDate');
    const urlTitle = searchParams?.get('title');
    const urlContent = searchParams?.get('content');
    const initialContentParam = searchParams?.get('initialContent');
    const pageType = searchParams?.get('type');
    const locationParam = searchParams?.get('location');

    // Build initial title
    let initialTitle = '';
    if (urlTitle && urlTitle.trim()) {
      const trimmed = urlTitle.trim();
      // For daily notes with date format, don't use as title
      if (!(pageType === 'daily-note' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed))) {
        initialTitle = trimmed;
      }
    }

    // Build initial content for replies
    let initialContent = [{ type: "paragraph", children: [{ text: "" }] }];
    if (replyTo) {
      const decodedTitle = (() => {
        try { return replyToTitle ? decodeURIComponent(replyToTitle) : ''; }
        catch { return replyToTitle || ''; }
      })();
      const decodedUsername = (() => {
        try { return replyToUsername ? decodeURIComponent(replyToUsername) : ''; }
        catch { return replyToUsername || ''; }
      })();

      const sentiment = replyType === 'agree' || replyType === 'disagree' ? replyType : 'standard';

      initialContent = [
        ...createReplyContent({
          pageId: replyTo,
          pageTitle: decodedTitle || "Untitled",
          userId: pageUserId || user?.uid || '',
          username: decodedUsername || "Anonymous",
          replyType: sentiment
        }),
        { type: "paragraph", children: [{ text: "" }] }
      ];
    } else if (urlContent && urlContent.trim()) {
      initialContent = [{ type: "paragraph", children: [{ text: urlContent.trim() }] }];
    } else if (initialContentParam) {
      try {
        initialContent = JSON.parse(decodeURIComponent(initialContentParam));
      } catch {
        // Ignore parse errors
      }
    }

    // Handle custom date from daily notes
    let initialCustomDate: string | null = null;
    if (pageType === 'daily-note' && customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate.trim())) {
      initialCustomDate = customDate.trim();
    } else if (pageType === 'daily-note' && urlTitle && /^\d{4}-\d{2}-\d{2}$/.test(urlTitle.trim())) {
      initialCustomDate = urlTitle.trim();
    }

    // Parse location from URL param (from map flow)
    let initialLocation: Location | null = null;
    if (locationParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(locationParam));
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          initialLocation = {
            lat: parsed.lat,
            lng: parsed.lng,
            zoom: parsed.zoom || 15
          };
        }
      } catch (e) {
        // Failed to parse location param - ignore
      }
    }

    // Set up local state for the new page (NOT saved to database yet)
    const newPageData: Page = {
      id: pageId,
      title: initialTitle,
      content: initialContent,
      userId: user.uid,
      username: user.username || 'Anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isNewPage: true, // Flag to indicate this is a new unsaved page
      replyTo: replyTo || null,
      replyToTitle: replyToTitle ? decodeURIComponent(replyToTitle) : null,
      replyToUsername: replyToUsername ? decodeURIComponent(replyToUsername) : null,
      groupId: groupId || null,
      customDate: initialCustomDate,
      location: initialLocation
    } as any;

    setPage(newPageData);
    setTitle(initialTitle);
    setEditorState(initialContent);
    setCustomDate(initialCustomDate);
    setLocation(initialLocation);
    setIsLoading(false);
    setNewPageCreated(true);
    isNewPageRef.current = true; // Track new page status via ref to avoid re-renders on first save
  }, [isNewPageMode, pageId, user, newPageCreated, searchParams]);

  // Page loading effect - OPTIMIZED for faster loading
  useEffect(() => {
    if (!pageId) {
      pageLogger.debug('No pageId provided');
      return;
    }

    // For new page mode: don't try to load from database - page doesn't exist yet
    // The new page mode setup effect handles creating the local page state
    if (isNewPageMode) {
      pageLogger.debug('Skipping page load for new page mode', { pageId, newPageCreated });
      return;
    }

    // CRITICAL FIX: Don't reload data immediately after save to prevent showing stale content
    // Check both state and ref - ref is immediately available, state ensures re-render triggers work
    if (justSaved || justSavedRef.current) {
      return;
    }

    // SIMPLIFIED: No complex timing logic needed with unified cache

    pageLogger.debug('Starting page load', { pageId, userId: user?.uid });
    setIsLoading(!hasOptimisticPage);
    setError(null);

    // Declare fallbackTimeout in the proper scope
    let fallbackTimeout: NodeJS.Timeout;

    // Function to load page data using optimized caching
    const loadOptimizedPageData = async () => {
      try {

        // Use optimized page data fetching with aggressive caching
        const data = await getOptimizedPageData(pageId, user?.uid);

        if (data.error) {
          pageLogger.warn('Optimized page load error', { error: data.error, pageId });
          setError(data.error);
          setIsLoading(false);
          return;
        }

        pageLogger.debug('Optimized page data loaded', {
          hasPageData: !!data.pageData,
          hasVersionData: !!data.versionData,
          pageData: data.pageData ? {
            id: data.pageData.id,
            title: data.pageData.title || 'NO_TITLE',
            userId: data.pageData.userId || 'NO_USER_ID',
            username: data.pageData.username || 'NO_USERNAME',
            hasContent: !!data.pageData.content,
            contentType: typeof data.pageData.content,
            contentLength: data.pageData?.content?.length || 0,
            lastModified: data.pageData.lastModified,
            createdAt: data.pageData.createdAt
          } : 'NO_PAGE_DATA',
          versionData: data.versionData ? {
            hasContent: !!data.versionData.content,
            title: data.versionData.title,
            username: data.versionData.username
          } : 'NO_VERSION_DATA'
        });

        let pageData = data.pageData;
        const versionData = data.versionData;

        if (!pageData) {
          pageLogger.warn('Page data is undefined, attempting API fallback', {
            data,
            pageId,
            hasData: !!data,
            dataKeys: data ? Object.keys(data) : [],
            optimizedDataSource: 'getOptimizedPageData'
          });

          // Try API fallback before giving up
          try {
            await tryApiFallback();
            return; // tryApiFallback handles loading state
          } catch (fallbackError) {
            pageLogger.error('Both primary and API fallback failed', {
              fallbackError,
              pageId,
              errorMessage: fallbackError?.message || 'Unknown error',
              errorStack: fallbackError?.stack
            });
            setError(`Failed to load page "${pageId}". This page may not exist, may be private, or there may be a temporary issue. Please try refreshing the page or contact support if the problem persists.`);
            setIsLoading(false);
            return;
          }
        }

        // Handle missing or corrupted page data
        if (pageData && (!pageData.title || pageData.title === 'Untitled' || !pageData.username || pageData.username === 'Anonymous' || pageData.username === 'missing username')) {
          // Try to fetch missing username from user profile
          if (pageData.userId && (!pageData.username || pageData.username === 'Anonymous' || pageData.username === 'missing username')) {
            try {
              const userResponse = await fetch(`/api/users/profile?id=${encodeURIComponent(pageData.userId)}`);
              if (userResponse.ok) {
                const userResult = await userResponse.json();
                if (userResult.success && userResult.data?.username) {
                  pageData = { ...pageData, username: userResult.data.username };
                }
              }
            } catch (userError) {
              // Failed to fetch username
            }
          }

          // If title is still missing or default, try to get it from version data
          if ((!pageData.title || pageData.title === 'Untitled') && versionData?.title) {
            pageData = { ...pageData, title: versionData.title };
          }

          // Handle missing title - new pages can have empty title
          if (!pageData.title || pageData.title === 'Untitled') {
            if (pageData.isNewPage) {
              pageData = { ...pageData, title: '' };
            } else {
              pageData = { ...pageData, title: `Page ${pageId.substring(0, 8)}...` };
            }
          }

          if (!pageData.username || pageData.username === 'Anonymous' || pageData.username === 'missing username') {
            pageData = { ...pageData, username: 'Unknown Author' };
          }
        }

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
              // Handle malformed JSON content (stored as string instead of array)
              let parsedContent;
              if (typeof contentToUse === 'string') {
                try {
                  parsedContent = JSON.parse(contentToUse);
                  // Handle double-encoded JSON
                  if (typeof parsedContent === 'string') {
                    parsedContent = JSON.parse(parsedContent);
                  }
                } catch (e) {
                  parsedContent = contentToUse;
                }
              } else {
                parsedContent = contentToUse;
              }

              setEditorState(parsedContent);
            } catch (error) {
              console.error("Error parsing content:", error);
              setEditorState(contentToUse || null);
            }
          } else {
            setEditorState(null);
          }

          setIsLoading(false);
        } catch (error) {
          console.error('Error in optimized page loading:', error);
          setError('Failed to load page');
          setIsLoading(false);
        }
      };

    // If showing version or diff, load version data instead of live page
    if (showVersion && versionId) {
      pageLogger.debug('Loading version data', { versionId });
      loadVersionData();
    } else if (showDiff && versionId) {
      pageLogger.debug('Loading diff data', { versionId });
      loadDiffData();
    } else {
      pageLogger.debug('Setting up page loading with optimized data fetching', { pageId });

      // OPTIMIZATION: Use optimized data fetching with aggressive caching
      loadOptimizedPageData();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clearTimeout(fallbackTimeout);
    };
  }, [pageId, user?.uid, showVersion, versionId, showDiff, compareVersionId, isNewPageMode]);

  // Record page view and add to recent pages
  useEffect(() => {
    if (!viewRecorded.current && !isLoading && page && pageId) {
      viewRecorded.current = true;
      recordPageView(pageId, user?.uid);

      // Add to localStorage recent pages tracking
      import('../../utils/recentSearches').then(({ addRecentlyViewedPageId }) => {
        addRecentlyViewedPageId(pageId);
      }).catch(error => {
        console.error('Error adding page to recent pages:', error);
      });

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

          // Otherwise, try to fetch from API
          try {
            const { getUserProfile } = await import('../../utils/apiClient');
            const userData = await getUserProfile(page.userId);

            if (userData?.username) {
              return userData.username;
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

  // Computed values
  const canEdit = user?.uid && !isPreviewingDeleted && !showVersion && !showDiff && (user.uid === page?.userId);
  const memoizedPage = useMemo(() => page, [page?.id, page?.title, page?.updatedAt, page?.username]);

  // Extract linked page IDs from editor content
  const memoizedLinkedPageIds = useMemo(() => {
    if (!editorState) return [];

    const pageIds: string[] = [];

    const extractFromNode = (node: any) => {
      // Check if this node is a page link
      if (node.pageId) {
        pageIds.push(node.pageId);
      } else if (node.type === 'link' && node.isPageLink && node.url) {
        // Extract from URL
        const url = node.url;
        if (url.startsWith('/') && url.length > 1) {
          const id = url.substring(1).split(/[\/\?#]/)[0];
          if (id && !id.includes('/')) {
            pageIds.push(id);
          }
        }
      }

      // Recursively check children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(extractFromNode);
      }
    };

    // Handle both array and object content
    const content = Array.isArray(editorState) ? editorState : editorState?.children || [];
    content.forEach(extractFromNode);

    // Return unique IDs
    return [...new Set(pageIds)];
  }, [editorState]);

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

  // SIMPLIFIED: Remove complex padding logic - use CSS variable for banner stack height
  // Include banner-stack-height to account for any active banners (email verification, PWA, save banner, etc.)
  useEffect(() => {
    if (isEditing) {
      // Edit mode: header is in document flow (not fixed), but save banner is fixed
      // Need padding for the banner stack (which includes save banner when visible)
      setContentPaddingTop('var(--banner-stack-height, 0px)');
    } else {
      setContentPaddingTop('calc(160px + var(--banner-stack-height, 0px))'); // View mode: header is fixed, need padding + banner height
    }
  }, [isEditing]);

  // Event handlers
  // SIMPLIFIED: Just update editor state - hasChanges memo handles change detection
  // No need to set optimistic flags - the memo compares against saved refs accurately
  const handleContentChange = useCallback((content: any) => {
    // Update editor state immediately - this is the critical path for responsive typing
    setEditorState(content);
    // NOTE: Do NOT set hasUnsavedChanges here - the hasChanges memo computes it accurately
    // Setting flags here causes false positives when selection changes without text changes
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (newTitle !== title) {
      pageLogger.debug('Title changed', { oldTitle: title, newTitle });
    }
    setTitle(newTitle);
    // NOTE: Do NOT set hasUnsavedChanges here - the hasChanges memo handles it
    setTitleError(null);
  }, [title, pageLogger]);





  const handleLocationChange = useCallback((newLocation: Location | null) => {
    setLocation(newLocation);
    // NOTE: Do NOT set hasUnsavedChanges here - the hasChanges memo handles it
  }, []);

  const handleCustomDateChange = useCallback((newCustomDate: string | null) => {
    setCustomDate(newCustomDate);
    // NOTE: Do NOT set hasUnsavedChanges here - the hasChanges memo handles it
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

  // Refs to track last saved state for change detection
  // Must be defined before handleSave which uses hasChanges
  const lastSavedContentRef = useRef<any>(null);
  const lastSavedTitleRef = useRef<string>('');
  const lastSavedLocationRef = useRef<Location | null>(null);
  const lastSavedCustomDateRef = useRef<string | null>(null);

  // Connect updateSavedLocationRef callback to lastSavedLocationRef
  // This allows the URL param effect to update the saved location ref when returning from picker
  useEffect(() => {
    updateSavedLocationRef.current = (loc: Location | null) => {
      lastSavedLocationRef.current = loc;
    };
  }, []);

  // Track whether refs have been initialized (prevents false positives on initial load)
  // This MUST be state (not ref) so that changes trigger re-render and useMemo recomputes
  const [refsInitialized, setRefsInitialized] = useState(false);

  // Initialize saved refs when page first loads - this MUST happen synchronously with content loading
  // The key fix: we track initialization state separately from content
  useEffect(() => {
    // Only initialize refs once per page load, and only when we have valid page data
    if (page && !refsInitialized && !isSaving) {
      // CRITICAL: Parse content the same way as editorState to ensure accurate comparison
      // page.content might be a JSON string, but editorState is always a parsed object
      let parsedContent = page.content;
      if (typeof page.content === 'string') {
        try {
          parsedContent = JSON.parse(page.content);
        } catch {
          // If parsing fails, use as-is
          parsedContent = page.content;
        }
      }
      lastSavedContentRef.current = parsedContent;
      lastSavedTitleRef.current = page.title || '';
      lastSavedLocationRef.current = page.location || null;
      lastSavedCustomDateRef.current = page.customDate || null;
      setRefsInitialized(true);
    }
  }, [page, isSaving, refsInitialized]);

  // Reset refs when page ID changes (navigating to a different page)
  useEffect(() => {
    setRefsInitialized(false);
  }, [pageId]);

  // Compute if content differs from last saved state
  // SIMPLIFIED: No fallbacks to hasUnsavedChanges - pure comparison only
  const hasChanges = useMemo(() => {
    // Don't show changes until refs are initialized (prevents flash on load)
    if (!refsInitialized) {
      return false;
    }

    // CRITICAL: Skip hasChanges check right after save to prevent false positives
    // The justSaved flag is set after save and cleared after 2 seconds
    // This prevents the "unsaved changes" warning immediately after saving
    if (justSaved) {
      return false;
    }

    // For new pages, check if any content has been added
    if (page?.isNewPage) {
      // New page has changes if content exists and isn't just empty paragraph
      if (!editorState || !Array.isArray(editorState)) return false;
      if (editorState.length === 0) return false;
      if (editorState.length === 1) {
        const firstBlock = editorState[0];
        if (firstBlock?.type === 'paragraph' && firstBlock?.children) {
          const text = firstBlock.children.map((c: any) => c.text || '').join('');
          return text.trim().length > 0;
        }
      }
      return true;
    }

    // Compare title against saved ref
    const savedTitle = lastSavedTitleRef.current;
    if (savedTitle !== '' && title !== savedTitle) {
      return true;
    }

    // Compare location
    const savedLocation = lastSavedLocationRef.current;
    if (JSON.stringify(location) !== JSON.stringify(savedLocation)) {
      return true;
    }

    // Compare custom date
    const savedCustomDate = lastSavedCustomDateRef.current;
    if (customDate !== savedCustomDate) {
      return true;
    }

    // Compare content - expensive check, do last
    const savedContent = lastSavedContentRef.current;
    // Both null/undefined = no changes
    if (!savedContent && !editorState) return false;
    // One exists, other doesn't = changes (but wait for both to be loaded)
    if (!savedContent || !editorState) return false;

    try {
      const savedStr = JSON.stringify(savedContent);
      const currentStr = JSON.stringify(editorState);
      return savedStr !== currentStr;
    } catch {
      // Serialization failed - assume no changes to avoid false positives
      return false;
    }
  }, [title, location, customDate, editorState, page?.isNewPage, refsInitialized, justSaved]);

  // No need for handleSetIsEditing - always in edit mode

  const handleSave = useCallback(async (passedContent?: any, options?: { isAutoSave?: boolean }) => {
    const isAutoSave = options?.isAutoSave || false;
    pageLogger.info('Page save initiated', { pageId, hasPage: !!page, title, isAutoSave });

    if (!page || !pageId) {
      pageLogger.warn('Save aborted - no page or pageId', { pageId, hasPage: !!page });
      return;
    }

    // Validate title is not empty
    if (!title || title.trim() === '') {
      pageLogger.warn('Save aborted - no title provided', { pageId });
      setTitleError("Pages must have a title");
      return;
    }

    // Check if there are changes to save (not for new pages)
    if (!page?.isNewPage && !hasChanges) {
      pageLogger.info('Save aborted - no changes detected', { pageId });
      return;
    }

    pageLogger.info('Starting page save process', { pageId, title });
    setIsSaving(true);
    setError(null);
    setTitleError(null);

    try {
      // Use API route instead of direct Firebase calls
      // IMPORTANT: Capture the current state at save time - these are what we're actually saving
      // If user continues typing during the async save, editorState will change but these won't
      const contentToSave = editorState;
      const titleToSave = title.trim();
      const locationToSave = location;
      const customDateToSave = customDate;

      // Extract and create new pages referenced in links before saving the main page
      const newPageRefs = extractNewPageReferences(contentToSave);
      if (newPageRefs.length > 0) {
        await createNewPagesFromLinks(newPageRefs, user.uid, user.username || 'Anonymous');
      }

      const updateData: any = {
        id: pageId,
        title: titleToSave,
        content: contentToSave, // Pass as object, not stringified - API will handle stringification
        location: locationToSave,
        customDate: customDateToSave
      };

      // VERSION BATCHING: For auto-saves, include session ID and batch flag
      // This allows multiple auto-saves within a typing session to be combined into one version
      if (isAutoSave && autoSaveSessionIdRef.current) {
        updateData.groupId = autoSaveSessionIdRef.current;
        updateData.batchWithGroup = true;
      }

      // Include replyType if this is a reply page and the type has been set
      if (page?.replyTo && page?.replyType) {
        updateData.replyType = page.replyType;
      }

      // Include reply metadata for new pages
      if (page?.isNewPage && page?.replyTo) {
        updateData.replyTo = page.replyTo;
        updateData.replyToTitle = page.replyToTitle;
        updateData.replyToUsername = page.replyToUsername;
      }

      // NEW PAGE MODE: Always use PUT to /api/pages for saving content
      // The draft endpoint only creates the skeleton page document on initial navigation
      // When the user actually saves content, we use PUT which creates versions properly
      // If this is a new page, we add markAsSaved to clear the flag in the database
      // Check BOTH ref (most accurate) and state (for edge cases) to detect first save
      const isFirstSaveOfNewPage = isNewPageRef.current || page?.isNewPage === true;
      if (isFirstSaveOfNewPage) {
        updateData.markAsSaved = true;
      }
      const apiEndpoint = '/api/pages';
      const httpMethod = 'PUT';

      pageLogger.debug(`API request: ${httpMethod} ${apiEndpoint}`, {
        pageId: pageId,
        title,
        hasContent: !!contentToSave,
        contentLength: contentToSave ? JSON.stringify(contentToSave).length : 0,
        isFirstSaveOfNewPage
      });

      const response = await fetch(apiEndpoint, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
        credentials: 'include'
      });

      if (!response.ok) {
        let errorData: Record<string, any> = {};
        try {
          errorData = await response.json();
        } catch (parseError) {
          try {
            const text = await response.text();
            if (text) {
              errorData = { error: text };
            }
          } catch {
            // ignore
          }
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
          // Try to refresh the user using the API-based approach
          try {

            // First, try to refresh the user using the user API
            const sessionRefreshResponse = await fetch('/api/auth/user', {
              method: 'GET',
              credentials: 'include'
            });

            if (sessionRefreshResponse.ok) {

              // Retry the save operation
              const retryResponse = await fetch('/api/pages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
                credentials: 'include'
              });

              if (retryResponse.ok) {
                const responseData = await retryResponse.json();
                // Skip to success handling
                setError(null);
                return;
              }
            } else {
              // Fallback to Firebase token refresh
              const { getAuth } = await import('firebase/auth');
              const auth = getAuth();
              const user = auth.currentUser;

              if (user) {
                const newToken = await user.getIdToken(true); // Force refresh

                // Create new user cookie
                const sessionResponse = await fetch('/api/create-user-cookie', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: newToken }),
                  credentials: 'include'
                });

                if (sessionResponse.ok) {
                  // Retry the save operation
                  const retryResponse = await fetch('/api/pages', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData),
                    credentials: 'include'
                  });

                  if (retryResponse.ok) {
                    const responseData = await retryResponse.json();
                    // Skip to success handling - hasChanges is computed via memo
                    setError(null);
                    return;
                  }
                }
              }
            }
          } catch (refreshError) {
            pageLogger.error('Session/auth refresh failed:', { error: refreshError });
          }

          setError("Your user has expired. Please refresh the page and log in again.");
          return; // Don't throw, just show error message
        }

        // Check for error message in the correct field - API uses 'error' field, not 'message'
        const rawMessage = errorData.error || errorData.message;
        const errorMessage = rawMessage || `API request failed: ${response.status} ${response.statusText}`;
        const detailedMessage = `${errorMessage}${errorData.code ? ` [code: ${errorData.code}]` : ''}`;
        throw new Error(detailedMessage);
      }

      let result: any = { success: true };
      try {
        result = await response.json();
      } catch (jsonError) {
        // Response had no/invalid JSON, treating as success
      }

      pageLogger.debug('API response success: PUT /api/pages', { status: response.status, result });

      if (result.success === false) {
        throw new Error(result.message || 'Failed to update page');
      }

      pageLogger.info('Page saved successfully via API', { pageId });

      // CRITICAL FIX: Properly update page state after save
      // NOTE: We intentionally do NOT call setEditorState(contentToSave) here!
      // The editorState may have changed during the async save operation (user continued typing).
      // Overwriting with contentToSave would cause a race condition that loses those changes.
      // The editor already has the current state - we only need to update the page object
      // to reflect what was actually saved to the server.

      // Check if this is the first save of a new page using REF to avoid re-renders
      // The ref check doesn't trigger component re-renders, preserving focus/modal state
      const isFirstSaveOfNewPageLocal = isNewPageMode && isNewPageRef.current;

      // Clear the ref IMMEDIATELY to prevent double-triggers on rapid saves
      if (isFirstSaveOfNewPageLocal) {
        isNewPageRef.current = false;
      }

      // CRITICAL: Set justSaved flag BEFORE setPage to prevent the editor sync effect
      // from running during the re-render caused by setPage. This preserves focus/modals.
      justSavedRef.current = true;

      // SIMPLIFICATION: Only update metadata in page state, NOT content
      // The Editor already has the latest content via editorState.
      // Updating page.content triggers Editor's sync effect which resets focus/modals.
      // Instead, we only update metadata that doesn't affect the Editor.
      if (page) {
        setPage(prev => prev ? {
          ...prev,
          // DO NOT update content - it triggers Editor reset!
          // content is already in editorState and will be synced on next load
          title: titleToSave,
          location: locationToSave,
          customDate: customDateToSave,
          lastModified: new Date().toISOString(),
        } : prev);
      }

      // Comprehensive cache invalidation - clears ALL caching layers
      try {
        const { invalidatePageCacheAfterSave } = await import('../../utils/apiClient');
        invalidatePageCacheAfterSave(pageId, user?.uid);

        // Dispatch refresh event for components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refresh-recent-edits', {
            detail: { pageId, userId: user?.uid }
          }));
        }
      } catch (cacheError) {
        // Cache error is non-fatal
      }

      // Emit page save event for real-time updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pageSaved', {
          detail: { pageId, title: titleToSave, content: contentToSave }
        }));
      }

      // NOTE: hasChanges is now computed via memo - no need to set hasUnsavedChanges

      // Set justSaved STATE (ref was already set above before setPage)
      // This triggers React re-renders that depend on justSaved state
      setJustSaved(true);
      setTimeout(() => {
        justSavedRef.current = false;
        setJustSaved(false);
      }, 2000); // Prevent reloading for 2 seconds after save

      // NEW PAGE MODE: After first save, update URL to remove draft param
      if (isFirstSaveOfNewPageLocal) {
        // Update URL using history.replaceState to avoid triggering React re-renders
        const newUrl = `/${pageId}`;
        window.history.replaceState(null, '', newUrl);
        // The ref (isNewPageRef) was already set to false above to prevent double-triggers
        // Now we defer the page.isNewPage state update to transition the Delete/Cancel button
        // Using requestAnimationFrame ensures the critical focus-preserving code has completed
        requestAnimationFrame(() => {
          setPage(prev => prev ? { ...prev, isNewPage: false } : prev);
        });
      }

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

      // Update saved refs to the VALUES THAT WERE ACTUALLY SAVED
      // IMPORTANT: Use contentToSave/titleToSave (captured at save start), NOT current state
      // If user typed during save, current editorState differs from what was saved
      // This ensures hasChanges correctly detects unsaved changes after save completes
      lastSavedContentRef.current = contentToSave;
      lastSavedTitleRef.current = titleToSave;
      lastSavedLocationRef.current = locationToSave;
      lastSavedCustomDateRef.current = customDateToSave;

      // Clear error state
      pageLogger.info('Page saved successfully', { pageId, title });
      setError(null);



      // Page connections will refresh automatically via the pageSaved event
      // No manual refresh needed since we now have real-time updates

      // REMOVED: Page reload was causing issues with subsequent saves
      // The content should update automatically without needing a reload

      // Page data should already be updated after save
      // No need to reload since the save operation updates the page state
    } catch (error) {
      console.error('Save operation failed:', error.message);

      // LogRocket error logging
      try {
        const { logRocketService } = await import('../../utils/logrocket');
        if (logRocketService.isReady) {
          logRocketService.logError(error, { operation: 'page_save', pageId });
        }
      } catch (logRocketError) {
        // Silently fail to prevent performance issues
      }

      pageLogger.error('Page save failed', { pageId, error: error.message, title });

      // If there are no changes, avoid scaring the user with an error toast.
      const shouldShowError = hasChanges || isSaving;
      if (shouldShowError) {
        setError(`Failed to save page: ${error?.message || 'Please try again.'}`);
      } else {
        console.warn('⚠️ Save error occurred but no changes remain; suppressing user-facing error.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [page, pageId, editorState, title, location, hasChanges]);

  // Refs to hold current values for access inside setTimeout callbacks
  // These avoid stale closure issues in async callbacks
  const currentTitleRef = useRef(title);
  const currentLocationRef = useRef(location);
  const currentEditorStateRef = useRef(editorState);

  // Track whether auto-save baseline has been initialized (separate from refsInitialized)
  // This allows auto-save to work as soon as content is ready, without waiting for full page load
  const autoSaveBaselineInitialized = useRef(false);
  // Track when baseline was just initialized to skip the immediate effect run
  const autoSaveBaselineJustInitialized = useRef(false);

  // Keep current value refs in sync
  useEffect(() => {
    currentTitleRef.current = title;
  }, [title]);

  useEffect(() => {
    currentLocationRef.current = location;
  }, [location]);

  useEffect(() => {
    currentEditorStateRef.current = editorState;
  }, [editorState]);

  // Initialize auto-save baseline as soon as content is ready (don't wait for full page load)
  // This allows auto-save to work even if the page object is still loading
  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (autoSaveBaselineInitialized.current) return;

    // Initialize baseline as soon as we have valid editorState
    if (editorState && Array.isArray(editorState)) {
      lastSavedContentRef.current = editorState;
      lastSavedTitleRef.current = title || '';
      lastSavedLocationRef.current = location || null;
      autoSaveBaselineInitialized.current = true;
      // Mark that we just initialized - the next auto-save effect run should be skipped
      // to avoid false positives from effect ordering
      autoSaveBaselineJustInitialized.current = true;
    }
  }, [autoSaveEnabled, editorState, title, location]);

  // Reset auto-save baseline and session ID when page ID changes (navigating to a different page)
  useEffect(() => {
    autoSaveBaselineInitialized.current = false;
    autoSaveSessionIdRef.current = null; // Reset session ID for new page
  }, [pageId]);

  // Generate auto-save session ID when auto-save mode is active and page is loaded
  // This groups all auto-saves within one editing session into a single version
  useEffect(() => {
    if (autoSaveEnabled && canEdit && pageId && !autoSaveSessionIdRef.current) {
      // Generate a unique session ID: pageId + timestamp + random suffix
      autoSaveSessionIdRef.current = `autosave-${pageId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }, [autoSaveEnabled, canEdit, pageId]);

  // Auto-save effect: triggers save after 2.5 seconds of inactivity when there are changes
  // Only active when auto_save feature flag is enabled
  useEffect(() => {
    // Skip if auto-save is disabled via feature flag
    if (!autoSaveEnabled) {
      return;
    }

    // Don't auto-save if:
    // - Not the owner (canEdit is false)
    // - Currently saving or just saved (prevent infinite loop)
    // - Auto-save baseline not initialized yet (content not ready)
    if (!canEdit || isSaving || !autoSaveBaselineInitialized.current) {
      return;
    }

    // Skip the first run immediately after baseline initialization
    // This prevents false positive "unsaved changes" on initial page load
    if (autoSaveBaselineJustInitialized.current) {
      autoSaveBaselineJustInitialized.current = false;
      return;
    }

    // Prevent re-triggering while save is in progress or just completed
    // This is the key guard against infinite loops
    if (autoSaveStatus === 'saving' || autoSaveStatus === 'saved') {
      return;
    }

    // For new pages, require explicit first save (user needs to set a title)
    if (page?.isNewPage && !title?.trim()) {
      return;
    }

    // Check for actual changes BEFORE setting pending status
    // This prevents showing "Unsaved changes" on initial load
    const currentTitle = currentTitleRef.current;
    const currentLocation = currentLocationRef.current;
    const currentContent = currentEditorStateRef.current;

    // Check if title changed
    const savedTitle = lastSavedTitleRef.current;
    const titleChanged = savedTitle !== '' && currentTitle !== savedTitle;

    // Check if location changed
    const savedLocation = lastSavedLocationRef.current;
    const locationChanged = JSON.stringify(currentLocation) !== JSON.stringify(savedLocation);

    // Check if content changed
    const savedContent = lastSavedContentRef.current;
    let contentChanged = false;
    if (savedContent && currentContent) {
      try {
        contentChanged = JSON.stringify(savedContent) !== JSON.stringify(currentContent);
      } catch {
        contentChanged = false;
      }
    }

    // If no actual changes, don't proceed - stay in idle state
    if (!titleChanged && !locationChanged && !contentChanged) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Show "pending" state IMMEDIATELY when changes are detected
    // This gives instant feedback that there are unsaved changes
    setAutoSaveStatus('pending');

    // Set a new timeout for auto-save after 1 second of inactivity
    // This is faster than before (was 2.5s) for a more responsive feel
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Re-check for actual changes using current refs vs saved refs
      // This avoids stale closure issues by reading refs directly
      const latestTitle = currentTitleRef.current;
      const latestLocation = currentLocationRef.current;
      const latestContent = currentEditorStateRef.current;

      // Check if title changed
      const latestSavedTitle = lastSavedTitleRef.current;
      const latestTitleChanged = latestSavedTitle !== '' && latestTitle !== latestSavedTitle;

      // Check if location changed
      const latestSavedLocation = lastSavedLocationRef.current;
      const latestLocationChanged = JSON.stringify(latestLocation) !== JSON.stringify(latestSavedLocation);

      // Check if content changed
      const latestSavedContent = lastSavedContentRef.current;
      let latestContentChanged = false;
      if (latestSavedContent && latestContent) {
        try {
          latestContentChanged = JSON.stringify(latestSavedContent) !== JSON.stringify(latestContent);
        } catch {
          latestContentChanged = false;
        }
      }

      // If no actual changes, go back to idle state
      if (!latestTitleChanged && !latestLocationChanged && !latestContentChanged) {
        setAutoSaveStatus('idle');
        return;
      }

      setAutoSaveStatus('saving');
      setAutoSaveError(null);

      try {
        // Pass isAutoSave: true to enable version batching
        await handleSave(undefined, { isAutoSave: true });

        // After save completes, check if user typed more during save
        // The refs were updated in handleSave to what was actually saved
        // Compare current state to saved state to detect new changes
        const postSaveContent = currentEditorStateRef.current;
        const postSaveTitle = currentTitleRef.current;
        const postSaveLocation = currentLocationRef.current;
        const postSavedContent = lastSavedContentRef.current;
        const postSavedTitle = lastSavedTitleRef.current;
        const postSavedLocation = lastSavedLocationRef.current;

        let stillHasChanges = false;
        if (postSavedTitle !== '' && postSaveTitle !== postSavedTitle) {
          stillHasChanges = true;
        }
        if (!stillHasChanges && JSON.stringify(postSaveLocation) !== JSON.stringify(postSavedLocation)) {
          stillHasChanges = true;
        }
        if (!stillHasChanges && postSavedContent && postSaveContent) {
          try {
            stillHasChanges = JSON.stringify(postSavedContent) !== JSON.stringify(postSaveContent);
          } catch {
            // Ignore serialization errors
          }
        }

        if (stillHasChanges) {
          // User typed during save - go back to 'pending' immediately
          // The auto-save effect will trigger another save after 1s
          setAutoSaveStatus('pending');
        } else {
          // All changes were saved - show 'saved' status
          setAutoSaveStatus('saved');
          setLastSavedAt(new Date());
          // Transition to idle after showing saved state
          setTimeout(() => setAutoSaveStatus('idle'), 3000);
        }
      } catch (err) {
        setAutoSaveStatus('error');
        setAutoSaveError(err instanceof Error ? err.message : 'Auto-save failed');
      }
    }, 1000); // 1 second delay (reduced from 2.5s for faster saves)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [autoSaveEnabled, editorState, title, location, canEdit, isSaving, handleSave, page?.isNewPage, autoSaveStatus]);

  const handleCancel = useCallback(async () => {
    if (hasChanges) {
      const confirmCancel = await confirm({
        title: "Discard Changes?",
        message: "You have unsaved changes. Are you sure you want to discard them?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        type: "warning"
      });
      if (!confirmCancel) return;
    }

    // NEW PAGE MODE: Simply navigate away - page doesn't exist in database yet
    if (isNewPageMode && page?.isNewPage) {
      setIsClosingNewPage(true);

      // Navigate back after animation
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push('/');
        }
      }, 320);
      return;
    }

    // Revert to last saved content without a full page reload
    if (lastSavedContentRef.current) {
      setEditorState(lastSavedContentRef.current);
    }
    if (lastSavedTitleRef.current) {
      setTitle(lastSavedTitleRef.current);
    }
    setLocation(lastSavedLocationRef.current);
    setCustomDate(lastSavedCustomDateRef.current);
    setError(null);
  }, [hasChanges, setEditorState, isNewPageMode, page?.isNewPage, router, confirm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Escape to cancel editing
      if (e.key === 'Escape' && isEditing) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSave, handleCancel, isEditing, hasChanges, canEdit]);

  // Unsaved changes protection - shows dialog when navigating away with unsaved changes
  const saveForUnsavedChangesDialog = useCallback(async () => {
    await handleSave();
  }, [handleSave]);

  const {
    showUnsavedChangesDialog,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasChanges && canEdit, saveForUnsavedChangesDialog);

  const handleDelete = useCallback(async () => {
    if (!page || !pageId) return;

    const confirmDelete = await confirm({
      title: "Delete Page?",
      message: "Are you sure you want to delete this page? You'll have 30 days to recover it from your Recently Deleted pages.",
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "destructive"
    });
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
        // Navigate back to previous page (e.g., user's pages list) instead of home
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push('/');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete page. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      setError("Failed to delete page. Please try again.");
    }
  }, [page, pageId, router, confirm]);

  // ARCHITECTURAL SIMPLIFICATION: Remove complex content processing
  // Let ContentDisplay components handle their own content conversion
  // CRITICAL FIX: Only update editor state if user doesn't have unsaved changes
  // This prevents losing user's work when switching apps or when page data re-renders
  useEffect(() => {
    if (!page?.content) return;

    // Don't overwrite user's changes with stale data from the server
    if (hasChanges) {
      return;
    }

    // CRITICAL: Skip this sync right after save to prevent editor state reset
    // The justSaved flag is set after save and cleared after 2 seconds
    // This prevents the save completion from triggering unnecessary state updates
    // that could close dialogs or lose cursor position
    if (justSaved || justSavedRef.current) {
      return;
    }

    // CRITICAL: Never sync content for new pages - they should start fresh and
    // the editor already has the content. Syncing here causes focus loss on first save.
    if (isNewPageMode || isNewPageRef.current) {
      return;
    }

    // Pass raw content directly - no preprocessing
    setEditorState(page.content);
  }, [page?.content, hasChanges, justSaved, isNewPageMode]); // Update whenever page content changes, but respect unsaved changes and recent saves

  // NEW PAGE MODE: Show skeleton with slide-up animation while setting up
  if (isNewPageMode && !newPageCreated) {
    return <ContentPageSkeleton withSlideUpAnimation />;
  }

  // Progressive loading state - show page structure immediately
  if (isLoading && !page) {
    return <ContentPageSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <FullPageError
        title="Page Error"
        message={error}
        showGoBack={true}
        showGoHome={true}
        showTryAgain={true}
                    onRetry={() => setError(null)}
      />
    );
  }

  // For new page mode, wait until scroll is ready before rendering anything
  // This prevents the flash of content at wrong scroll position
  if (isNewPageMode && !isScrollReady) {
    return <ContentPageMinimalSkeleton />;
  }

  // No page found - but not for new page mode (still being set up)
  // In new page mode, page will be set by the setup effect; wait for it
  if (!page) {
    // For new page mode, show skeleton while waiting for setup effect
    if (isNewPageMode) {
      return <ContentPageSkeleton />;
    }
    // For regular pages, show page not found
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

  // Wrapper component for draft mode slide-up animation
  const PageContent = (
    <>
      <PublicLayout>
        <PageProvider>
          <div
            className="w-full max-w-none box-border"
            style={{
              paddingTop: contentPaddingTop,
              transition: 'padding-top 300ms ease-in-out'
            }}
          >
            {/* Sentinel element used by ContentPageHeader to detect scroll position reliably */}
            <div data-header-sentinel aria-hidden className="h-px w-full" />
            <ContentPageHeader
              title={title}
              username={page?.username}
              authorUsername={
                page?.username ||
                (page as any)?.authorUsername ||
                (page as any)?.user?.username ||
                null
              }
              userId={page?.userId}
              isLoading={isLoading}
              isEditing={isEditing}
              onTitleChange={handleTitleChange}
              canEdit={canEdit}
              titleError={!!titleError}
              pageId={pageId}
              isNewPage={isNewPageMode && page?.isNewPage}
              onBack={isNewPageMode && page?.isNewPage ? handleCancel : undefined}
          />

          {/* Manual save mode: show sticky save banner (only when auto-save is disabled) */}
          {!autoSaveEnabled && (
            <StickySaveHeader
              hasUnsavedChanges={hasChanges}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={isSaving}
            />
          )}

          {/* REMOVED: Hidden Title Validation - will integrate directly into PageHeader */}

          {isPreviewingDeleted && page && (
            <div className="no-print">
              <DeletedPageBanner
                pageId={pageId}
                pageTitle={page.title || 'Untitled'}
                deletedAt={page.deletedAt}
                daysLeft={page.deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - new Date(page.deletedAt).getTime()) / (1000 * 60 * 60 * 24))) : 30}
              />
            </div>
          )}

          {/* Full-width header area */}
          <div className="w-full">
            {/* Content container - Clean without unnecessary card wrapper */}
            <div className="px-4">
              <TextSelectionProvider
                contentRef={contentRef}
                enableCopy={true}
                enableShare={true}
                enableAddToPage={true}
                username={authorUsername}
                userId={authorUserId}
                pageId={page?.id}
                pageTitle={page?.title}
                canEdit={canEdit}
                onInsertLink={linkInsertionTrigger || undefined}
              >
                <div ref={contentRef} data-page-content>
                    <UnifiedErrorBoundary fallback={({ error, resetError }) => (
                      <InlineError
                        title="Unable to display page content"
                        message="The page may have formatting issues or corrupted data."
                        variant="error"
                        size="lg"
                        errorDetails={`Page ID: ${page?.id || pageId}\n\nError: ${error?.name || 'Unknown'}\n${error?.message || 'No message'}\n\nStack:\n${error?.stack || 'No stack trace'}`}
                        onRetry={resetError}
                        retryLabel="Try Again"
                        showCopy={true}
                        showCollapsible={true}
                      />
                    )}>

                      {/* Unified content display system */}
                          <div>
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
                              showLinkSuggestions={showLinkSuggestions}
                              onLinkSuggestionCountChange={setLinkSuggestionCount}
                            />

                            {/* Dense mode toggle below content - only show in view mode (hidden in print) */}
                            {!canEdit && (
                              <div className="flex justify-center pt-4 no-print">
                                <DenseModeToggle />
                              </div>
                            )}

                            {/* Auto-save indicator - shown below content when auto-save is enabled */}
                            {autoSaveEnabled && canEdit && (
                              <div className="flex justify-center pt-2 no-print">
                                <AutoSaveIndicator
                                  status={autoSaveStatus}
                                  lastSavedAt={lastSavedAt}
                                  error={autoSaveError}
                                />
                              </div>
                            )}

                            {/* Writing ideas banner - shown for new pages to help with topic selection */}
                            {isNewPageMode && page?.isNewPage && !page?.replyTo && (
                              <div className="mt-6 no-print">
                                <WritingIdeasBanner
                                  onIdeaSelect={(ideaTitle, placeholder) => {
                                    // Set the page title when an idea is selected
                                    handleTitleChange(ideaTitle);
                                  }}
                                  selectedTitle={title}
                                />
                              </div>
                            )}
                          </div>
                    </UnifiedErrorBoundary>

                    {/* Custom Date Field and Location Field are now handled by PageFooter */}

                    <UnifiedTextHighlighter
                      contentRef={contentRef}
                      showNotification={true}
                      autoScroll={true}
                    />
                </div>
              </TextSelectionProvider>
            </div>

            {/* Page Footer with actions - tight spacing (hidden in print) */}
            <div className="no-print">
              <ContentPageFooter
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
              hasUnsavedChanges={hasChanges}
              showLinkSuggestions={showLinkSuggestions}
              linkSuggestionCount={linkSuggestionCount}
              onToggleLinkSuggestions={setShowLinkSuggestions}
            />
            </div>

            {/* Page Actions for non-owners are now rendered inside ContentPageFooter */}

            {/* Page Connections and Related Pages - hide for new pages to focus on creation (hidden in print) */}
            {page && !page.isNewPage && (
              <div className="px-4 space-y-4 no-print">
                {/* Page Graph View */}
                <PageGraphView
                  pageId={page.id}
                  pageTitle={page.title}
                  replyToId={page.replyTo || null}
                  replyType={replyTypeForGraph}
                  onRefreshReady={handleGraphRefreshReady}
                  pageOwnerId={page.userId}
                />

                {/* What Links Here */}
                <WhatLinksHere
                  pageId={page.id}
                  pageTitle={page.title}
                  isOwner={user?.uid === page.userId}
                  page={page}
                />

                {page.replyTo && (
                  <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm text-muted-foreground">Reply to</p>
                        <Link
                          href={`/${page.replyTo}`}
                          className="font-semibold underline-offset-4 hover:underline"
                        >
                          {page.replyToTitle || "View page"}
                        </Link>
                      </div>
                      {canEdit && (
                        <div className="min-w-[160px]">
                          <p className="text-sm text-muted-foreground mb-1">Reply type</p>
                          <Select
                            value={replyTypeForGraph}
                            onValueChange={(val) => {
                              setPage((prev) => {
                                if (!prev) return prev;
                                return { ...prev, replyType: val as 'agree' | 'disagree' | 'neutral' };
                              });
                              // NOTE: hasChanges is computed via memo - no need to set hasUnsavedChanges
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="neutral">Neutral reply</SelectItem>
                              <SelectItem value="agree">Agree</SelectItem>
                              <SelectItem value="disagree">Disagree</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Replies Section - shows all replies to this page with type filtering */}
                <RepliesSection
                  pageId={page.id}
                  pageTitle={page.title}
                  pageUserId={page.userId}
                  pageUsername={page.username}
                  isOwnPage={canEdit}
                />

                <RelatedPagesSection
                  page={page}
                  linkedPageIds={memoizedLinkedPageIds}
                />
              </div>
            )}

            {/* Delete/Cancel button - positioned at the very bottom for page owners (hidden in print) */}
            {/* Shows "Cancel" for new pages, "Delete" for existing pages */}
            {page && canEdit && (
              <div className="mt-8 mb-6 px-4 no-print flex justify-center">
                <Button
                  variant={page.isNewPage ? "secondary" : "destructive"}
                  size="lg"
                  className={`gap-2 w-full md:w-auto rounded-2xl font-medium ${page.isNewPage ? '' : 'text-white'}`}
                  onClick={page.isNewPage ? handleCancel : handleDelete}
                >
                  <Icon name={page.isNewPage ? "X" : "Trash2"} size={20} />
                  <span>{page.isNewPage ? "Cancel" : "Delete"}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Allocation Bar - Only shows on other users' pages (hidden in print) */}
          {page && (
            <div className="no-print">
            <AllocationBar
              pageId={page.id}
              pageTitle={page.title}
              authorId={page.userId}
              visible={true}
            />
            </div>
          )}

          {/* Empty Lines Alert - Shows when page is editable and there are empty lines (hidden in print) */}
          {canEdit && !showVersion && !showDiff && (
            <div className="no-print">
              <EmptyLinesAlert
                emptyLinesCount={emptyLinesCount}
                onDeleteAllEmptyLines={handleDeleteAllEmptyLines}
              />
            </div>
          )}


        </div>
      </PageProvider>
    </PublicLayout>

    {/* Confirmation Modal - replaces window.confirm for Delete/Cancel actions */}
    <ConfirmationModal
      isOpen={confirmationState.isOpen}
      onClose={closeConfirmation}
      onConfirm={confirmationState.onConfirm}
      title={confirmationState.title}
      message={confirmationState.message}
      confirmText={confirmationState.confirmText}
      cancelText={confirmationState.cancelText}
      type={confirmationState.type}
    />

    {/* Unsaved Changes Dialog - shows when navigating away with unsaved changes */}
    <UnsavedChangesDialog
      isOpen={showUnsavedChangesDialog}
      onClose={handleCloseDialog}
      onStayAndSave={handleStayAndSave}
      onLeaveWithoutSaving={handleLeaveWithoutSaving}
      isSaving={isSaving || isHandlingNavigation}
    />
    </>
  );

  // For new page mode, wrap with slide-up animation
  if (isNewPageMode) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: isClosingNewPage ? '100%' : 0 }}
        transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-screen bg-background"
      >
        {PageContent}
      </motion.div>
    );
  }

  // Regular page view (no animation)
  return PageContent;
}
