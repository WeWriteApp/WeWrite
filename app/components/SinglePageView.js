// This is a temporary file to fix the issue
"use client";
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import TextSelectionMenu from "./TextSelectionMenu";
import TextHighlighter from "./TextHighlighter";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { app } from "../firebase/config";
import { listenToPageById, getPageVersions } from "../firebase/database";
import { recordPageView } from "../firebase/pageViews";
import PageViewCounter from "./PageViewCounter";
import { AuthContext } from "../providers/AuthProvider";
import { DataContext } from "../providers/DataProvider";
import { createEditor } from "slate";
import { withHistory } from "slate-history";
import { Slate, Editable, withReact } from "slate-react";
import DashboardLayout from "../DashboardLayout";
import PublicLayout from "./layout/PublicLayout";
import PageHeader from "./PageHeader.tsx";
import PageFooter from "./PageFooter";
import SiteFooter from "./SiteFooter";
import PledgeBar from "./PledgeBar";
import RelatedPages from "./RelatedPages";
import Link from "next/link";
import Head from "next/head";
import { Button } from "./ui/button";
import { EditorContent } from "./SlateEditor";
import TextView from "./TextView";
import {
  Loader,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
// toast import removed (unused)
import { RecentPagesContext } from "../contexts/RecentPagesContext";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { PageProvider } from "../contexts/PageContext";
import { LineSettingsProvider, useLineSettings } from "../contexts/LineSettingsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command';
import EditPage from "./EditPage";
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
function SinglePageView({ params }) {
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
  const { user } = useContext(AuthContext);
  const { recentPages = [], addRecentPage } = useContext(RecentPagesContext) || {};
  const { lineMode } = useLineSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contentRef = useRef(null);

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
    setIsEditing,
    // Only allow editing if:
    // 1. Page is loaded (!isLoading)
    // 2. Page exists (page !== null)
    // 3. Page isn't deleted (!isDeleted)
    // 4. User owns the page (regardless of whether it's public or private)
    canEdit: Boolean(
      !isLoading &&
      page !== null &&
      !isDeleted &&
      user?.uid &&
      page?.userId &&
      user.uid === page.userId
    )
  });

  // Use a ref to track if we've already recorded a view for this page
  const viewRecorded = useRef(false);

  // Record page view once when the page has loaded
  useEffect(() => {
    // Only proceed if we haven't recorded a view yet, the page is loaded, public, and we have the data
    if (!viewRecorded.current && !isLoading && page && isPublic) {
      // Mark that we've recorded the view to prevent duplicate recordings
      viewRecorded.current = true;
      // Record the page view
      recordPageView(params.id, user?.uid);
      console.log('Recording page view for', params.id);
    }
  }, [params.id, isLoading, page, isPublic, user?.uid]);

  useEffect(() => {
    if (params.id) {
      setIsLoading(true);

      // Make sure we pass the user ID to the listenToPageById function
      const currentUserId = user?.uid || null;
      console.log(`Setting up page listener with user ID: ${currentUserId || 'anonymous'}`);

      const unsubscribe = listenToPageById(params.id, async (data) => {
        if (data.error) {
          setError(data.error);
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
        setGroupId(pageData.groupId || null);
        setGroupName(pageData.groupName || null);

        // Set page title for document title
        if (pageData.title) {
          // If the page has a title of "Untitled", add a more descriptive suffix
          if (pageData.title === "Untitled") {
            setTitle(`Untitled (${pageData.id.substring(0, 6)})`);
          } else {
            setTitle(pageData.title);
          }
        }

        if (data.versionData) {
          try {
            const contentString = data.versionData.content;
            console.log("Received content update", {
              contentLength: contentString ? contentString.length : 0,
              isString: typeof contentString === 'string',
              timestamp: new Date().toISOString()
            });

            const parsedContent = typeof contentString === 'string'
              ? JSON.parse(contentString)
              : contentString;

            // Update editor state without comparing to avoid circular dependencies
            console.log("Updating editor state with new content");
            setEditorState(parsedContent);
            setEditorError(null); // Clear any previous errors
          } catch (error) {
            console.error("Error parsing content:", error);
            setEditorError("There was an error loading the editor. Please try refreshing the page.");
          }
        }

        setIsLoading(false);
      }, currentUserId); // Pass the user ID here

      return () => {
        unsubscribe();
      };
    }
  }, [params.id, user?.uid]); // Added user?.uid as a dependency

  // Check for edit=true URL parameter and set isEditing state
  useEffect(() => {
    if (searchParams && searchParams.get('edit') === 'true' && !isLoading && page) {
      // Only set editing mode if the user is the owner of the page
      if (user && user.uid === page.userId) {
        console.log('Setting edit mode from URL parameter');
        setIsEditing(true);
      } else {
        console.log('User is not the owner of the page, cannot edit');
      }
    }
  }, [searchParams, isLoading, page, user]);

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
  const extractLinkedPageIds = (content) => {
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
  };

  // Function to handle when page content is fully rendered
  const handlePageFullyRendered = () => {
    setPageFullyRendered(true);
  };

  const Layout = user ? DashboardLayout : PublicLayout;

  // If the page is deleted, use NotFoundWrapper
  if (isDeleted) {
    const NotFoundWrapper = dynamic(() => import('../not-found-wrapper'), { ssr: false });
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
      const NotFoundWrapper = dynamic(() => import('../not-found-wrapper'), { ssr: false });
      return <NotFoundWrapper />;
    }

    return (
      <Layout>
        <Head>
          <title>Page Not Found - WeWrite</title>
        </Head>
        <PageHeader />
        <div className="min-h-[400px] w-full">
          {isLoading ? (
            <Loader />
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 p-4 rounded-lg max-w-md">
                <h2 className="text-xl font-medium mb-2">Access Error</h2>
                <p>{error}</p>
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
        <div className="flex items-center justify-center min-h-[50vh] w-full">
          <div className="loader loader-lg"></div>
        </div>
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
        <div className="p-4">
          <h1 className="text-2xl font-semibold text-text">
            Error
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-red-500"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span className="text-lg text-text">
              {error}
            </span>
            <Link href="/">
              <button className="bg-background text-button-text px-4 py-2 rounded-full">
                Go back
              </button>
            </Link>
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

  return (
    <Layout>
      <Head>
        <title>{title} - WeWrite</title>
      </Head>
      <PageHeader
        title={isEditing ? "Editing page" : title}
        username={page?.username || "Anonymous"}
        userId={page?.userId}
        isLoading={isLoading}
        groupId={groupId}
        groupName={groupName}
        scrollDirection={scrollDirection}
        isPrivate={!isPublic}
      />
      <div className="pb-24 px-0 sm:px-2 w-full max-w-none min-h-screen">
        {isEditing ? (
          <PageProvider>
            <LineSettingsProvider>
              <EditPage
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                page={page}
                title={title}
                setTitle={setTitle}
                current={editorState}
                editorError={editorError}
              />
            </LineSettingsProvider>
          </PageProvider>
        ) : (
          <>
            <div className="space-y-2 w-full transition-all duration-200 ease-in-out">
              <div className="page-content w-full max-w-none break-words px-1">
                <PageProvider>
                  <LineSettingsProvider>
                    <div ref={contentRef}>
                      <TextView
                        key={`content-${page.id}`} /* Use stable key based on page ID */
                        content={editorState}
                        viewMode={lineMode}
                        onRenderComplete={handlePageFullyRendered}
                        setIsEditing={setIsEditing}
                        canEdit={user?.uid === page?.userId}
                      />
                      {/* Add text selection menu */}
                      <TextSelectionMenu contentRef={contentRef} />
                      {/* Add text highlighter */}
                      <TextHighlighter contentRef={contentRef} />
                    </div>
                  </LineSettingsProvider>
                </PageProvider>
              </div>
            </div>

            {/* Related Pages - Only show after content is fully rendered */}
            {pageFullyRendered && (
              <div className="container max-w-4xl mx-auto px-4">
                <RelatedPages
                  page={page}
                  linkedPageIds={extractLinkedPageIds(editorState)}
                />
              </div>
            )}
          </>
        )}
      </div>
      <PageProvider>
        <LineSettingsProvider>
          <PageFooter
            page={page}
            content={editorState}
            isOwner={user?.uid === page?.userId}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
          />
        </LineSettingsProvider>
      </PageProvider>
      <SiteFooter />
      {!isEditing && <PledgeBar />}
    </Layout>
  );
}

// AddToPageDialog component has been moved to PageActions.tsx
// This implementation is no longer used and has been removed to avoid duplication

export default SinglePageView;
