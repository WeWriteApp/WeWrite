"use client";

import React, { useState, useEffect } from 'react';
import ReplyEditor from './ReplyEditor';
import { prepareReplyContent, validateReplyContent } from '../utils/replyManager';
// Note: We're using the centralized styles from editor-styles.css
// which is imported by ReplyEditor

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

    // Use the centralized reply manager to prepare the reply content
    prepareReplyContent(replyToId)
      .then(({ replyContent }) => {
        console.log("Created reply content:", replyContent);
        setContent(replyContent);

        // Notify parent component
        if (onContentChange) {
          onContentChange(replyContent);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error("Error preparing reply content:", error);
        setError(error.message || "Error preparing reply content");
        setLoading(false);
      });
  }, [replyToId, initialContent, onContentChange]);

  // Custom onChange handler to protect the attribution line
  const handleContentChange = (value) => {
    // Use the centralized validation function
    const validatedContent = validateReplyContent(content, value);

    // Update local state
    setContent(validatedContent);

    // Notify parent component
    if (onContentChange) {
      onContentChange(validatedContent);
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
      <ReplyEditor
        initialContent={content}
        onContentChange={handleContentChange}
        onSave={onSave}
        onDiscard={onCancel}
      />
    </div>
  );
}
