"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "../DashboardLayout";
import { createPage } from "../firebase/database";
import PageHeader from "../components/PageHeader";
import ReactGA from 'react-ga4';
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
import Cookies from 'js-cookie';
import PageEditor from "../components/PageEditor";
import { Button } from "../components/ui/button";
import { ChevronLeft } from "lucide-react";

/**
 * A direct page creation component that doesn't rely on any authentication
 * and always allows page creation
 */
export default function DirectCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState({
    uid: 'anonymous',
    email: 'anonymous@example.com',
    username: 'Anonymous',
    displayName: 'Anonymous'
  });
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [editorContent, setEditorContent] = useState([{ type: "paragraph", children: [{ text: "" }] }]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();
  const isReply = searchParams.has('isReply') || (searchParams.has('title') && searchParams.get('title').startsWith('Re:'));

  // Try to get user data from cookies and session storage
  useEffect(() => {
    console.log("DirectCreatePage: Getting user data from cookies and session storage");

    // Try to get user data from multiple sources
    let userData = null;

    // 1. Try to get user data from wewrite_accounts in sessionStorage
    try {
      const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
      if (wewriteAccounts) {
        const accounts = JSON.parse(wewriteAccounts);
        const currentAccount = accounts.find(acc => acc.isCurrent);

        if (currentAccount) {
          console.log("DirectCreatePage: Found current account in wewrite_accounts:", currentAccount);
          userData = currentAccount;
        }
      }
    } catch (error) {
      console.error("DirectCreatePage: Error getting user data from wewrite_accounts:", error);
    }

    // 2. Try to get user data from wewrite_user_id cookie and wewrite_accounts
    if (!userData) {
      try {
        const wewriteUserId = Cookies.get('wewrite_user_id');
        if (wewriteUserId) {
          console.log("DirectCreatePage: Found wewrite_user_id cookie:", wewriteUserId);

          // Try to find the account in wewrite_accounts
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const account = accounts.find(acc => acc.uid === wewriteUserId);

            if (account) {
              console.log("DirectCreatePage: Found account in wewrite_accounts by user ID:", account);
              userData = account;
            }
          }
        }
      } catch (error) {
        console.error("DirectCreatePage: Error getting user data from wewrite_user_id:", error);
      }
    }

    // 3. Try to get user data from userSession cookie
    if (!userData) {
      try {
        const userSessionCookie = Cookies.get('userSession');
        if (userSessionCookie) {
          const userSession = JSON.parse(userSessionCookie);
          if (userSession && userSession.uid) {
            console.log("DirectCreatePage: Found user data in userSession cookie:", userSession);
            userData = userSession;
          }
        }
      } catch (error) {
        console.error("DirectCreatePage: Error getting user data from userSession cookie:", error);
      }
    }

    // If we found user data, use it
    if (userData) {
      console.log("DirectCreatePage: Using user data:", userData);
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
        setTitle(decodedTitle);
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

        // Also set the editor content immediately
        setEditorContent(parsedContent);

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

  // Handle save action
  const handleSave = async (content) => {
    setIsSaving(true);
    setError(null);

    // Check if title is provided
    if (!title) {
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

      // Ensure we have valid editor content
      if (!content || !Array.isArray(content) || content.length === 0) {
        console.error("Invalid editor content:", content);
        setError("Error: Invalid content format");
        setIsSaving(false);
        return;
      }

      console.log("Saving page with editor content:", content);

      const data = {
        title,
        isPublic,
        content: JSON.stringify(content),
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
          label: title,
        });

        // Track with new analytics system
        analytics.trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, {
          label: title,
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

  const handleCancel = () => {
    router.push("/pages");
  };

  // Get username for display
  const urlUsername = searchParams.get('username');

  // State to store the username
  const [displayUsername, setDisplayUsername] = useState('Loading...');

  // Effect to get the username from multiple sources
  useEffect(() => {
    const getUsername = async () => {
      // Try to get username from multiple sources
      let foundUsername = urlUsername || user?.displayName || user?.username || '';

      // If we still don't have a username, try to get it from other sources
      if (!foundUsername) {
        try {
          // Try to get username from wewrite_accounts in sessionStorage
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const currentAccount = accounts.find(acc => acc.isCurrent);

            if (currentAccount && (currentAccount.username || currentAccount.displayName)) {
              foundUsername = currentAccount.username || currentAccount.displayName;
              console.log("Found username in wewrite_accounts:", foundUsername);
            }
          }
        } catch (error) {
          console.error("Error getting username from wewrite_accounts:", error);
        }
      }

      // If we still don't have a username, try to get it from userSession cookie
      if (!foundUsername) {
        try {
          const userSessionCookie = Cookies.get('userSession');
          if (userSessionCookie) {
            const userSession = JSON.parse(userSessionCookie);
            if (userSession && (userSession.username || userSession.displayName)) {
              foundUsername = userSession.username || userSession.displayName;
              console.log("Found username in userSession cookie:", foundUsername);
            }
          }
        } catch (error) {
          console.error("Error getting username from userSession cookie:", error);
        }
      }

      // If we still don't have a username, try to get it from localStorage
      if (!foundUsername) {
        try {
          const savedUsername = localStorage.getItem('wewrite_username');
          if (savedUsername) {
            foundUsername = savedUsername;
            console.log("Found username in localStorage:", foundUsername);
          }
        } catch (error) {
          console.error("Error getting username from localStorage:", error);
        }
      }

      // If we still don't have a username, try to get it from the auth object
      if (!foundUsername && auth.currentUser) {
        foundUsername = auth.currentUser.displayName || '';
        console.log("Found username in auth.currentUser:", foundUsername);
      }

      // If we still don't have a username, use 'Anonymous'
      if (!foundUsername) {
        foundUsername = 'Anonymous';
      }

      // Set the username in state
      setDisplayUsername(foundUsername);
      console.log("Final username:", foundUsername);
    };

    getUsername();
  }, [urlUsername, user]);

  // Render the page creation form using PageEditor
  return (
    <DashboardLayout>
      <PageHeader title={isReply ? "Replying to page" : "New page"} username={displayUsername} userId={user?.uid} />
      <div className="container w-full py-6 px-4">
        <div className="flex items-center mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/')}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="w-full">
          <PageEditor
            title={title}
            setTitle={setTitle}
            initialContent={initialContent || editorContent}
            onContentChange={(content) => {
              console.log('Direct-create: Editor content changed');
              setEditorContent(content);
            }}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
            error={error}
            isNewPage={true}
            isReply={isReply}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
