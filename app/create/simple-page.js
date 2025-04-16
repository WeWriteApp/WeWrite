"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebase/auth";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import DashboardLayout from "../DashboardLayout";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import PageHeader from "../components/PageHeader";
import { useSearchParams } from "next/navigation";
import ReactGA from 'react-ga4';
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";

/**
 * A simple page creation component that uses Firebase Auth directly
 */
export default function SimpleCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const analytics = useWeWriteAnalytics();
  const isReply = searchParams.has('isReply') || (searchParams.has('title') && searchParams.get('title').startsWith('Re:'));

  // Check Firebase Auth state
  useEffect(() => {
    console.log("SimpleCreatePage: Checking Firebase Auth state");
    
    // Check if user is authenticated
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      console.log("SimpleCreatePage: Auth state changed:", firebaseUser ? "User logged in" : "User logged out");
      
      if (firebaseUser) {
        // User is signed in to Firebase
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.displayName || '',
          displayName: firebaseUser.displayName || '',
        };
        
        console.log("SimpleCreatePage: Using Firebase user:", userData);
        setUser(userData);
        setIsLoading(false);
      } else {
        // User is signed out of Firebase
        console.log("SimpleCreatePage: No Firebase user, redirecting to login");
        setError("You must be logged in to create a page");
        setIsLoading(false);
        
        // Redirect to login page
        router.push('/auth/login');
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  // Handle URL parameters for replies
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
        console.log("Setting initial content:", parsedContent);

        // Set the initial content
        setInitialContent(parsedContent);
        
        // Also set the editor state immediately
        if (setEditorState) {
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
                    // Update the initialContent
                    setInitialContent([...parsedContent]);
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
  }, [searchParams, isReply]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    // Check if user is authenticated
    if (!user) {
      setError("You must be logged in to create a page");
      setIsSaving(false);
      return;
    }

    // Check if title is provided
    if (!Page.title) {
      setError("Please add a title");
      setIsSaving(false);
      return;
    }

    try {
      // Get the username from URL parameters if available (for replies)
      const urlUsername = searchParams.get('username');
      
      // Use the username from URL if available, otherwise fallback to user data
      const username = urlUsername || user.username || user.displayName || 'Anonymous';
      
      // Get the user ID
      const userId = user.uid;

      if (!userId) {
        setError("Unable to determine user ID. Please try logging in again.");
        setIsSaving(false);
        return;
      }

      const data = {
        ...Page,
        content: JSON.stringify(editorState),
        userId: userId,
        username: username,
        lastModified: new Date().toISOString(),
        isReply: isReply || false,
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
      setError("Failed to create page: " + (error.message || 'Unknown error'));
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Get username for display
  const urlUsername = searchParams.get('username');
  const username = urlUsername || user?.displayName || user?.username || 'Anonymous';

  // Render the page creation form
  return (
    <DashboardLayout>
      <PageHeader title={isReply ? "Replying to page" : "New page"} username={username} userId={user?.uid} />
      <div className="container w-full py-6 px-4">
        <div className="w-full">
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
        </div>
      </div>
    </DashboardLayout>
  );
}
