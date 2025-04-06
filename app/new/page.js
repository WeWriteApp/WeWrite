"use client";
import { useContext, useEffect, useState, useRef } from "react";
import { createPage } from "../firebase/database";
import DashboardLayout from "../DashboardLayout";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import ReactGA from 'react-ga4';
import PageHeader from "../components/PageHeader.tsx";
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
import PageEditor from "../components/PageEditor";
import TestReplyEditor from "../components/TestReplyEditor";
import dynamic from 'next/dynamic';
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Globe } from "lucide-react";

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
  const { user } = useContext(AuthContext);

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
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editorState, setEditorState] = useState();
  const [isSaving, setIsSaving] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [error, setError] = useState(null);
  const analytics = useWeWriteAnalytics();

  // Reference to the title input element for focusing
  const titleInputRef = useRef(null);

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

    // If this is a reply, set up the reply content directly
    if (isReply && replyToParam) {
      // Import the database module to get page details
      import('../firebase/database').then(({ getPageById }) => {
        getPageById(replyToParam).then(originalPage => {
          if (originalPage) {
            console.log("Found original page:", originalPage);

            // Create a direct reply content structure with proper attribution
            const directReplyContent = [
              {
                type: "paragraph",
                children: [
                  { text: "Replying to " },
                  {
                    type: "link",
                    url: `/${replyToParam}`,
                    children: [{ text: originalPage.title || "Untitled" }]
                  },
                  { text: " by " },
                  {
                    type: "link",
                    url: `/u/${originalPage.userId || "anonymous"}`,
                    children: [{ text: originalPage.username || "Anonymous" }]
                  }
                ]
              },
              {
                type: "paragraph",
                children: [{ text: "" }]
              },
              {
                type: "paragraph",
                children: [{ text: "I'm responding to this page because..." }]
              },
              {
                type: "paragraph",
                children: [{ text: "" }]
              }
            ];

            // Set the content directly
            console.log("Setting direct reply content:", JSON.stringify(directReplyContent, null, 2));
            setInitialContent(directReplyContent);
            if (setEditorState) {
              setEditorState(directReplyContent);
            }
          } else {
            // Fallback if original page not found
            console.error("Original page not found, using fallback content");
            setFallbackContent();
          }
        }).catch(error => {
          console.error("Error fetching original page:", error);
          setFallbackContent();
        });
      });
    } else if (contentParam) {
      // Process content parameter if not a reply or if we have content param
      try {
        const decodedContent = decodeURIComponent(contentParam);
        console.log("Received encoded content:", contentParam);
        console.log("Decoded content:", decodedContent);

        try {
          const parsedContent = JSON.parse(decodedContent);
          console.log("Setting initial content (FULL):", JSON.stringify(parsedContent, null, 2));

          // Validate the parsed content structure
          if (Array.isArray(parsedContent) && parsedContent.length > 0) {
            // Always set the initialContent first to ensure it's available
            setInitialContent(parsedContent);
            console.log("initialContent set to:", parsedContent);

            // Also set the editor state immediately
            if (setEditorState) {
              console.log("Setting editor state directly");
              setEditorState(parsedContent);
            }
          } else {
            console.error("Invalid content structure:", parsedContent);
            setFallbackContent();
          }
        } catch (parseError) {
          console.error("Error parsing content JSON:", parseError);
          setFallbackContent();
        }
      } catch (error) {
        console.error("Error decoding content parameter:", error);
        setFallbackContent();
      }
    } else if (isReply) {
      // If it's a reply but we don't have content or replyTo, use fallback
      setFallbackContent();
    }
  }, [searchParams, setPage, setEditorState, isReply]);

  // Helper function to set fallback content
  const setFallbackContent = () => {
    const defaultContent = [
      {
        type: "paragraph",
        children: [{ text: "Replying to page" }]
      }
    ];
    setInitialContent(defaultContent);
    if (setEditorState) {
      setEditorState(defaultContent);
    }
  };

  useEffect(() => {
    const contentParam = searchParams.get('initialContent');
    const replyToParam = searchParams.get('replyTo');
    console.log("URL parameters:", { contentParam: !!contentParam, replyToParam, isReply });

    // For replies, we don't want to pre-fill the title
    if (isReply) {
      // Clear any existing title
      setPage(prev => ({ ...prev, title: "" }));

      // Focus the title input after a short delay to ensure the component is fully rendered
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          console.log("Title input focused");
        }
      }, 300);

      // For replies, we need to parse the initialContent parameter
      if (contentParam) {
        try {
          const decodedContent = JSON.parse(decodeURIComponent(contentParam));
          console.log("Decoded reply content from URL:", decodedContent);
          setInitialContent(decodedContent);
          setEditorState(decodedContent);

          // Log the content to verify it's being set correctly
          console.log("Set initialContent and editorState for reply:", {
            initialContent: decodedContent,
            editorState: decodedContent
          });
        } catch (error) {
          console.error("Error parsing initialContent for reply:", error);
        }
      } else {
        console.warn("No initialContent parameter found for reply");

        // If no initialContent parameter is provided, create a default reply content
        // This is a fallback in case the URL parameters are lost
        import('../utils/replyUtils').then(({ createReplyContent }) => {
          if (replyToParam) {
            // Import the database module to get page details
            import('../firebase/database').then(({ getPageById }) => {
              getPageById(replyToParam).then(originalPage => {
                if (originalPage) {
                  const content = createReplyContent({
                    pageId: originalPage.id,
                    pageTitle: originalPage.title,
                    userId: originalPage.userId,
                    username: originalPage.username,
                    replyType: "standard"
                  });

                  console.log("Created fallback reply content:", content);
                  setInitialContent(content);
                  setEditorState(content);
                }
              }).catch(error => {
                console.error("Error fetching original page for fallback reply:", error);
              });
            });
          }
        });
      }
    } else {
      // For non-replies, still use the title parameter if available
      const titleParam = searchParams.get('title');
      if (titleParam) {
        try {
          const decodedTitle = decodeURIComponent(titleParam);
          setPage(prev => ({ ...prev, title: decodedTitle }));
        } catch (error) {
          console.error("Error decoding title parameter:", error);
        }
      }
    }

    // If this is a reply, set up the reply content directly
    if (isReply && replyToParam) {
      // Import the database module to get page details
      import('../firebase/database').then(({ getPageById }) => {
        getPageById(replyToParam).then(originalPage => {
          if (originalPage) {
            console.log("Found original page:", originalPage);

            // Create a direct reply content structure with proper attribution
            const directReplyContent = [
              {
                type: "paragraph",
                children: [
                  { text: "Replying to " },
                  {
                    type: "link",
                    url: `/${replyToParam}`,
                    pageId: replyToParam,
                    pageTitle: originalPage.title || "Untitled",
                    className: "page-link editor-link",
                    children: [{ text: originalPage.title || "Untitled" }]
                  },
                  { text: " by " },
                  {
                    type: "link",
                    url: `/u/${originalPage.userId || "anonymous"}`,
                    isUser: true,
                    userId: originalPage.userId || "anonymous",
                    username: originalPage.username || "Anonymous",
                    className: "user-link editor-link",
                    children: [{ text: originalPage.username || "Anonymous" }]
                  }
                ]
              }
            ];

            // Set the content directly
            console.log("Setting direct reply content:", JSON.stringify(directReplyContent, null, 2));
            setInitialContent(directReplyContent);
            if (setEditorState) {
              setEditorState(directReplyContent);
            }
          } else {
            // Fallback if original page not found
            console.error("Original page not found, using fallback content");
            setFallbackContent();
          }
        }).catch(error => {
          console.error("Error fetching original page:", error);
          setFallbackContent();
        });
      });
    } else if (contentParam) {
      // Process content parameter if not a reply or if we have content param
      try {
        const decodedContent = decodeURIComponent(contentParam);
        console.log("Received encoded content:", contentParam);
        console.log("Decoded content:", decodedContent);

        try {
          const parsedContent = JSON.parse(decodedContent);
          console.log("Setting initial content (FULL):", JSON.stringify(parsedContent, null, 2));

          // Validate the parsed content structure
          if (Array.isArray(parsedContent) && parsedContent.length > 0) {
            // Always set the initialContent first to ensure it's available
            setInitialContent(parsedContent);
            console.log("initialContent set to:", parsedContent);

            // Also set the editor state immediately
            if (setEditorState) {
              console.log("Setting editor state directly");
              setEditorState(parsedContent);
            }
          } else {
            console.error("Invalid content structure:", parsedContent);
            setFallbackContent();
          }
        } catch (parseError) {
          console.error("Error parsing content JSON:", parseError);
          setFallbackContent();
        }
      } catch (error) {
        console.error("Error decoding content parameter:", error);
        setFallbackContent();
      }
    } else if (isReply) {
      // If it's a reply but we don't have content or replyTo, use fallback
      setFallbackContent();
    }
  }, [searchParams, setPage, setEditorState, isReply]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!user) {
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

  // Get the replyTo parameter
  const replyToId = searchParams.get('replyTo');
  console.log("Reply to ID from URL parameters:", replyToId);

  // For replies, use the specialized ReplyContent component
  if (isReply) {
    // Import the ReplyContent component dynamically
    const ReplyContent = dynamic(() => import('../components/ReplyContent'), { ssr: false });

    return (
      <div className="w-full">
        <div className="mb-4">
          <input
            ref={titleInputRef}
            type="text"
            value={Page.title}
            onChange={(e) => setPage({ ...Page, title: e.target.value })}
            className="w-full mt-1 text-3xl font-semibold bg-background text-foreground border border-input/30 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 py-2 transition-all break-words overflow-wrap-normal whitespace-normal"
            placeholder="Enter a title..."
            autoComplete="off"
            style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
            autoFocus
          />
        </div>

        <ReplyContent
          replyToId={replyToId}
          initialContent={initialContent}
          onContentChange={setEditorState}
          onSave={handleSubmit}
          onCancel={() => router.push("/pages")}
        />

        <div className="mt-8 mb-16">
          <div className="flex flex-row justify-between items-center gap-4 w-full">
            <div className="flex items-center gap-2 bg-background/90 p-2 rounded-lg border border-input">
              <Globe className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                {Page.isPublic ? "Public" : "Private"}
              </span>
              <Switch
                checked={Page.isPublic}
                onCheckedChange={(newValue) => setPage({ ...Page, isPublic: newValue })}
                aria-label="Toggle page visibility"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push("/pages")}
                variant="outline"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSaving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="fixed top-4 right-4 bg-destructive/10 p-4 rounded-md shadow-md">
            <p className="text-destructive font-medium">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // For regular new pages, use the standard PageEditor
  return (
    <PageEditor
      title={Page.title}
      setTitle={(newTitle) => setPage({ ...Page, title: newTitle })}
      initialContent={initialContent}
      onContentChange={setEditorState}
      isPublic={Page.isPublic}
      setIsPublic={(newValue) => setPage({ ...Page, isPublic: newValue })}
      onSave={handleSubmit}
      onCancel={() => router.push("/pages")}
      isSaving={isSaving}
      error={error}
      isNewPage={true}
    />
  );
};

export default New;
