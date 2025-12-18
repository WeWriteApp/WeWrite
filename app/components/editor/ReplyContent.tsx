"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { prepareReplyContent, validateReplyContent } from '../../utils/replyManager';

// Import the unified editor
const Editor = dynamic(() => import("./Editor"), { ssr: false });

interface ReplyContentProps {
  replyToId: string;
  onContentChange?: (content: unknown) => void;
  onSave?: () => void;
  onCancel?: () => void;
  initialContent?: unknown;
}

/**
 * ReplyContent Component
 *
 * A specialized component for handling reply content with pre-filled attribution text.
 * This component ensures that the attribution line is always displayed and protected.
 */
export default function ReplyContent({
  replyToId,
  onContentChange,
  onSave,
  onCancel,
  initialContent = null
}: ReplyContentProps) {
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .catch((err: Error) => {
        console.error("Error preparing reply content:", err);
        setError(err.message || "Error preparing reply content");
        setLoading(false);
      });
  }, [replyToId, initialContent, onContentChange]);

  // Custom onChange handler to protect the attribution line
  const handleContentChange = (value: unknown) => {
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
      <Editor
        initialContent={content}
        onChange={handleContentChange}
        placeholder="Continue your reply..."
        contentType="wiki"
      />
    </div>
  );
}
