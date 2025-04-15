"use client";
import { useContext, useEffect, useState } from "react";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import ReactGA from 'react-ga4';
import PageHeader from "../components/PageHeader";
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
import Cookies from 'js-cookie';

/**
 * New Page Component
 *
 * This component renders the page creation form, handling both new pages and replies.
 * It detects if the page is a reply based on URL parameters and renders the appropriate header.
 */
const New = () => {
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  const searchParams = useSearchParams();
  const isReply = searchParams.has('isReply') || (searchParams.has('title') && searchParams.get('title').startsWith('Re:'));
  const { user, isAuthenticated } = useContext(AuthContext);

  // Check authentication status from cookies directly
  useEffect(() => {
    const isAuthenticatedCookie = Cookies.get('authenticated') === 'true';
    const userSessionCookie = Cookies.get('userSession');

    // Only redirect if we're sure the user is not authenticated
    if (!isAuthenticatedCookie && !userSessionCookie && !user) {
      console.log('User not authenticated, redirecting to login');
      router.push('/auth/login');
    }
  }, [router, user]);

  // Get username from URL parameters if available (for replies), otherwise use user data
  const urlUsername = searchParams.get('username');
  const username = urlUsername || user?.displayName || user?.username || 'Anonymous';

  return (
    <DashboardLayout>
      <PageHeader title={isReply ? "Replying to page" : "New page"} username={username} userId={user?.uid} />
      <div className="container w-full py-6 px-4">
        <div className="w-full">
          <Form Page={Page} setPage={setPage} isReply={isReply} />
        </div>
      </div>
    </DashboardLayout>
  );
};

/**
 * Form Component
 *
 * This component handles the form for creating new pages and replies.
 * It's responsible for:
 *
 * 1. Processing URL parameters to extract title and initial content
 * 2. Handling the Reply to Page functionality by:
 *    - Parsing and decoding the initialContent from URL parameters
 *    - Fetching the original page content when replying
 *    - Updating the blockquote with a summary of the original content
 *    - Ensuring proper initialization of the SlateEditor with the reply content
 * 3. Saving the new page to the database
 *
 * The component works closely with the SlateEditor component, which prioritizes
 * initialContent over initialEditorState to ensure replies are properly formatted.
 *
 * @param {Object} Page - The page object containing title and visibility settings
 * @param {Function} setPage - Function to update the page object
 * @param {boolean} isReply - Whether this is a reply to an existing page
 */
const Form = ({ Page, setPage, isReply }) => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();

  // Get username from URL parameters if available (for replies), otherwise use user data
  const urlUsername = searchParams.get('username');
  const username = urlUsername || user?.displayName || user?.username || 'Anonymous';

  let updateTime = new Date().toISOString();

  useEffect(() => {
    const titleParam = searchParams.get('title');
    const contentParam = searchParams.get('initialContent');
    const replyToParam = searchParams.get('replyTo');

    if (titleParam) {
      try {
        const decodedTitle = decodeURIComponent(titleParam);
        setPage(prev => ({ ...prev, title: decodedTitle }));
      } catch (error) {
        console.error("Error decoding title parameter:", error);
      }
    }

    if (contentParam) {
      try {
        const decodedContent = decodeURIComponent(contentParam);
        console.log("Received encoded content:", contentParam);
        console.log("Decoded content:", decodedContent);

        const parsedContent = JSON.parse(decodedContent);
        console.log("Setting initial content (FULL):", JSON.stringify(parsedContent, null, 2));

        // Always set the initialContent first to ensure it's available
        setInitialContent(parsedContent);
        console.log("initialContent set to:", parsedContent);

        // Also set the editor state immediately
        if (setEditorState) {
          console.log("Setting editor state directly");
          setEditorState(parsedContent);
        }

        // If this is a reply and we have a replyTo parameter, fetch the original page content
        if (isReply && replyToParam && parsedContent) {
          // Find the blockquote in the content
          const blockquoteIndex = parsedContent.findIndex(node => node.type === 'blockquote');

          if (blockquoteIndex !== -1) {
            // Fetch the original page content
            import('../firebase/database').then(({ getPageById }) => {
              getPageById(replyToParam).then(originalPage => {
                if (originalPage && originalPage.content) {
                  try {
                    // Parse the original content
                    const originalContent = typeof originalPage.content === 'string'
                      ? JSON.parse(originalPage.content)
                      : originalPage.content;

                    // Keep the existing blockquote text which should already contain
                    // "Reply to [page title] by [username]"
                    // No need to modify it as it's already set correctly in PageActions

                    // Update the initialContent
                    setInitialContent([...parsedContent]);

                    console.log("Updated reply content with original page reference:", parsedContent);
                  } catch (error) {
                    console.error("Error parsing original page content:", error);
                  }
                }
              }).catch(error => {
                console.error("Error fetching original page:", error);
              });
            });
          }
        }
      } catch (error) {
        console.error("Error parsing initial content:", error);
      }
    }
  }, [searchParams, setPage, setEditorState, isReply]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!isAuthenticated) {
      setError("You must be logged in to create a page");
      setIsSaving(false);
      return;
    }

    if (!Page.title) {
      setError("Please add a title");
      setIsSaving(false);
      return;
    }

    try {
      // Get the username from URL parameters if available (for replies)
      const urlUsername = searchParams.get('username');
      console.log("Username from URL:", urlUsername);
      console.log("User displayName:", user.displayName);
      console.log("User username:", user.username);

      // Use the username from URL if available, otherwise fallback to user data
      const username = urlUsername || user.displayName || user.username || 'Anonymous';
      console.log("Final username to use:", username);

      const data = {
        ...Page,
        content: JSON.stringify(editorState),
        userId: user.uid,
        username: username,
        lastModified: updateTime,
        isReply: isReply || false, // Add flag to indicate this is a reply page
      };

      const res = await createPage(data);
      if (res) {
        // Track with existing ReactGA for backward compatibility
        ReactGA.event({
          category: "Page",
          action: "Add new page",
          label: Page.title,
        });

        // Track with new analytics system
        analytics.trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, {
          label: Page.title,
          page_id: res,
          is_reply: !!isReply,
        });

        setIsSaving(false);
        router.push(`/pages/${res}`);
      } else {
        setIsSaving(false);
        console.log("Error creating page");
      }
    } catch (error) {
      setIsSaving(false);
      console.error("Error creating page:", error);
      setError("Failed to create page: " + error.message);
    }
  };

  return (
    <form
      className="space-y-6 px-4 sm:px-6 md:px-8"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <div className="max-w-2xl">
          <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">Title</label>
          <input
            id="title"
            type="text"
            value={Page.title}
            placeholder="Enter page title..."
            onChange={(e) => setPage({ ...Page, title: e.target.value })}
            className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-foreground mb-1">Content</label>
          <div className="min-h-[300px] border border-input rounded-md bg-background">
            <SlateEditor setEditorState={setEditorState} initialContent={initialContent} />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={Page.isPublic}
            onChange={(e) => setPage({ ...Page, isPublic: e.target.checked })}
            className="h-4 w-4 text-primary border-input rounded focus:ring-primary"
            autoComplete="off"
          />
          <label htmlFor="isPublic" className="text-sm text-foreground">Public</label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!Page.title || !editorState || isSaving}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => router.push("/pages")}
          className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
};

export default New;
