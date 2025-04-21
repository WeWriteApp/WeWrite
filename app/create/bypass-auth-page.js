"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "../DashboardLayout";
import SlateEditor from "../components/SlateEditor";
import { createPage } from "../firebase/database";
import PageHeader from "../components/PageHeader";
import ReactGA from 'react-ga4';
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
import Cookies from 'js-cookie';

/**
 * A page creation component that bypasses authentication checks
 * and directly uses cookies and session storage to get user data
 */
export default function BypassAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();
  const isReply = searchParams.has('isReply') || (searchParams.has('title') && searchParams.get('title').startsWith('Re:'));

  // Get user data from cookies and session storage
  useEffect(() => {
    console.log("BypassAuthPage: Getting user data from cookies and session storage");
    
    // Try to get user data from multiple sources
    let userData = null;
    
    // 1. Try to get user data from wewrite_accounts in sessionStorage
    try {
      const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
      if (wewriteAccounts) {
        const accounts = JSON.parse(wewriteAccounts);
        const currentAccount = accounts.find(acc => acc.isCurrent);
        
        if (currentAccount) {
          console.log("BypassAuthPage: Found current account in wewrite_accounts:", currentAccount);
          userData = currentAccount;
        }
      }
    } catch (error) {
      console.error("BypassAuthPage: Error getting user data from wewrite_accounts:", error);
    }
    
    // 2. Try to get user data from wewrite_user_id cookie and wewrite_accounts
    if (!userData) {
      try {
        const wewriteUserId = Cookies.get('wewrite_user_id');
        if (wewriteUserId) {
          console.log("BypassAuthPage: Found wewrite_user_id cookie:", wewriteUserId);
          
          // Try to find the account in wewrite_accounts
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const account = accounts.find(acc => acc.uid === wewriteUserId);
            
            if (account) {
              console.log("BypassAuthPage: Found account in wewrite_accounts by user ID:", account);
              userData = account;
            }
          }
        }
      } catch (error) {
        console.error("BypassAuthPage: Error getting user data from wewrite_user_id:", error);
      }
    }
    
    // 3. Try to get user data from userSession cookie
    if (!userData) {
      try {
        const userSessionCookie = Cookies.get('userSession');
        if (userSessionCookie) {
          const userSession = JSON.parse(userSessionCookie);
          if (userSession && userSession.uid) {
            console.log("BypassAuthPage: Found user data in userSession cookie:", userSession);
            userData = userSession;
          }
        }
      } catch (error) {
        console.error("BypassAuthPage: Error getting user data from userSession cookie:", error);
      }
    }
    
    // 4. Try to get user data from authenticated cookie
    if (!userData) {
      try {
        const authenticated = Cookies.get('authenticated');
        if (authenticated === 'true') {
          console.log("BypassAuthPage: Found authenticated cookie");
          
          // Try to create a minimal user object
          const uid = Cookies.get('wewrite_user_id') || 'unknown';
          const email = Cookies.get('email') || 'unknown@example.com';
          const username = Cookies.get('username') || 'Anonymous';
          
          userData = { uid, email, username, displayName: username };
          console.log("BypassAuthPage: Created minimal user object:", userData);
        }
      } catch (error) {
        console.error("BypassAuthPage: Error getting user data from authenticated cookie:", error);
      }
    }
    
    // If we found user data, use it
    if (userData) {
      console.log("BypassAuthPage: Using user data:", userData);
      setUser(userData);
      setIsLoading(false);
    } else {
      // If we didn't find user data, create a fake user
      console.log("BypassAuthPage: No user data found, creating fake user");
      
      // Create a fake user with a random ID
      const fakeUser = {
        uid: 'fake-user-' + Math.random().toString(36).substring(2, 15),
        email: 'anonymous@example.com',
        username: 'Anonymous',
        displayName: 'Anonymous'
      };
      
      console.log("BypassAuthPage: Created fake user:", fakeUser);
      setUser(fakeUser);
      setIsLoading(false);
    }
  }, []);

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
      const username = urlUsername || user?.username || user?.displayName || 'Anonymous';
      
      // Get the user ID
      const userId = user?.uid || 'anonymous';

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
          <p className="text-muted-foreground">Preparing page editor...</p>
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
                  onChange={(e) => setPage({ ...prev => ({ ...prev, title: e.target.value }))}
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
                  onChange={(e) => setPage(prev => ({ ...prev, isPublic: e.target.checked }))}
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
