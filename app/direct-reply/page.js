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
 * A direct reply page component that doesn't rely on any authentication
 * and always allows replying to pages
 */
export default function DirectReplyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState({
    uid: 'anonymous',
    email: 'anonymous@example.com',
    username: 'Anonymous',
    displayName: 'Anonymous'
  });
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();
  const isReply = true; // This is always a reply page

  // Try to get user data from cookies and session storage
  useEffect(() => {
    console.log("DirectReplyPage: Getting user data from cookies and session storage");
    
    // Try to get user data from multiple sources
    let userData = null;
    
    // 1. Try to get user data from wewrite_accounts in sessionStorage
    try {
      const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
      if (wewriteAccounts) {
        const accounts = JSON.parse(wewriteAccounts);
        const currentAccount = accounts.find(acc => acc.isCurrent);
        
        if (currentAccount) {
          console.log("DirectReplyPage: Found current account in wewrite_accounts:", currentAccount);
          userData = currentAccount;
        }
      }
    } catch (error) {
      console.error("DirectReplyPage: Error getting user data from wewrite_accounts:", error);
    }
    
    // 2. Try to get user data from wewrite_user_id cookie and wewrite_accounts
    if (!userData) {
      try {
        const wewriteUserId = Cookies.get('wewrite_user_id');
        if (wewriteUserId) {
          console.log("DirectReplyPage: Found wewrite_user_id cookie:", wewriteUserId);
          
          // Try to find the account in wewrite_accounts
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const account = accounts.find(acc => acc.uid === wewriteUserId);
            
            if (account) {
              console.log("DirectReplyPage: Found account in wewrite_accounts by user ID:", account);
              userData = account;
            }
          }
        }
      } catch (error) {
        console.error("DirectReplyPage: Error getting user data from wewrite_user_id:", error);
      }
    }
    
    // 3. Try to get user data from userSession cookie
    if (!userData) {
      try {
        const userSessionCookie = Cookies.get('userSession');
        if (userSessionCookie) {
          const userSession = JSON.parse(userSessionCookie);
          if (userSession && userSession.uid) {
            console.log("DirectReplyPage: Found user data in userSession cookie:", userSession);
            userData = userSession;
          }
        }
      } catch (error) {
        console.error("DirectReplyPage: Error getting user data from userSession cookie:", error);
      }
    }
    
    // If we found user data, use it
    if (userData) {
      console.log("DirectReplyPage: Using user data:", userData);
      setUser(userData);
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
        if (replyToParam && parsedContent) {
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
  }, [searchParams]);

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
        isReply: true,
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
          is_reply: true,
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

  // Get username for display
  const urlUsername = searchParams.get('username');
  
  // Try to get a better username from multiple sources
  let username = urlUsername || user?.displayName || user?.username || '';
  
  // If we still don't have a username, try to get it from other sources
  if (!username) {
    try {
      // Try to get username from wewrite_accounts in sessionStorage
      const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
      if (wewriteAccounts) {
        const accounts = JSON.parse(wewriteAccounts);
        const currentAccount = accounts.find(acc => acc.isCurrent);
        
        if (currentAccount && (currentAccount.username || currentAccount.displayName)) {
          username = currentAccount.username || currentAccount.displayName;
          console.log("Found username in wewrite_accounts:", username);
        }
      }
    } catch (error) {
      console.error("Error getting username from wewrite_accounts:", error);
    }
  }
  
  // If we still don't have a username, try to get it from userSession cookie
  if (!username) {
    try {
      const userSessionCookie = Cookies.get('userSession');
      if (userSessionCookie) {
        const userSession = JSON.parse(userSessionCookie);
        if (userSession && (userSession.username || userSession.displayName)) {
          username = userSession.username || userSession.displayName;
          console.log("Found username in userSession cookie:", username);
        }
      }
    } catch (error) {
      console.error("Error getting username from userSession cookie:", error);
    }
  }
  
  // If we still don't have a username, use 'Anonymous'
  if (!username) {
    username = 'Anonymous';
  }

  // Render the page creation form
  return (
    <DashboardLayout>
      <PageHeader title="Replying to page" username={username} userId={user?.uid} />
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
                  onChange={(e) => setPage(prev => ({ ...prev, title: e.target.value }))}
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
