"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { MessageSquare, Eye, PenLine } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Page IDs for feedback and WeWrite about page
const FEEDBACK_PAGE_ID = 'Kva5XqFpFb2bl5TCZoxE';
const WEWRITE_PAGE_ID = 'sUASL4gNdCMVHkr7Qzty';

/**
 * Creates feedback content structure similar to reply attribution
 * "I'm writing some [feedback] for [WeWrite]"
 */
const createFeedbackContent = () => {
  return [
    {
      type: "paragraph",
      isAttribution: true,
      attributionType: "feedback",
      children: [
        { text: "I'm writing some " },
        {
          type: "link",
          url: `/${FEEDBACK_PAGE_ID}`,
          pageId: FEEDBACK_PAGE_ID,
          pageTitle: "feedback",
          className: "page-link",
          isPageLink: true,
          children: [{ text: "feedback" }]
        },
        { text: " for " },
        {
          type: "link",
          url: `/${WEWRITE_PAGE_ID}`,
          pageId: WEWRITE_PAGE_ID,
          pageTitle: "WeWrite",
          className: "page-link",
          isPageLink: true,
          children: [{ text: "WeWrite" }]
        }
      ]
    },
    // Empty paragraph for user to type their feedback
    {
      type: "paragraph",
      children: [{ text: "" }],
      placeholder: "Start typing your feedback..."
    }
  ];
};

/**
 * FeedbackModal Component
 *
 * Provides options to either read others' feedback or send your own.
 * When sending feedback, creates a new page with pre-filled attribution content.
 */
export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleReadFeedback = () => {
    onClose();
    router.push(`/${FEEDBACK_PAGE_ID}`);
  };

  const handleSendFeedback = () => {
    onClose();

    // Create the feedback content
    const feedbackContent = createFeedbackContent();

    // Build URL manually to match the reply flow encoding (double-encoded content)
    // The /new page expects initialContent to be decodeURIComponent'd before JSON.parse
    const encodedContent = encodeURIComponent(JSON.stringify(feedbackContent));
    const encodedTitle = encodeURIComponent('Feedback for WeWrite');

    const feedbackUrl = `/new?title=${encodedTitle}&initialContent=${encodedContent}&type=feedback`;

    // If user is not logged in, redirect to login with return URL
    if (!user) {
      router.push(`/auth/login?from=${encodeURIComponent(feedbackUrl)}`);
    } else {
      router.push(feedbackUrl);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 pt-2">
          <button
            className="flex items-center gap-3 w-full h-auto py-4 px-4 text-left border border-neutral-20 rounded-lg hover:bg-alpha-5 active:bg-alpha-10 transition-all"
            onClick={handleReadFeedback}
          >
            <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">Read others' feedback</div>
              <div className="text-sm text-muted-foreground">See what others are saying about WeWrite</div>
            </div>
          </button>

          <button
            className="flex items-center gap-3 w-full h-auto py-4 px-4 text-left border border-neutral-20 rounded-lg hover:bg-alpha-5 active:bg-alpha-10 transition-all"
            onClick={handleSendFeedback}
          >
            <PenLine className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">Send my own feedback</div>
              <div className="text-sm text-muted-foreground">Share your thoughts, ideas, or report issues</div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
