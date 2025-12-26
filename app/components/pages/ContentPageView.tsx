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
// Loading fallbacks hidden in print via no-print class
const RelatedPagesSection = dynamic(() => import("../features/RelatedPagesSection"), {
  ssr: false,
  loading: () => (
    <div className="p-4 rounded-2xl border border-border bg-card animate-pulse no-print">
      <div className="h-5 w-32 bg-muted rounded mb-3" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-8 w-24 bg-muted rounded-full" />)}
      </div>
    </div>
  )
});

const RepliesSection = dynamic(() => import("../features/RepliesSection"), {
  ssr: false,
  loading: () => (
    <div className="p-4 rounded-2xl border border-border bg-card animate-pulse no-print">
      <div className="h-5 w-24 bg-muted rounded mb-3" />
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
      </div>
    </div>
  )
});

const PageGraphView = dynamic(() => import("./PageGraphView"), {
  ssr: false,
  loading: () => (
    <div className="p-4 rounded-2xl border border-border bg-card animate-pulse no-print">
      <div className="h-5 w-36 bg-muted rounded mb-3" />
      <div className="h-48 bg-muted rounded" />
    </div>
  )
});

const WhatLinksHere = dynamic(() => import("./WhatLinksHere"), {
  ssr: false,
  loading: () => (
    <div className="p-4 rounded-2xl border border-border bg-card animate-pulse no-print">
      <div className="h-5 w-32 bg-muted rounded mb-3" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-6 w-20 bg-muted rounded-full" />)}
      </div>
    </div>
  )
});

import DeletedPageBanner from "../utils/DeletedPageBanner";
import { Button } from "../ui/button";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import { UnifiedErrorBoundary } from "../utils/UnifiedErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import Link from "next/link";

import DenseModeToggle from "../viewer/DenseModeToggle";
import FullPageError from "../ui/FullPageError";
import StickySaveHeader from "../layout/StickySaveHeader";
import { motion } from "framer-motion";
import { ContentPageSkeleton, ContentPageMinimalSkeleton } from "./ContentPageSkeleton";



// Content Display Components - Unified system with preloading
const ContentDisplay = dynamic(() => import("../content/ContentDisplay"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center">
      <div className="animate-pulse">Loading content...</div>
    </div>
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // Flag to prevent data reload after save
  const justSavedRef = useRef(false); // Ref-based flag for immediate sync access

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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);


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
  useEffect(() => {
    const updatedLocationParam = searchParams?.get('updatedLocation');
    if (updatedLocationParam) {
      try {
        const newLocation = updatedLocationParam ? JSON.parse(decodeURIComponent(updatedLocationParam)) : null;
        setLocation(newLocation);
        // Also update the page object if it exists
        if (page) {
          setPage({ ...page, location: newLocation });
        }
        // Clean up the URL by removing the param (use replace to avoid adding to history)
        const url = new URL(window.location.href);
        url.searchParams.delete('updatedLocation');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Failed to parse location param - ignore
      }
    }
  }, [searchParams, page]);

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

      const result = await getPageById(pageId, user?.uid);

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
    const replyToUsername = searchParams?.get('username') || searchParams?.get('pageUsername');
    const replyType = searchParams?.get('replyType');
    const pageUserId = searchParams?.get('pageUserId');
    const groupId = searchParams?.get('groupId');
    const customDate = searchParams?.get('customDate');
    const urlTitle = searchParams?.get('title');
    const urlContent = searchParams?.get('content');
    const initialContentParam = searchParams?.get('initialContent');
    const pageType = searchParams?.get('type');

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
      customDate: initialCustomDate
    } as any;

    setPage(newPageData);
    setTitle(initialTitle);
    setEditorState(initialContent);
    setCustomDate(initialCustomDate);
    setIsLoading(false);
    setNewPageCreated(true);
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
  // PERFORMANCE FIX: Removed expensive JSON.stringify comparison from the hot path
  // This was causing input lag on mobile devices due to synchronous serialization on every keystroke
  // Now we optimistically mark content as changed and update state immediately
  const handleContentChange = useCallback((content: any) => {
    // Update editor state immediately - this is the critical path for responsive typing
    setEditorState(content);
    
    // Optimistically mark as having unsaved changes
    // The actual comparison is expensive and unnecessary on every keystroke
    // If the user saves and nothing changed, the save operation will handle it
    setHasUnsavedChanges(true);
  }, []);

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
    pageLogger.info('Page save initiated', { pageId, hasPage: !!page, title });

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

    pageLogger.info('Starting page save process', { pageId, title });
    setIsSaving(true);
    setError(null);
    setTitleError(null);

    try {
      // Use API route instead of direct Firebase calls
      const contentToSave = editorState;

      // Extract and create new pages referenced in links before saving the main page
      const newPageRefs = extractNewPageReferences(contentToSave);
      if (newPageRefs.length > 0) {
        await createNewPagesFromLinks(newPageRefs, user.uid, user.username || 'Anonymous');
      }

      const updateData: any = {
        id: pageId,
        title: title.trim(),
        content: contentToSave, // Pass as object, not stringified - API will handle stringification
        location: location,
        customDate: customDate
      };

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
      // If this is a new page (isNewPage: true), we add markAsSaved to clear the flag
      const isFirstSaveOfNewPage = page?.isNewPage === true;
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
                setHasUnsavedChanges(false);
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
                    // Skip to success handling
                    setHasUnsavedChanges(false);
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

      // CRITICAL FIX: Properly update both page state and editor state after save
      if (page) {
        const updatedPage = {
          ...page,
          content: contentToSave, // Store as array/object like editor expects
          title: title.trim(),
          location: location,
          customDate: customDate,
          lastModified: new Date().toISOString()
        };
        setPage(updatedPage);

        // Update editor state directly without reset to prevent stale content
        setEditorState(contentToSave);
      }

      // Client-side cache invalidation
      try {
        const { invalidateCache } = await import('../../utils/serverCache');
        invalidateCache.page(pageId);
        if (user?.uid) invalidateCache.user(user.uid);

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
          detail: { pageId, title: title.trim(), content: contentToSave }
        }));
      }



      setHasUnsavedChanges(false);

      // Set justSaved flag FIRST to prevent data reloading when URL changes
      // This must be set BEFORE router.replace() to prevent race conditions
      // Set BOTH ref (immediate) and state (for React re-renders)
      justSavedRef.current = true;
      setJustSaved(true);
      setTimeout(() => {
        justSavedRef.current = false;
        setJustSaved(false);
      }, 2000); // Prevent reloading for 2 seconds after save

      // NEW PAGE MODE: After first save, update URL to remove draft param
      if (isNewPageMode && page?.isNewPage) {
        // Update local page state to reflect saved status (no longer new)
        // Also update the content in the page object to ensure it persists
        setPage({
          ...page,
          isNewPage: false,
          content: editorState // Preserve the current editor content
        });
        // Update URL using history.replaceState to avoid triggering React re-renders
        const newUrl = `/${pageId}`;
        window.history.replaceState(null, '', newUrl);
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

      // If local state thinks there are no unsaved changes, avoid scaring the user with an error toast.
      const shouldShowError = hasUnsavedChanges || isSaving;
      if (shouldShowError) {
        setError(`Failed to save page: ${error?.message || 'Please try again.'}`);
      } else {
        console.warn('⚠️ Save error occurred but no unsaved changes remain; suppressing user-facing error.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [page, pageId, editorState, title, location]);

  const lastSavedContentRef = useRef<any>(null);

  // Track last saved state whenever editorState updates from save/load
  useEffect(() => {
    if (editorState && !isSaving) {
      lastSavedContentRef.current = editorState;
    }
  }, [editorState, isSaving]);

  const handleCancel = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
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
    setHasUnsavedChanges(false);
    setError(null);
  }, [hasUnsavedChanges, setEditorState, isNewPageMode, page?.isNewPage, router]);

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
  }, [handleSave, handleCancel, isEditing, hasUnsavedChanges, canEdit]);

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
  }, [page, pageId, router]);

  // ARCHITECTURAL SIMPLIFICATION: Remove complex content processing
  // Let ContentDisplay components handle their own content conversion
  // CRITICAL FIX: Only update editor state if user doesn't have unsaved changes
  // This prevents losing user's work when switching apps or when page data re-renders
  useEffect(() => {
    if (!page?.content) return;

    // Don't overwrite user's unsaved changes with stale data from the server
    if (hasUnsavedChanges) {
      return;
    }

    // Pass raw content directly - no preprocessing
    setEditorState(page.content);
  }, [page?.content, hasUnsavedChanges]); // Update whenever page content changes, but respect unsaved changes

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
      {/* Sticky Save Header - fixed at top, outside content wrapper */}
      <StickySaveHeader
        hasUnsavedChanges={hasUnsavedChanges && canEdit}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isSaving}
        isAnimatingOut={saveSuccess && !hasUnsavedChanges}
      />

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
              >
                <div ref={contentRef} data-page-content>
                    <UnifiedErrorBoundary fallback={({ error, resetError }) => (
                      <div className="p-4 text-muted-foreground">
                        <p>Unable to display page content. The page may have formatting issues.</p>
                        <p className="text-sm mt-2">Page ID: {page?.id || pageId}</p>
                        <button onClick={resetError} className="mt-2 text-sm underline">
                          Try again
                        </button>
                      </div>
                    )}>

                      {/* Unified content display system */}
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
                              showLinkSuggestions={showLinkSuggestions}
                              onLinkSuggestionsLoadingChange={setIsLoadingSuggestions}
                            />

                            {/* Dense mode toggle below content - only show in view mode (hidden in print) */}
                            {!canEdit && (
                              <div className="flex justify-center pt-4 no-print">
                                <DenseModeToggle />
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
            <div className="mt-4 no-print">
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
              hasUnsavedChanges={hasUnsavedChanges}
              showLinkSuggestions={showLinkSuggestions}
              isLoadingSuggestions={isLoadingSuggestions}
              onToggleLinkSuggestions={setShowLinkSuggestions}
            />
            </div>

            {/* Page Actions for non-owners are now rendered inside ContentPageFooter */}

            {/* Page Connections and Related Pages - show for all pages (hidden in print) */}
            {page && (
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
                              setHasUnsavedChanges(true);
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

            {/* Delete button - positioned at the very bottom for page owners (hidden in print) */}
            {page && canEdit && (
              <div className="mt-8 mb-6 px-4 no-print">
                <Button
                  variant="destructive"
                  size="lg"
                  className="gap-2 w-full md:w-auto rounded-2xl font-medium text-white"
                  onClick={handleDelete}
                >
                  <Icon name="Trash2" size={20} />
                  <span>Delete</span>
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
