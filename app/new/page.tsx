"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Head from "next/head";
import PublicLayout from "../components/layout/PublicLayout";
import { createPage } from "../firebase/database";
// ReactGA removed - analytics now handled by UnifiedAnalyticsProvider
// Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
// import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { ContentChangesTrackingService } from "../services/contentChangesTracking";
import { useRecentPages } from "../contexts/RecentPagesContext";
// import { CONTENT_EVENTS } from "../constants/analytics-events";
import { createReplyAttribution } from "../utils/linkUtils";
import { AuthContext } from "../providers/AuthProvider";
import PageHeader from "../components/pages/PageHeader";
import PageEditor from "../components/editor/PageEditor";
import { useDateFormat } from "../contexts/DateFormatContext";

import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../components/utils/UnsavedChangesDialog";
import { PageProvider } from "../contexts/PageContext";

import TokenAllocationBar from "../components/payments/TokenAllocationBar";
import { shouldUseQueue, addToQueue, checkOperationAllowed } from "../utils/syncQueue";
import { useSyncQueue } from "../contexts/SyncQueueContext";
import SlideUpPage from "../components/ui/slide-up-page";
import { NewPageSkeleton } from "../components/skeletons/PageEditorSkeleton";
import { toast } from "../components/ui/use-toast";


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
  isPublic: boolean;
  location: any;
  content: string;
  userId: string;
  username: string;
  lastModified: string;
  isReply: boolean;
  replyTo?: string | null;
  replyToTitle?: string | null;
  replyToUsername?: string | null;
  groupId?: string | null;
}

/**
 * NewPage component that mimics SinglePageView structure for creating new pages
 * This component emulates the exact same architecture as editing an existing page
 */
export default function NewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
  // const { trackPageCreationFlow, trackEditingFlow } = useWeWriteAnalytics();
  const { refreshState } = useSyncQueue();
  const { addRecentPage } = useRecentPages();

  // RUTHLESS SIMPLIFICATION: No cache invalidation at all - just use short TTLs and browser refresh
  const { formatDateString } = useDateFormat();

  // State that mimics SinglePageView
  const [isEditing] = useState(true); // Always in editing mode for new pages
  const [editorState, setEditorState] = useState<EditorNode[]>([{ type: "paragraph", children: [{ text: "" }] }]);
  const [title, setTitle] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);
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
  const isDailyNote = searchParams?.get('type') === 'daily-note' || isExactDateFormat(title);

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

        // For daily notes, automatically format the title using user's preferred date format
        if (pageType === 'daily-note' && isExactDateFormat(trimmedTitle)) {
          // Keep the original YYYY-MM-DD format for storage, but the display will be formatted
          // The PageHeader component will handle the display formatting
          setTitle(trimmedTitle);
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
      isPublic: isPublic,
      location: location,
      userId: user?.uid || 'anonymous',
      username: user?.username || user?.displayName || 'Anonymous',
      content: JSON.stringify(editorState),
      lastModified: new Date().toISOString(),
      isReply: isReply
    };
    setPage(mockPage);
  }, [title, isPublic, location, user, editorState, isReply]);

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
        userId: user?.uid || '',
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

          // For daily notes, ensure we store the YYYY-MM-DD format for consistency
          if (pageType === 'daily-note' && isExactDateFormat(decodedTitle)) {
            setTitle(decodedTitle); // Keep YYYY-MM-DD format for storage
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
    // Prevent title changes for daily notes - they should be auto-generated
    if (isDailyNote) {
      return;
    }

    setTitle(newTitle);
    setHasTitleChanged(newTitle !== "");

    // Clear title error when user starts typing
    if (titleError && newTitle && newTitle.trim() !== '') {
      setTitleError(false);
      setError(null);
    }
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
      userId: user?.uid
    });

    // CRITICAL FIX: Enhanced title validation with visual feedback
    if (!title || title.trim() === '') {
      if (!isReply) {
        console.error('🔴 DEBUG: Save failed - missing title');
        const errorMsg = "Please add a title before saving";
        setError(errorMsg);
        setTitleError(true);
        toast({
          title: "Missing Title",
          description: errorMsg,
          variant: "destructive",
        });
        return false;
      }
    }

    // Clear title error if title is valid
    setTitleError(false);

    // Validate user authentication
    if (!user || !user.uid) {
      console.error('🔴 DEBUG: Save failed - user not authenticated');
      const errorMsg = "You must be logged in to create a page";
      setError(errorMsg);
      toast({
        title: "Authentication Required",
        description: errorMsg,
        variant: "destructive",
      });
      return false;
    }

    console.log('🔵 DEBUG: Starting save process...');
    setIsSaving(true);
    setError(null);

    try {
      const username = user?.username || user?.displayName || 'Anonymous';
      const userId = user.uid;

      if (!content || !Array.isArray(content)) {
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
            if (child.type === 'link' || child.url || child.pageId) {
              return true;
            }
            return false;
          });
        }
        // Check if the node itself is a link
        if (node.type === 'link' || node.url || node.pageId) {
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

      const data: PageData = {
        title: isReply ? "" : title,
        isPublic,
        location,
        content: JSON.stringify(finalContent),
        userId,
        username,
        lastModified: new Date().toISOString(),
        isReply: !!isReply,
        replyTo: replyToId,
        replyToTitle: replyToTitle,
        replyToUsername: replyToUsername,
        groupId: selectedGroupId,
      };

      // Note: For new pages, no link propagation is needed since the page doesn't exist yet
      // Link propagation only applies when updating existing page titles

      // Check if operation is allowed
      const operationError = checkOperationAllowed();
      if (operationError) {
        setIsSaving(false);
        setError(operationError);
        return false;
      }

      // Check if we should use the sync queue (only for unverified email users)
      const useQueue = shouldUseQueue();

      if (useQueue) {
        const operationId = addToQueue('create', data);

        // Disabled to prevent duplicate analytics tracking - UnifiedAnalyticsProvider handles this
        // Track analytics (non-blocking) - now handled by UnifiedAnalyticsProvider
        // try {
        //   trackPageCreationFlow.completed(operationId, {
        //     label: title,
        //     is_reply: !!isReply,
        //     is_daily_note: isDailyNote,
        //     queued: true,
        //     save_method: saveMethod
        //   });
        // } catch (analyticsError) {
        //   console.error('Analytics tracking failed (non-fatal):', analyticsError);
        // }

        setHasContentChanged(false);
        setHasTitleChanged(false);
        setHasUnsavedChanges(false);



        setIsSaving(false);

        // Refresh sync queue state
        refreshState();

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
        // Normal page creation for verified users
        console.log('🔵 DEBUG: About to call createPage with data:', { ...data, content: '(content omitted)' });
        const res = await createPage(data);
        console.log('🔵 DEBUG: createPage returned:', res);

        if (res) {
          // res is the page ID string returned by createPage
          const pageId = res;
          console.log('🔵 PAGE CREATION: Page creation successful, pageId:', pageId, 'userId:', userId);
          console.error('🔵 PAGE CREATION: Page creation successful, pageId:', pageId, 'userId:', userId);

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
          try {
            const { invalidatePageCreationCaches } = await import('../utils/cacheInvalidation');
            invalidatePageCreationCaches(userId);
            console.log('✅ Immediate cache invalidation triggered for user:', userId);
          } catch (cacheError) {
            console.error('Error triggering immediate cache invalidation (non-fatal):', cacheError);
          }

          // CRITICAL FIX: Dispatch event with new page data to immediately update UI
          // This bypasses Firestore indexing delays by directly updating the local state
          try {
            const newPageData = {
              id: pageId,
              title: title || 'Untitled',
              userId: userId,
              username: username,
              lastModified: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              isPublic: isPublic,
              deleted: false
            };

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('page-created-immediate', {
                detail: { pageData: newPageData, userId }
              }));
              console.log('✅ Immediate page-created event dispatched with page data');
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

          // Track content changes for new page creation
          try {
            console.log('🔵 Tracking content changes with pageId:', pageId);
            await ContentChangesTrackingService.trackContentChangeAdvanced(
              pageId,
              userId,
              username,
              null, // No previous content for new pages
              finalContent
            );
            console.log('🔵 Content tracking completed successfully');
          } catch (trackingError) {
            console.error('Error tracking content changes for new page (non-fatal):', trackingError);
          }

          // Add the new page to recent pages tracking
          try {
            await addRecentPage({
              id: pageId,
              title: title || 'Untitled',
              userId: userId,
              username: username
            });
            console.log('Added new page to recent pages tracking');
          } catch (recentPagesError) {
            console.error('Error adding page to recent pages (non-fatal):', recentPagesError);
          }

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

          setHasContentChanged(false);
          setHasTitleChanged(false);
          setHasUnsavedChanges(false);



          setIsSaving(false);

          // CRITICAL FIX: Longer delay to ensure database consistency before redirect
          // This prevents 404 errors when navigating to newly created pages
          setTimeout(() => {
            // Use replace instead of push to prevent back button issues
            router.replace(`/${pageId}`);
          }, 1000);

          return true;
        } else {
          console.error('🔴 DEBUG: Page creation failed - createPage returned null/false');
          setIsSaving(false);
          const errorMsg = "Failed to create page. Please try again.";
          setError(errorMsg);

          toast({
            title: "Creation Failed",
            description: errorMsg,
            variant: "destructive",
          });

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
        variant: "destructive",
      });

      return false;
    }
  };

  // Memoized save function for unsaved changes hook
  const saveChanges = useCallback((): Promise<boolean> => {
    return handleSave(editorContent || editorState, 'button');
  }, [editorContent, editorState, title, isPublic, location, user, isReply]);

  // Keyboard save handler
  const handleKeyboardSave = useCallback(() => {
    handleSave(editorContent || editorState, 'keyboard');
  }, [editorContent, editorState, title, isPublic, location, user, isReply]);

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
  const Layout = user ? React.Fragment : PublicLayout;

  // Get username for display
  const username = user?.username || user?.displayName || 'Anonymous';

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
          userId={user?.uid}
          isLoading={isLoading}
          scrollDirection="none"
          isPrivate={!isPublic}
          isEditing={isEditing}
          setIsEditing={handleSetIsEditing}
          onTitleChange={handleTitleChange}
          titleError={titleError}
          canEdit={true} // User can always edit their new page
          isNewPage={true} // Enable auto-focus for new pages
        />
        <div className="w-full max-w-none box-border">
          {/* Unified container with consistent layout matching SinglePageView */}
          <div
            className="px-4 py-4 w-full max-w-none box-border"
            style={{
              paddingTop: 'calc(var(--page-header-height, 80px) + 1rem)', // Add extra 1rem (16px) to prevent overlap
              transition: 'padding-top 300ms ease-in-out' // Smooth transition when header height changes
            }}
          >
            {isEditing ? (
              <div className="animate-in fade-in-0 duration-300">
                <PageProvider>
                  <PageEditor
                    title={isReply ? "" : title}
                    setTitle={isDailyNote ? () => {} : handleTitleChange} // Lock title for daily notes
                    initialContent={editorState}
                    onContentChange={handleContentChange}
                    isPublic={isPublic}
                    setIsPublic={setIsPublic}
                    location={location}
                    setLocation={setLocation}
                    isSaving={isSaving}
                    error={error || ""}
                    isNewPage={true}
                    isReply={isReply}
                    replyToId={searchParams?.get('replyTo') || ""}
                    clickPosition={null}
                    onSave={(capturedContent) => {
                      console.log('🔵 DEBUG: Save button clicked, calling handleSave');
                      console.log('🔵 DEBUG: Current state:', {
                        title,
                        hasContent: !!(capturedContent || editorContent || editorState),
                        userId: user?.uid,
                        isReply
                      });

                      // Add a simple test to see if this function is being called
                      if (typeof window !== 'undefined') {
                        console.log('🔵 DEBUG: About to call handleSave...');
                      }

                      return handleSave(capturedContent || editorContent || editorState, 'button');
                    }}
                    onKeyboardSave={(capturedContent) => handleSave(capturedContent || editorContent || editorState, 'keyboard')}
                    onCancel={handleBackWithCheck}

                    page={null} // No existing page for new pages
                  />

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
        </div>
        {!isEditing && (
          <TokenAllocationBar
            pageId="new-page"
            pageTitle="New Page"
            authorId={user?.uid}
            visible={false} // Don't show on new page creation
          />
        )}
      </Layout>
    </SlideUpPage>
  );
}