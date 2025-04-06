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
    setInitialContent(defaultContent);
    if (setEditorState) {
      setEditorState(defaultContent);
    }
  };

  useEffect(() => {
    const contentParam = searchParams.get('initialContent');
    const replyToParam = searchParams.get('replyTo');

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

      // We don't set initialContent for replies anymore since PageEditor handles it
      // This prevents conflicts between the two content sources
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
                    children: [{ text: originalPage.title || "Untitled" }]
                  },
                  { text: " by " },
                  {
                    type: "link",
                    url: `/u/${originalPage.userId || "anonymous"}`,
                    isUser: true,
                    userId: originalPage.userId || "anonymous",
                    username: originalPage.username || "Anonymous",
                    className: "user-link",
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

  return (
    <PageEditor
      title={Page.title}
      setTitle={(newTitle) => setPage({ ...Page, title: newTitle })}
      initialContent={isReply ? null : initialContent}
      onContentChange={setEditorState}
      isPublic={Page.isPublic}
      setIsPublic={(newValue) => setPage({ ...Page, isPublic: newValue })}
      onSave={handleSubmit}
      onCancel={() => router.push("/pages")}
      isSaving={isSaving}
      error={error}
      isNewPage={true}
      isReply={isReply}
      replyToId={replyToId}
    />
  );
};

export default New;
