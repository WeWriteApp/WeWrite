"use client";
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { useLineSettings, LINE_MODES, LineSettingsProvider } from "../contexts/LineSettingsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from './ui/dialog';
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
    // 3. Page is public (isPublic)
    // 4. Page isn't deleted (!isDeleted)
    // 5. User owns the page
    canEdit: Boolean(
      !isLoading &&
      page !== null &&
      isPublic &&
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
      });

      return () => {
        unsubscribe();
      };
    }
  }, [params.id]); // Removed editorState from dependencies to prevent infinite loop

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

  // Function to handle when page content is fully rendered
  const handlePageFullyRendered = () => {
    setPageFullyRendered(true);
  };

  const Layout = user ? DashboardLayout : PublicLayout;

  // If the page is deleted, show a message
  if (isDeleted) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <h1 className="text-2xl font-bold mb-4">Page not found</h1>
          <p className="text-muted-foreground mb-6">This page may have been deleted or never existed.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </Layout>
    );
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
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-xl font-medium mb-2">Page Not Found</h2>
              <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist or has been removed.</p>
              <Link href="/">
                <Button variant="outline">Return Home</Button>
              </Link>
            </div>
          )}
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

  if (!isPublic && (!user || user.uid !== page.userId)) {
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
              className="h-5 w-5 text-muted-foreground"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span className="text-lg text-muted-foreground">This page is private</span>
            <Link href={user ? "/" : "/auth/login"}>
              <button className="bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
                {user ? "Go back" : "Log in"}
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
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
      />
      <div className="pb-24 px-0 sm:px-2 w-full max-w-none">
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
                    <TextView
                      key={Date.now()} /* Use timestamp as key to force re-render on every change */
                      content={editorState}
                      viewMode={lineMode}
                      onRenderComplete={handlePageFullyRendered}
                      setIsEditing={setIsEditing}
                      canEdit={user?.uid === page?.userId}
                    />
                  </LineSettingsProvider>
                </PageProvider>
              </div>
            </div>

            {/* Page Controls - Only show after content is fully rendered */}
            {pageFullyRendered && (
              <div className="mt-8 flex flex-col gap-4">
                {user && user.uid === page.userId && !isEditing && (
                  <div className="mt-8">
                    {/* ActionRow removed - now using PageFooter with PageActions instead */}
                  </div>
                )}
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
