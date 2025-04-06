"use client";

import React, { useState, useEffect } from 'react';
import { createReplyContent } from '../utils/replyUtils';
import { createReplyAttribution } from '../utils/linkUtils';
import SlateEditor from './SlateEditor';
// Note: We're using the centralized styles from editor-styles.css
// which is imported by SlateEditor

/**
 * ReplyContent Component
 *
 * A specialized component for handling reply content with pre-filled attribution text.
 * This component ensures that the attribution line is always displayed and protected.
 *
 * @param {Object} props
 * @param {string} props.replyToId - ID of the page being replied to
 * @param {Function} props.onContentChange - Function to update the editor state
 * @param {Function} props.onSave - Function to handle saving
 * @param {Function} props.onCancel - Function to handle cancellation
 */
export default function ReplyContent({
  replyToId,
  onContentChange,
  onSave,
  onCancel,
  initialContent = null
}) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch the original page and create reply content
  useEffect(() => {
    if (!replyToId) {
      setError("No page ID provided for reply");
      setLoading(false);
      return;
    }

    // If initialContent is provided, use it directly
    if (initialContent) {
      console.log("Using provided initialContent for reply:", initialContent);
      setContent(initialContent);
      setLoading(false);

      // Notify parent component
      if (onContentChange) {
        onContentChange(initialContent);
      }
      return;
    }

    // Otherwise, fetch the original page and create reply content
    console.log("Fetching original page for reply:", replyToId);
    setLoading(true);

    // Import the database module to get page details
    import('../firebase/database').then(({ getPageById }) => {
      getPageById(replyToId).then(async (originalPage) => {
        if (originalPage) {
          console.log("Found original page for reply:", originalPage);

          // Get username from the page or user record
          let displayUsername = "Anonymous";

          // First check if the page object already has a username
          if (originalPage.username && originalPage.username !== "Anonymous") {
            displayUsername = originalPage.username;
            console.log("Using username from page object:", displayUsername);
          } else if (originalPage.userId) {
            try {
              // Use the utility function to get the username
              const { getUsernameById } = await import('../utils/userUtils');
              const fetchedUsername = await getUsernameById(originalPage.userId);
              if (fetchedUsername && fetchedUsername !== "Anonymous") {
                displayUsername = fetchedUsername;
                console.log("Fetched username from utility:", displayUsername);
              }

              // If still Anonymous, try to get username from RTDB directly
              if (displayUsername === "Anonymous") {
                try {
                  // Try to get username from RTDB
                  const { getDatabase, ref, get } = await import('firebase/database');
                  const { app } = await import('../firebase/config');
                  const rtdb = getDatabase(app);
                  const rtdbUserRef = ref(rtdb, `users/${originalPage.userId}`);
                  const rtdbSnapshot = await get(rtdbUserRef);

                  if (rtdbSnapshot.exists()) {
                    const rtdbUserData = rtdbSnapshot.val();
                    if (rtdbUserData.username) {
                      displayUsername = rtdbUserData.username;
                      console.log("Using username from RTDB:", displayUsername);
                    } else if (rtdbUserData.displayName) {
                      displayUsername = rtdbUserData.displayName;
                      console.log("Using displayName from RTDB:", displayUsername);
                    }
                  }
                } catch (rtdbError) {
                  console.error("Error fetching username from RTDB:", rtdbError);
                }
              }
            } catch (error) {
              console.error("Error fetching username:", error);
            }
          }

          console.log("Final username to use in reply attribution:", displayUsername);

          // Create reply content with attribution using the utility function
          const replyContent = [
            createReplyAttribution({
              pageId: originalPage.id,
              pageTitle: originalPage.title,
              userId: originalPage.userId,
              username: displayUsername
            })
          ];

          // Log the created content for debugging
          console.log("Created reply content with utility function:", JSON.stringify(replyContent, null, 2));

          // Log the content structure for debugging
          console.log("Created reply content with pill links:", JSON.stringify(replyContent, null, 2));

          console.log("Created reply content:", replyContent);
          setContent(replyContent);

          // Notify parent component
          if (onContentChange) {
            onContentChange(replyContent);
          }
        } else {
          setError("Could not find the original page");
        }
        setLoading(false);
      }).catch(error => {
        console.error("Error fetching original page:", error);
        setError("Error fetching original page: " + error.message);
        setLoading(false);
      });
    }).catch(error => {
      console.error("Error importing database module:", error);
      setError("Error loading database module: " + error.message);
      setLoading(false);
    });
  }, [replyToId, initialContent, onContentChange]);

  // Custom onChange handler to protect the attribution line
  const handleContentChange = (value) => {
    if (content && value.length > 0 && content.length > 0) {
      // Always preserve the attribution line (first paragraph)
      if (JSON.stringify(value[0]) !== JSON.stringify(content[0])) {
        console.log('Protecting attribution line from changes');
        value[0] = content[0];
      }
    }

    // Update local state
    setContent(value);

    // Notify parent component
    if (onContentChange) {
      onContentChange(value);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading reply content...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>{error}</p>
        <button
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
          onClick={onCancel}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!content) {
    return <div className="p-4 text-center">No content available for reply</div>;
  }

  return (
    <div className="reply-editor-container">
      {/* Add critical styles directly to ensure they're applied */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Critical pill link styles that must be applied */
        .reply-editor-container a[data-page-id],
        .reply-editor-container a.page-link,
        .reply-editor-container a.editor-link.page-link {
          background-color: #1768FF !important;
          color: white !important;
          border-radius: 8px !important;
          padding: 1px 6px !important;
          margin: 0 1px !important;
          display: inline-flex !important;
          white-space: nowrap !important;
        }

        .reply-editor-container a.user-link,
        .reply-editor-container a[data-user-id],
        .reply-editor-container a.editor-link.user-link {
          background-color: #1768FF !important;
          color: white !important;
          border-radius: 8px !important;
          padding: 1px 6px !important;
          margin: 0 1px !important;
          display: inline-flex !important;
          white-space: nowrap !important;
        }
      ` }} />
      <SlateEditor
        initialContent={content}
        onContentChange={handleContentChange}
        onSave={onSave}
        onDiscard={onCancel}
      />
    </div>
  );
}
