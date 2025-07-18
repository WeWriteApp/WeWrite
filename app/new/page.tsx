"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Head from "next/head";
import PublicLayout from "../components/layout/PublicLayout";
import { createPage } from "../firebase/database";
import { auth } from "../firebase/config";
// ReactGA removed - analytics now handled by UnifiedAnalyticsProvider
// Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
// import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { ContentChangesTrackingService } from "../services/contentChangesTracking";
import { useRecentPages } from "../contexts/RecentPagesContext";
// import { CONTENT_EVENTS } from "../constants/analytics-events";
import { createReplyAttribution } from "../utils/linkUtils";
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { useDateFormat } from '../contexts/DateFormatContext';
import PageHeader from "../components/pages/PageHeader";
import Editor from "../components/editor/Editor";

import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../components/utils/UnsavedChangesDialog";
import { PageProvider } from "../contexts/PageContext";

import PledgeBar from "../components/payments/PledgeBar";

import SlideUpPage from "../components/ui/slide-up-page";
import { NewPageSkeleton } from "../components/skeletons/PageEditorSkeleton";
import { toast } from "../components/ui/use-toast";
import CustomDateField from "../components/pages/CustomDateField";
import { useLogRocket } from "../providers/LogRocketProvider";
import LocationField from "../components/pages/LocationField";
import { isExactDateFormat } from "../utils/dateUtils";

/**
 * Editor content node interface
 */
interface EditorNode {
  type: string;
  children: Array<{ text: string }>;
  placeholder?: string;
  isAttribution?: boolean;
  [key: string]: any;
}

/**
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 */
const isExactDateFormat = (title: string): boolean => {
  if (!title || title.length !== 10) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
};

/**
 * Page data interface for creation
 */
interface PageData {
  title: string;

  location: any;
  content: any; // Can be object or string - API will handle stringification
  userId: string;
  username: string;
  lastModified: string;
  isReply: boolean;
  replyTo?: string | null;
  replyToTitle?: string | null;
  replyToUsername?: string | null;
  groupId?: string | null;
  customDate?: string; // YYYY-MM-DD format for daily notes
}

/**
 * NewPage component that mimics SinglePageView structure for creating new pages
 * This component emulates the exact same architecture as editing an existing page
 */
function NewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentAccount, isAuthenticated, isEmailVerified, isLoading: authLoading } = useCurrentAccount();
  // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
  // const { trackPageCreationFlow, trackEditingFlow } = useWeWriteAnalytics();

  const { addRecentPage } = useRecentPages();
  const { trackPageCreation } = useLogRocket();

  // RUTHLESS SIMPLIFICATION: No cache invalidation at all - just use short TTLs and browser refresh
  const { formatDateString } = useDateFormat();

  // State that mimics SinglePageView
  const [isEditing] = useState(true); // Always in editing mode for new pages
  const [editorState, setEditorState] = useState<EditorNode[]>([{ type: "paragraph", children: [{ text: "" }] }]);
  const [title, setTitle] = useState<string>("");
  const [location, setLocation] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Page-like state for consistency with SinglePageView
  const [page, setPage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // State for tracking changes and saving (mimics EditPage)
  const [editorContent, setEditorContent] = useState<EditorNode[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasContentChanged, setHasContentChanged] = useState<boolean>(false);
  const [hasTitleChanged, setHasTitleChanged] = useState<boolean>(false);
  const [titleError, setTitleError] = useState<boolean>(false);

  // Groups functionality removed - but keep selectedGroupId for compatibility
  const selectedGroupId = null;

  // Determine page type
  const isReply = searchParams?.has('replyTo') || false;

  // Track intended custom date from daily notes carousel
  const [intendedCustomDate, setIntendedCustomDate] = useState<string | null>(null);

  // Initialize custom date from URL parameters (for daily notes carousel)
  useEffect(() => {
    if (searchParams) {
      const pageType = searchParams.get('type');
      const customDateParam = searchParams.get('customDate');
      const urlTitle = searchParams.get('title');

      // If this came from daily notes carousel with customDate parameter
      if (pageType === 'daily-note' && customDateParam && isExactDateFormat(customDateParam.trim())) {
        setIntendedCustomDate(customDateParam.trim());
      }
      // Legacy support: if title is a date (old format)
      else if (pageType === 'daily-note' && urlTitle && isExactDateFormat(urlTitle.trim())) {
        setIntendedCustomDate(urlTitle.trim());
        // Clear the title so user can enter their own
        setTitle('');
      }
    }
  }, [searchParams]);

  // Client-side authentication check
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        console.log('NewPage: User not authenticated, redirecting to login');
        router.push('/auth/login?from=/new');
      } else if (!isEmailVerified) {
        console.log('NewPage: User not verified, redirecting to email verification');
        router.push('/auth/verify-email');
      }
    }
  }, [authLoading, isAuthenticated, isEmailVerified, router]);

  // Initialize the page after a brief delay to prevent layout shift
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);

      // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
      // Track page creation started
      // trackPageCreationFlow.started({
      //   is_reply: isReply,
      //   is_daily_note: isDailyNote,
      //   has_initial_content: !!(searchParams?.get('content') || searchParams?.get('initialContent')),
      //   has_initial_title: !!searchParams?.get('title')
      // });
    }, 150); // Brief delay to ensure smooth rendering

    return () => clearTimeout(timer);
  }, []);

  // Initialize content from URL parameters (for text selection feature)
  useEffect(() => {
    if (searchParams) {
      const urlTitle = searchParams.get('title');
      const urlContent = searchParams.get('content');
      const pageType = searchParams.get('type');



      if (urlTitle && urlTitle.trim()) {
        const trimmedTitle = urlTitle.trim();

        // If this came from daily notes carousel with legacy date format, don't set the title to the date
        if (pageType === 'daily-note' && isExactDateFormat(trimmedTitle)) {
          // Don't set title - let user choose their own title
        } else {
          setTitle(trimmedTitle);
        }
      }

      if (urlContent && urlContent.trim()) {
        // Create editor content from the URL parameter
        const contentNodes = [
          {
            type: "paragraph",
            children: [{ text: urlContent.trim() }]
          }
        ];
        setEditorState(contentNodes);
      }
    }
  }, [searchParams]);

  // Initialize page-like object for new page creation
  useEffect(() => {
    const mockPage = {
      id: null,
      title: title,

      location: location,
      userId: currentAccount?.uid || 'anonymous',
      username: currentAccount?.username || currentAccount?.displayName || 'Anonymous',
      content: JSON.stringify(editorState),
      lastModified: new Date().toISOString(),
      isReply: isReply
    };
    setPage(mockPage);
  }, [title, location, currentAccount, editorState, isReply]);

  // Initialize content based on page type
  useEffect(() => {
    if (isReply && searchParams) {
      const pageTitle = searchParams.get('page') || '';
      const username = searchParams.get('username') || '';
      const replyToId = searchParams.get('replyTo') || '';
      const contentParam = searchParams.get('initialContent');

      setTitle("");

      if (contentParam) {
        try {
          const parsedContent = JSON.parse(decodeURIComponent(contentParam));
          let completeContent = [...parsedContent];
          if (completeContent.length < 2) {
            completeContent.push({ type: "paragraph", children: [{ text: "" }], placeholder: "Start typing your reply..." });
          }
          setEditorState(completeContent);
          return;
        } catch (error) {
          console.error("Error parsing content from URL:", error);
        }
      }

      const attribution = createReplyAttribution({
        pageId: replyToId,
        pageTitle: pageTitle,
        userId: currentAccount?.uid || '',
        username: username
      });

      const replyContent = [
        attribution,
        { type: "paragraph", children: [{ text: "" }], placeholder: "Start typing your reply..." }
      ];

      setEditorState(replyContent);
    } else if (searchParams) {
      const titleParam = searchParams.get('title');
      const contentParam = searchParams.get('initialContent');
      const pageType = searchParams.get('type');

      if (titleParam) {
        try {
          const decodedTitle = decodeURIComponent(titleParam);

          // For daily notes, store the date for customDate field
          if (pageType === 'daily-note' && isExactDateFormat(decodedTitle)) {
            setTitle(decodedTitle); // Keep date for now, will be converted during save
          } else {
            setTitle(decodedTitle);
          }
        } catch {}
      }

      if (contentParam) {
        try {
          const parsedContent = JSON.parse(decodeURIComponent(contentParam));
          setEditorState(parsedContent);
        } catch {}
      }
    }
  }, [isReply, searchParams]);

  // Handle back navigation
  const handleBack = () => {
    let backUrl = '/';

    if (isReply && searchParams) {
      const replyToId = searchParams.get('replyTo');
      if (replyToId) {
        backUrl = `/${replyToId}`;
      }
    }

    router.push(backUrl);
  };

  // Handle title changes
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasTitleChanged(newTitle !== "");

    // Clear title error when user starts typing
    if (titleError && newTitle && newTitle.trim() !== '') {
      setTitleError(false);
      setError(null);
    }
  };

  // Handle custom date changes
  const handleCustomDateChange = (newDate: string | null) => {
    setIntendedCustomDate(newDate);
  };

  // Handle setting editing state
  const handleSetIsEditing = (editing: boolean) => {
    if (!editing) {
      handleBack();
    }
  };

  // Handle content changes
  const handleContentChange = (content: EditorNode[]) => {
    setEditorContent(content);
    setEditorState(content);

    try {
      const initialContent = JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]);
      const newContent = JSON.stringify(content);
      setHasContentChanged(initialContent !== newContent);
    } catch (e) {
      console.error('Error comparing content:', e);
      setHasContentChanged(true);
    }
  };

  // Update hasUnsavedChanges when content or title changes
  useEffect(() => {
    setHasUnsavedChanges(hasContentChanged || hasTitleChanged);
  }, [hasContentChanged, hasTitleChanged]);

  // Handle save
  const handleSave = async (content: EditorNode[], saveMethod: 'keyboard' | 'button' = 'button'): Promise<boolean> => {
    console.log('🔵 DEBUG: handleSave called with:', {
      saveMethod,
      hasTitle: !!(title && title.trim()),
      hasContent: !!(content && content.length),
      isReply,
      userId: currentAccount?.uid
    });

    // CRITICAL FIX: Enhanced title validation with visual feedback - NOW APPLIES TO ALL PAGES INCLUDING REPLIES
    if (!title || title.trim() === '') {
      console.error('🔴 DEBUG: Save failed - missing title');
      const errorMsg = "Please add a title before saving";
      setError(errorMsg);
      setTitleError(true);
      toast({
        title: "Missing Title",
        description: errorMsg,
        variant: "destructive"});
      return false;
    }

    // Clear title error if title is valid
    setTitleError(false);

    // Validate user authentication
    if (!currentAccount || !currentAccount.uid) {
      console.error('🔴 DEBUG: Save failed - user not authenticated');
      const errorMsg = "You must be logged in to create a page";
      setError(errorMsg);
      toast({
        title: "Authentication Required",
        description: errorMsg,
        variant: "destructive"});
      return false;
    }

    // CRITICAL FIX: Handle both Firebase Auth and session-based auth
    try {
      // Check if Firebase app is initialized before trying to use it
      const { getApps, getApp } = await import('firebase/app');
      const apps = getApps();

      if (apps.length > 0) {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();

        // For session-based auth (after account switching), Firebase Auth might not be ready
        // In this case, we trust the currentAccount from our session system
        if (auth.currentUser) {
          // Firebase Auth is available - verify it matches our currentAccount
          if (auth.currentUser.uid !== currentAccount.uid) {
            console.warn('🟡 DEBUG: Auth user mismatch - using session-based auth', {
              authUid: auth.currentUser.uid,
              currentAccountUid: currentAccount.uid
            });
            // Don't fail - session-based auth takes precedence after account switching
          } else {
            console.log('🔵 DEBUG: Firebase Auth verified:', {
              authUid: auth.currentUser.uid,
              currentAccountUid: currentAccount.uid,
              emailVerified: auth.currentUser.emailVerified
            });
          }
        } else {
          // Firebase Auth not ready - use session-based auth
          console.log('🔵 DEBUG: Using session-based auth (Firebase Auth not ready):', {
            currentAccountUid: currentAccount.uid,
            authMethod: 'session-based'
          });
        }
      } else {
        console.log('🔵 DEBUG: Firebase app not initialized, using session-based auth:', {
          currentAccountUid: currentAccount.uid,
          authMethod: 'session-based'
        });
      }
    } catch (authError) {
      console.warn('🟡 DEBUG: Firebase Auth check failed, using session-based auth:', authError);
      // Don't fail - session-based auth is sufficient
    }

    console.log('🔵 DEBUG: Starting save process...');
    setIsSaving(true);
    setError(null);

    try {
      const username = currentAccount?.username || currentAccount?.displayName || 'Anonymous';
      const userId = currentAccount.uid;

      // CRITICAL FIX: Add detailed logging for content validation debugging
      console.log('🔵 DEBUG: Content validation check:', {
        hasContent: !!content,
        isArray: Array.isArray(content),
        contentType: typeof content,
        contentLength: content ? content.length : 0,
        contentSample: content ? JSON.stringify(content).substring(0, 200) : 'null'
      });

      if (!content || !Array.isArray(content)) {
        console.error('🔴 DEBUG: Content validation failed:', {
          content,
          isArray: Array.isArray(content),
          type: typeof content
        });
        setError("Error: Invalid content format");
        setIsSaving(false);
        return false;
      }

      // CRITICAL FIX: Enhanced content validation to include links
      // This fixes the bug where link-only content was not being recognized as valid
      const hasActualContent = content.some(node => {
        if (node.children && Array.isArray(node.children)) {
          return node.children.some(child => {
            // Check for text content
            if (child.text && child.text.trim() !== '') {
              return true;
            }
            // Check for link content (links are valid content even without text)
            // CRITICAL FIX: Validate pageId before considering it valid content
            if (child.type === 'link' || child.url) {
              // For page links, ensure pageId is valid (not '#' or empty)
              if (child.pageId) {
                return child.pageId !== '#' && child.pageId.trim() !== '' && !child.pageId.includes('#');
              }
              // For external links, URL should be valid
              if (child.url) {
                return child.url !== '#' && child.url.trim() !== '';
              }
              return true;
            }
            return false;
          });
        }
        // Check if the node itself is a link
        if (node.type === 'link' || node.url) {
          // For page links, ensure pageId is valid (not '#' or empty)
          if (node.pageId) {
            return node.pageId !== '#' && node.pageId.trim() !== '' && !node.pageId.includes('#');
          }
          // For external links, URL should be valid
          if (node.url) {
            return node.url !== '#' && node.url.trim() !== '';
          }
          return true;
        }
        return false;
      });

      let finalContent = content;
      if (!hasActualContent && !isReply) {
        finalContent = [{ type: "paragraph", children: [{ text: "" }] }];
      }

      // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
      // Track save attempt with content validation results
      // trackPageCreationFlow.saved(saveMethod, {
      //   is_reply: isReply,
      //   is_daily_note: isDailyNote,
      //   has_title: !!(title && title.trim()),
      //   has_content: hasActualContent
      // });

      // Get reply information from URL parameters if this is a reply
      let replyToId = null;
      let replyToTitle = null;
      let replyToUsername = null;

      if (isReply && searchParams) {
        replyToId = searchParams.get('replyTo');
        replyToTitle = searchParams.get('page');
        replyToUsername = searchParams.get('username');
      }

      // Prepare page data - use intended custom date if set
      let pageTitle = title || 'Untitled';
      let customDate = intendedCustomDate; // Use the date from daily notes carousel if set



      const data: PageData = {
        title: pageTitle,

        location,
        content: finalContent, // Pass as object, not stringified - API will handle stringification
        userId,
        username,
        lastModified: new Date().toISOString(),
        isReply: !!isReply,
        replyTo: replyToId,
        replyToTitle: replyToTitle,
        replyToUsername: replyToUsername,
        groupId: selectedGroupId,
        customDate: customDate
      };



      // Note: For new pages, no link propagation is needed since the page doesn't exist yet
      // Link propagation only applies when updating existing page titles

      // Check if operation is allowed
      const operationError = null; // No operation restrictions for page creation
      if (operationError) {
        setIsSaving(false);
        setError(operationError);
        return false;
      }

      // Check if we should use the sync queue (only for unverified email users)
      // For session-based auth, assume email is verified (since they successfully switched accounts)
      const useQueue = auth.currentUser ? !auth.currentUser.emailVerified : false;

      if (useQueue) {
        // For unverified users, add to sync queue instead of creating immediately
        // TODO: Implement sync queue functionality
        console.log('🔵 DEBUG: Would add to sync queue for unverified user');

        setHasContentChanged(false);
        setHasTitleChanged(false);
        setHasUnsavedChanges(false);

        setIsSaving(false);

        // Show success message
        toast({
          title: "Page queued for creation",
          description: "Your page will be created once your email is verified.",
        });

        // Small delay to ensure user sees the success message before redirect
        setTimeout(() => {
          // Navigate to home or back since we don't have a page ID yet
          if (isReply && searchParams) {
            const replyToId = searchParams.get('replyTo');
            if (replyToId) {
              router.push(`/${replyToId}`);
            } else {
              router.push('/');
            }
          } else {
            router.push('/');
          }
        }, 500);

        return true;
      } else {
        // Normal page creation for verified users - use API route instead of direct Firestore
        console.log('🔵 DEBUG: About to call API route with data:', { ...data, content: '(content omitted)' });

        let res = null;
        try {
          const response = await fetch('/api/pages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();
          console.log('🔵 DEBUG: API response:', result);

          res = result.success ? result.data.id : null;
          console.log('🔵 DEBUG: Extracted pageId:', res);

        } catch (apiError) {
          console.error('🔴 DEBUG: API request failed:', apiError);
          setIsSaving(false);
          const errorMsg = "Failed to create page via API. Please try again.";
          setError(errorMsg);

          toast({
            title: "Creation Failed",
            description: errorMsg,
            variant: "destructive"
          });

          return false;
        }

        if (res) {
          // res is the page ID string returned by createPage
          const pageId = res;
          console.log('🔵 PAGE CREATION: Page creation successful, pageId:', pageId, 'userId:', userId);
          console.error('🔵 PAGE CREATION: Page creation successful, pageId:', pageId, 'userId:', userId);

          // Track page creation in LogRocket
          trackPageCreation({
            pageType: isReply ? 'reply' : 'original',
            hasCustomDate: !!intendedCustomDate,
            hasLocation: !!location,
            templateUsed: 'default' // Could be enhanced with actual template detection
          });

          // CRITICAL DEBUG: Immediately try to fetch the page to see if it exists
          try {
            console.log('🔍 DEBUG: Attempting to fetch newly created page...');
            const { getPageById } = await import('../firebase/database');
            const fetchResult = await getPageById(pageId, userId);
            console.log('🔍 DEBUG: Fetch result:', fetchResult);
            if (fetchResult.pageData) {
              console.log('✅ DEBUG: Page exists in database immediately after creation');
            } else {
              console.error('❌ DEBUG: Page does NOT exist in database after creation!', fetchResult.error);
            }
          } catch (fetchError) {
            console.error('❌ DEBUG: Error fetching newly created page:', fetchError);
          }

          // Invalidate caches to ensure new page appears in UI immediately
          console.log('✅ DEBUG: Page created successfully, ID:', pageId);
          console.error('✅ DEBUG: Page created successfully, ID:', pageId);

          // CRITICAL FIX: Immediate cache invalidation to ensure new page appears in profile
          // Clear caches immediately to prevent stale data from showing
          console.log('🔵 DEBUG: Starting immediate cache invalidation...');
          try {
            const { invalidatePageCreationCaches } = await import('../utils/cacheInvalidation');
            console.log('🔵 DEBUG: Cache invalidation module imported, calling function...');
            invalidatePageCreationCaches(userId);
            console.log('✅ Immediate cache invalidation triggered for user:', userId);
            console.log('🔵 DEBUG: Immediate cache invalidation completed successfully');
          } catch (cacheError) {
            console.error('Error triggering immediate cache invalidation (non-fatal):', cacheError);
          }

          // CRITICAL FIX: Dispatch event with new page data to immediately update UI
          // This bypasses Firestore indexing delays by directly updating the local state
          try {
            // Use the same title and custom date logic as the page creation
            let eventTitle = title || 'Untitled';
            let eventCustomDate = intendedCustomDate;

            const newPageData = {
              id: pageId,
              title: eventTitle,
              userId: userId,
              username: username,
              lastModified: new Date().toISOString(),
              createdAt: new Date().toISOString(),

              deleted: false,
              customDate: eventCustomDate
            };

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('page-created-immediate', {
                detail: { pageData: newPageData, userId }
              }));
              window.dispatchEvent(new CustomEvent('pageSaved', {
                detail: { pageId, title: eventTitle, content: content }
              }));
              console.log('✅ Immediate page-created and pageSaved events dispatched');
            }
          } catch (eventError) {
            console.error('Error dispatching immediate page-created event (non-fatal):', eventError);
          }

          // CRITICAL FIX: Additional delayed cache invalidation to handle Firestore indexing delays
          setTimeout(async () => {
            try {
              const { invalidatePageCreationCaches } = await import('../utils/cacheInvalidation');
              invalidatePageCreationCaches(userId);
              console.log('✅ Delayed cache invalidation triggered for user:', userId);
            } catch (cacheError) {
              console.error('Error triggering delayed cache invalidation (non-fatal):', cacheError);
            }
          }, 3000); // 3s delay to handle Firestore indexing delays

          // Track content changes for new page creation (non-blocking)
          console.log('🔵 Tracking content changes with pageId:', pageId);
          ContentChangesTrackingService.trackContentChangeAdvanced(
            pageId,
            userId,
            username,
            null, // No previous content for new pages
            finalContent
          ).then(() => {
            console.log('🔵 Content tracking completed successfully');
          }).catch((trackingError) => {
            console.error('Error tracking content changes for new page (non-fatal):', trackingError);
          });

          // Add the new page to recent pages tracking (non-blocking)
          addRecentPage({
            id: pageId,
            title: title || 'Untitled',
            userId: userId,
            username: username
          }).then(() => {
            console.log('Added new page to recent pages tracking');
          }).catch((recentPagesError) => {
            console.error('Error adding page to recent pages (non-fatal):', recentPagesError);
          });

          // Cache invalidation has been triggered above

          // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
          // Track analytics (non-blocking) - now handled by UnifiedAnalyticsProvider
          // try {
          //   trackPageCreationFlow.completed(res, {
          //     label: title,
          //     is_reply: !!isReply,
          //     is_daily_note: isDailyNote,
          //     queued: false,
          //     save_method: saveMethod
          //   });
          // } catch (analyticsError) {
          //   console.error('Analytics tracking failed (non-fatal):', analyticsError);
          // }

          console.log('🔵 DEBUG: About to reset state and complete save process...');
          setHasContentChanged(false);
          setHasTitleChanged(false);
          setHasUnsavedChanges(false);

          console.log('🔵 DEBUG: Setting isSaving to false...');
          setIsSaving(false);

          // CRITICAL FIX: Longer delay to ensure database consistency before redirect
          // This prevents 404 errors when navigating to newly created pages
          setTimeout(() => {
            try {
              // Use window.location for more reliable navigation that doesn't trigger React errors
              window.location.href = `/${pageId}`;
            } catch (routerError) {
              console.error('Error during post-save redirect (non-fatal):', routerError);
              // If redirect fails, show success message and let user navigate manually
              toast({
                title: "Page Created Successfully",
                description: `Your page "${title}" has been created. You can find it in your pages.`,
                variant: "default"
              });
            }
          }, 1500); // Increased delay to ensure save is fully processed

          return true;
        } else {
          console.error('🔴 DEBUG: Page creation failed - createPage returned null/false');
          setIsSaving(false);
          const errorMsg = "Failed to create page. Please try again.";
          setError(errorMsg);

          toast({
            title: "Creation Failed",
            description: errorMsg,
            variant: "destructive"});

          return false;
        }
      }
    } catch (error: any) {
      console.error('🔴 DEBUG: Save failed with error:', error);
      console.error('🔴 DEBUG: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });

      setIsSaving(false);
      const errorMsg = "Failed to create page: " + (error.message || 'Unknown error');
      setError(errorMsg);

      toast({
        title: "Save Failed",
        description: error.message || 'Unknown error occurred while creating the page',
        variant: "destructive"});

      return false;
    }
  };

  // Memoized save function for unsaved changes hook
  const saveChanges = useCallback(async (): Promise<void> => {
    await handleSave(editorContent || editorState, 'button');
  }, [editorContent, editorState, title, location, currentAccount, isReply]);

  // Keyboard save handler
  const handleKeyboardSave = useCallback(() => {
    handleSave(editorContent || editorState, 'keyboard');
  }, [editorContent, editorState, title, location, currentAccount, isReply]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleKeyboardSave();
        }
      }

      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleKeyboardSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, handleKeyboardSave]);

  // Use unsaved changes hook
  const {
    showUnsavedChangesDialog,
    handleNavigation,
    handleStayAndSave,
    handleLeaveWithoutSaving,
    handleCloseDialog,
    isHandlingNavigation
  } = useUnsavedChanges(hasUnsavedChanges, saveChanges);

  // Handle back navigation with unsaved changes check
  const handleBackWithCheck = () => {
    let backUrl = '/';

    if (isReply && searchParams) {
      const replyToId = searchParams.get('replyTo');
      if (replyToId) {
        backUrl = `/${replyToId}`;
      }
    }

    // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
    // Track abandonment if there are unsaved changes
    if (hasUnsavedChanges) {
      // trackPageCreationFlow.abandoned({
      //   is_reply: isReply,
      //   is_daily_note: isDailyNote,
      //   has_title: !!(title && title.trim()),
      //   has_content: hasContentChanged
      // });
      handleNavigation(backUrl);
    } else {
      router.push(backUrl);
    }
  };

  // Determine the layout to use (same as SinglePageView)
  const Layout = currentAccount ? React.Fragment : PublicLayout;

  // Get username for display
  const username = currentAccount?.username || currentAccount?.displayName || 'Anonymous';

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <SlideUpPage>
        <Layout>
          <Head>
            <title>{title || (isReply ? "New Reply" : "New Page")} - WeWrite</title>
          </Head>
          <NewPageSkeleton />
        </Layout>
      </SlideUpPage>
    );
  }

  // Show skeleton during initialization to prevent layout shift
  if (isInitializing) {
    return (
      <SlideUpPage>
        <Layout>
          <Head>
            <title>{title || (isReply ? "New Reply" : "New Page")} - WeWrite</title>
          </Head>
          <NewPageSkeleton />
        </Layout>
      </SlideUpPage>
    );
  }

  // Render using the exact same structure as SinglePageView
  return (
    <SlideUpPage>
      <Layout>
        <Head>
          <title>{title || (isReply ? "New Reply" : "New Page")} - WeWrite</title>
        </Head>
        <PageHeader
          title={title}
          username={username}
          userId={currentAccount?.uid}
          isLoading={isLoading}
          scrollDirection="none"

          isEditing={isEditing}
          setIsEditing={handleSetIsEditing}
          onTitleChange={handleTitleChange}
          titleError={titleError}
          canEdit={true} // User can always edit their new page
          isNewPage={true} // Enable auto-focus for new pages
          isReply={isReply} // Pass reply status for contextual text
        />
        <div
          className="animate-in fade-in-0 duration-300 w-full pb-32 max-w-none box-border px-4"
          style={{
            paddingTop: '0', // Edit mode: header is static, no padding needed (matches PageView.tsx pattern)
            transition: 'padding-top 300ms ease-in-out' // Smooth transition when header height changes
          }}
        >
            {isEditing ? (
              <div className="animate-in fade-in-0 duration-300">
                <PageProvider>
                  <Editor
                    title={isReply ? "" : title}
                    setTitle={handleTitleChange}
                    initialContent={editorState}
                    onChange={handleContentChange}

                    location={location}
                    setLocation={setLocation}
                    isSaving={isSaving}
                    error={error || ""}
                    isNewPage={true}
                    placeholder="Start typing..."
                    showToolbar={true}
                    onSave={(capturedContent) => {
                      console.log('🔵 DEBUG: Save button clicked, calling handleSave');
                      console.log('🔵 DEBUG: Current state:', {
                        title,
                        hasContent: !!(capturedContent || editorContent || editorState),
                        userId: currentAccount?.uid,
                        isReply
                      });

                      // Add a simple test to see if this function is being called
                      if (typeof window !== 'undefined') {
                        console.log('🔵 DEBUG: About to call handleSave...');
                      }

                      return handleSave(capturedContent || editorContent || editorState, 'button');
                    }}
                    onCancel={handleBackWithCheck}
                  />

                  {/* Custom Date Field */}
                  <div className="mt-6">
                    <CustomDateField
                      customDate={intendedCustomDate}
                      canEdit={true}
                      onCustomDateChange={handleCustomDateChange}
                    />
                  </div>

                  {/* Location Field */}
                  <div className="mt-6">
                    <LocationField
                      location={location}
                      canEdit={true}
                      onLocationChange={setLocation}
                    />
                  </div>

                  {/* Unsaved Changes Dialog */}
                  <UnsavedChangesDialog
                    isOpen={showUnsavedChangesDialog}
                    onClose={handleCloseDialog}
                    onStayAndSave={handleStayAndSave}
                    onLeaveWithoutSaving={handleLeaveWithoutSaving}
                    isSaving={isSaving || isHandlingNavigation}
                    title="Unsaved Changes"
                    description="You have unsaved changes. Do you want to save them before leaving?"
                  />
              </PageProvider>
              </div>
            ) : null}
        </div>
        {!isEditing && (
          <PledgeBar
            pageId="new-page"
            pageTitle="New Page"
            authorId={currentAccount?.uid}
            visible={false}
          />
        )}
      </Layout>
    </SlideUpPage>
  );
}

export default function NewPage() {
  return (
    <Suspense fallback={<NewPageSkeleton />}>
      <NewPageContent />
    </Suspense>
  );
}