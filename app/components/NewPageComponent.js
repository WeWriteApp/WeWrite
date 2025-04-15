"use client";

import { useContext, useEffect, useState } from "react";
import SlateEditor from "./SlateEditor";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import ReactGA from 'react-ga4';
import PageHeader from "./PageHeader";
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
// Import auth directly to avoid reference errors
import { auth } from "../firebase/auth";
// Import our new ensureAuth utility
import ensureAuth from "../utils/ensureAuth";


/**
 * New Page Component
 *
 * This component renders the page creation form, handling both new pages and replies.
 * It detects if the page is a reply based on URL parameters and renders the appropriate header.
 */
const NewPageComponent = ({ forcedUser }) => {
  const [Page, setPage] = useState({
    title: "",
    isPublic: true,
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReply = searchParams.has('isReply') || (searchParams.has('title') && searchParams.get('title').startsWith('Re:'));
  const { user: contextUser } = useContext(AuthContext);

  // Use the forced user if provided, otherwise use the user from context
  const user = forcedUser || contextUser;

  console.log('New page component initialized with user:', user);
  console.log('Forced user:', forcedUser);
  console.log('Context user:', contextUser);

  // Check authentication using our centralized utility
  useEffect(() => {
    // Call our ensureAuth utility to make sure authentication is properly set up
    const isAuthEnsured = ensureAuth();
    console.log('ensureAuth result:', isAuthEnsured);

    // Import the utility here to ensure it's only used on the client
    const { isAuthenticated } = require('../utils/currentUser');

    // Add more detailed logging to diagnose authentication issues
    console.log('Authentication check in new page component');
    console.log('User from context:', user);
    console.log('Cookies:', {
      authenticated: document.cookie.includes('authenticated'),
      wewriteAuthenticated: document.cookie.includes('wewrite_authenticated'),
      wewriteUserId: document.cookie.includes('wewrite_user_id'),
      userSession: document.cookie.includes('userSession')
    });
    
    // Check sessionStorage
    const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
    console.log('wewrite_accounts in sessionStorage:', !!wewriteAccounts);
    
    // Only redirect if we're sure the user is not authenticated
    const authenticated = isAuthenticated() || isAuthEnsured;
    console.log('Final authentication result:', authenticated);
    
    if (!authenticated && !user) {
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
        <div className="w-full" id="new-page-component" data-forced-user={JSON.stringify(user || {})}>
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
  const { user: contextUser } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();
  
  // Get the forced user from the parent component
  const parentComponent = document.getElementById('new-page-component');
  const forcedUserJson = parentComponent?.getAttribute('data-forced-user');
  let forcedUser = null;
  
  if (forcedUserJson) {
    try {
      forcedUser = JSON.parse(forcedUserJson);
      console.log('Form got forced user from parent:', forcedUser);
    } catch (e) {
      console.error('Error parsing forced user:', e);
    }
  }
  
  // Use the forced user if provided, otherwise use the user from context
  const user = forcedUser || contextUser;
  console.log('Form using user:', user);

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

    // Call our ensureAuth utility to make sure authentication is properly set up
    const isAuthEnsured = ensureAuth();
    console.log('ensureAuth result in handleSubmit:', isAuthEnsured);

    // Import the utility here to ensure it's only used on the client
    const { isAuthenticated, getCurrentUser, getCurrentUserToken } = require('../utils/currentUser');

    // Add more detailed logging to diagnose authentication issues
    console.log('Authentication check in handleSubmit');
    console.log('User from context:', user);
    console.log('Cookies:', {
      authenticated: document.cookie.includes('authenticated'),
      wewriteAuthenticated: document.cookie.includes('wewrite_authenticated'),
      wewriteUserId: document.cookie.includes('wewrite_user_id'),
      userSession: document.cookie.includes('userSession')
    });

    // Check sessionStorage
    const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
    console.log('wewrite_accounts in sessionStorage:', !!wewriteAccounts);

    // Check authentication from multiple sources
    const authenticated = isAuthenticated() || !!user || isAuthEnsured;
    console.log('Final authentication result in handleSubmit:', authenticated);

    if (!authenticated) {
      setError("You must be logged in to create a page");
      setIsSaving(false);
      return;
    }

    // Get the current user from context or our centralized utility
    let currentUser = user || getCurrentUser();

    console.log('Current user:', currentUser);

    // If we still don't have a user, try to get it from cookies or sessionStorage
    if (!currentUser) {
      // Try to get user from userSession cookie
      const userSessionCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('userSession='));

      if (userSessionCookie) {
        try {
          const userSession = JSON.parse(decodeURIComponent(userSessionCookie.split('=')[1]));
          console.log('User from userSession cookie:', userSession);
          currentUser = userSession;
        } catch (e) {
          console.error('Error parsing userSession cookie:', e);
        }
      }

      // Try to get user from wewrite_user_id cookie and wewrite_accounts in sessionStorage
      if (!currentUser) {
        const wewriteUserIdCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('wewrite_user_id='));

        if (wewriteUserIdCookie) {
          const userId = wewriteUserIdCookie.split('=')[1];
          console.log('User ID from wewrite_user_id cookie:', userId);

          // Try to get account data from sessionStorage
          const accountsJson = sessionStorage.getItem('wewrite_accounts');
          if (accountsJson) {
            try {
              const accounts = JSON.parse(accountsJson);
              const account = accounts.find(acc => acc.uid === userId);
              if (account) {
                console.log('User from wewrite_accounts:', account);
                currentUser = account;
              }
            } catch (e) {
              console.error('Error parsing wewrite_accounts:', e);
            }
          }
        }
      }
    }

    if (!currentUser) {
      setError("Unable to determine user. Please try logging in again.");
      setIsSaving(false);
      return;
    }

    // Make sure we have a valid auth token
    try {
      const authToken = await getCurrentUserToken();
      if (!authToken) {
        console.warn('No auth token available, but continuing with session-based auth');
      }
    } catch (tokenError) {
      console.error('Error getting auth token:', tokenError);
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
      console.log("User data:", currentUser);

      // Use the username from URL if available, otherwise fallback to user data
      const username = urlUsername || currentUser.username || currentUser.displayName || 'Anonymous';
      console.log("Final username to use:", username);

      // Get the user ID from the current user or Firebase auth
      // We already imported auth at the top of the file
      const userId = currentUser.uid || (auth.currentUser ? auth.currentUser.uid : null);

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
      setError("Failed to create page: " + (error.message || 'Unknown error'));
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

export default NewPageComponent;
