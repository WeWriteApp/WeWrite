"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
// Firebase imports removed - using Firestore instead of Realtime Database
import { listenToPageById, getPageVersions } from "../../firebase/database";
import { recordPageView } from "../../firebase/pageViews";
import { trackPageViewWhenReady } from "../../utils/analytics-page-titles";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { DataContext } from "../../providers/DataProvider";
import { TextSelectionProvider } from "../../providers/TextSelectionProvider";
import { PageProvider } from "../../contexts/PageContext";
import { useRecentPages } from "../../contexts/RecentPagesContext";
import { useLineSettings } from "../../contexts/LineSettingsContext";

// UI Components
import PublicLayout from "../layout/PublicLayout";
import PageHeader from "./PageHeader";
import PageFooter from "./PageFooter";
import PledgeBar from "../payments/PledgeBar";
import BacklinksSection from "../features/BacklinksSection";
import RelatedPagesSection from "../features/RelatedPagesSection";
import DeletedPageBanner from "../utils/DeletedPageBanner";
import UnifiedTextHighlighter from "../text-highlighting/UnifiedTextHighlighter";
import TextViewErrorBoundary from "../editor/TextViewErrorBoundary";
import { SmartLoader } from "../ui/smart-loader";
import { ErrorDisplay } from "../ui/error-display";
import { Button } from "../ui/button";
import { LineSettingsMenu } from "../utils/LineSettingsMenu";

// Editor Components
import Editor from "../editor/Editor";
import TextView from "../editor/TextView";

// Types
interface PageViewProps {
  params: Promise<{ id: string }> | { id: string };
  initialEditMode?: boolean;
  showVersion?: boolean;
  versionId?: string;
  showDiff?: boolean;
  compareVersionId?: string; // For diff comparison between two versions
}

interface Page {
  id: string;
  title: string;
  content: any;
  userId: string;
  isPublic: boolean;
  location?: string;
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
  const [isPublic, setIsPublic] = useState(true);
  const [location, setLocation] = useState('');
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [versionData, setVersionData] = useState<any>(null);
  const [compareVersionData, setCompareVersionData] = useState<any>(null);
  const [diffContent, setDiffContent] = useState<any>(null);

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

  // Constants
  const maxLoadAttempts = 3;
  const isPreviewingDeleted = searchParams?.get('preview') === 'deleted';

  // Handle params Promise
  useEffect(() => {
    console.log('📄 PageView params effect:', { params, unwrappedParams });
    if (params && typeof params.then === 'function') {
      console.log('📄 PageView: params is a Promise, resolving...');
      params.then((resolvedParams) => {
        console.log('📄 PageView: resolved params:', resolvedParams);
        setPageId(resolvedParams.id || '');
      });
    } else if (unwrappedParams) {
      console.log('📄 PageView: using unwrappedParams:', unwrappedParams);
      setPageId(unwrappedParams.id || '');
    }
  }, [params, unwrappedParams]);

  // Page loading effect
  useEffect(() => {
    console.log('📄 PageView useEffect triggered:', { pageId, currentAccountUid: currentAccount?.uid });
    if (!pageId) {
      console.log('📄 PageView: No pageId, returning early');
      return;
    }

    console.log('📄 PageView: Starting page load for pageId:', pageId);
    setIsLoading(true);
    setError(null);

    // If showing version or diff, load version data instead of live page
    if (showVersion && versionId) {
      console.log('📄 PageView: Loading version data');
      loadVersionData();
    } else if (showDiff && versionId) {
      console.log('📄 PageView: Loading diff data');
      loadDiffData();
    } else {
      console.log('📄 PageView: Setting up Firebase listener for pageId:', pageId);
      // Set up Firebase listener for live page
      const unsubscribe = listenToPageById(pageId, (data) => {
        console.log('📄 PageView received data:', {
          hasError: !!data.error,
          error: data.error,
          hasPageData: !!(data.pageData || data),
          hasVersionData: !!data.versionData,
          pageId: pageId,
          currentUser: currentAccount?.uid || 'anonymous'
        });

        if (data.error) {
          console.log('📄 PageView error:', data.error);
          setError(data.error);
          setIsLoading(false);
        } else {
          const pageData = data.pageData || data;
          const versionData = data.versionData;
          console.log('📄 PageView page data:', {
            id: pageData.id,
            title: pageData.title,
            isPublic: pageData.isPublic,
            hasContent: !!pageData.content,
            contentLength: pageData.content ? pageData.content.length : 0,
            userId: pageData.userId,
            hasVersionData: !!versionData,
            versionContentLength: versionData?.content ? versionData.content.length : 0
          });

          setPage(pageData);
          setTitle(pageData.title || '');
          setIsPublic(pageData.isPublic !== false);
          setLocation(pageData.location || '');

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
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [pageId, currentAccount?.uid, showVersion, versionId, showDiff, compareVersionId]);

  // Record page view and add to recent pages
  useEffect(() => {
    if (!viewRecorded.current && !isLoading && page && isPublic && pageId) {
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
              return userData.username || userData.displayName || 'Anonymous';
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
  }, [isLoading, page, isPublic, pageId, currentAccount?.uid, currentAccount, addRecentPage]);

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
      
      // Escape to cancel editing
      if (e.key === 'Escape' && isEditing) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, hasUnsavedChanges]);

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
          isPublic: true // Versions are always viewable if you have the link
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

        // Generate diff content
        const { generateDiffContent } = await import('../../utils/diffUtils');
        const diffResult = await generateDiffContent(
          compareVersion?.content || '',
          currentVersion.content || '',
          compareVersion?.title || 'Previous Version',
          currentVersion.title || 'Current Version'
        );

        setDiffContent(diffResult);
        setEditorState(diffResult);

        setPage({
          id: pageId,
          title: `Diff: ${currentVersion.title || 'Untitled'}`,
          userId: currentVersion.userId,
          isPublic: true
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
    setTitle(newTitle);
    setHasUnsavedChanges(true);
    setTitleError(null);
  }, []);

  const handleVisibilityChange = useCallback((newIsPublic: boolean) => {
    setIsPublic(newIsPublic);
    setHasUnsavedChanges(true);
  }, []);

  const handleLocationChange = useCallback((newLocation: string) => {
    setLocation(newLocation);
    setHasUnsavedChanges(true);
  }, []);

  const handleSetIsEditing = useCallback((editing: boolean, position?: { x: number; y: number }) => {
    setIsEditing(editing);
    if (position) {
      setClickPosition(position);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!page || !pageId) return;

    // Validate title is not empty
    if (!title || title.trim() === '') {
      setTitleError("Title is required");
      setError("Please add a title before saving");
      return;
    }

    setIsSaving(true);
    setError(null);
    setTitleError(null);

    try {
      const contentToSave = editorState;
      const editorStateJSON = JSON.stringify(contentToSave);

      // Use the Firestore-based updatePage function that includes backlinks indexing
      const { updatePage } = await import('../../firebase/database');

      const updateData = {
        title: title.trim(),
        content: editorStateJSON,
        isPublic,
        location: location.trim(),
        lastModified: new Date().toISOString()
      };

      console.log('🔄 Updating page with backlinks indexing:', pageId);
      const success = await updatePage(pageId, updateData);

      if (!success) {
        throw new Error('Failed to update page');
      }

      console.log('✅ Page updated successfully with backlinks indexing');
      setHasUnsavedChanges(false);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving page:", error);
      setError("Failed to save page. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [page, pageId, editorState, title, isPublic, location]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
      if (!confirmCancel) return;
    }
    
    // Reset to original values
    setTitle(page?.title || '');
    setIsPublic(page?.isPublic !== false);
    setLocation(page?.location || '');
    setEditorState(page?.content ? JSON.parse(page.content) : [{ type: "paragraph", children: [{ text: "" }] }]);
    setHasUnsavedChanges(false);
    setIsEditing(false);
    setClickPosition(null);
  }, [hasUnsavedChanges, page]);

  const handleDelete = useCallback(async () => {
    if (!page || !pageId) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this page? You'll have 30 days to recover it from your Recently Deleted pages."
    );
    if (!confirmDelete) return;

    try {
      // Use the proper soft delete function from Firestore
      const { deletePage } = await import('../../firebase/database');

      const success = await deletePage(pageId);

      if (success) {
        console.log(`Successfully soft deleted page ${pageId}`);
        router.push('/');
      } else {
        setError("Failed to delete page. Please try again.");
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
            isPrivate={!isPublic}
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
            className="animate-in fade-in-0 duration-300 w-full pb-32 max-w-none box-border px-4 sm:px-6 md:px-8"
            style={{
              paddingTop: 'var(--page-header-height, 80px)',
              transition: 'padding-top 300ms ease-in-out'
            }}
          >
            <TextSelectionProvider
              contentRef={contentRef}
              enableCopy={true}
              enableShare={true}
              enableAddToPage={true}
              username={currentAccount?.displayName || currentAccount?.username}
            >
              <div ref={contentRef}>
                <TextViewErrorBoundary fallbackContent={
                  <div className="p-4 text-muted-foreground">
                    <p>Unable to display page content. The page may have formatting issues.</p>
                    <p className="text-sm mt-2">Page ID: {page.id}</p>
                  </div>
                }>
                  {isEditing ? (
                    <Editor
                      ref={editorRef}
                      key={`editor-${page.id}`}
                      initialContent={editorState}
                      onChange={handleContentChange}
                      readOnly={false}
                      canEdit={canEdit}
                      onSetIsEditing={handleSetIsEditing}
                      user={currentAccount}
                      currentPage={page}
                      contentType="wiki"
                      placeholder="Start typing..."
                      isEditMode={true}
                      isNewPage={false}
                    />
                  ) : (
                    <TextView
                      key={`textview-${page.id}-${showVersion ? 'version' : showDiff ? 'diff' : 'normal'}`}
                      content={editorState}
                      page={page}
                      canEdit={canEdit}
                      setIsEditing={handleSetIsEditing}
                      user={currentAccount}
                      contentType="wiki"
                      isEditing={false}
                      showDiff={showDiff}
                      viewMode={showDiff ? "diff" : "normal"}
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

            {/* Page Footer with actions */}
            <PageFooter
              page={memoizedPage}
              linkedPageIds={memoizedLinkedPageIds}
              isEditing={isEditing}
              canEdit={canEdit}
              isOwner={canEdit} // Add isOwner prop - same logic as canEdit for ownership
              title={title}
              isPublic={isPublic}
              location={location}
              onTitleChange={handleTitleChange}
              onVisibilityChange={handleVisibilityChange}
              onLocationChange={handleLocationChange}
              onSave={handleSave}
              onCancel={handleCancel}
              onDelete={handleDelete}
              onEdit={() => setIsEditing(true)}
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
        </div>
      </PageProvider>
    </PublicLayout>
  );
}