"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '../ui/use-toast';
import { useAuth } from "../../providers/AuthProvider";
import {
  getDraftReply,
  getPendingReplyAction,
  clearDraftReply,
  clearPendingReplyAction,
  hasPendingReply
} from '../../utils/draftReplyUtils';
import { encodeReplyParams } from '../../utils/replyUtils';

interface DraftReply {
  content: string;
}

interface PendingAction {
  returnUrl: string;
}

/**
 * PendingReplyHandler Component
 *
 * This component handles pending replies after authentication.
 * It checks if there's a pending reply action and a draft reply,
 * and if so, it posts the reply and redirects the user back to the original page.
 */
export default function PendingReplyHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    // Only proceed if user is authenticated and not loading
    if (isLoading || !user || handled) {
      return;
    }

    // Check if we're in the authentication flow for posting a reply
    const action = searchParams.get('action');
    const isPostingReply = action === 'posting_reply';

    // If we're not in the posting reply flow, check if there's a pending reply
    if (!isPostingReply && !hasPendingReply()) {
      return;
    }

    // Get the draft reply and pending action
    const draftReply = getDraftReply();
    const pendingAction = getPendingReplyAction();

    if (!draftReply || !pendingAction) {
      return;
    }

    // Mark as handled to prevent multiple executions
    setHandled(true);

    // Post the reply
    handlePendingReply(draftReply, pendingAction);
  }, [user, isLoading, searchParams, handled, router]);

  /**
   * Handle posting a pending reply
   */
  const handlePendingReply = async (draftReply: DraftReply, pendingAction: PendingAction) => {
    try {
      // Get the username from the user object
      const username = (user as { username?: string })?.username || 'Missing username';

      // Encode the parameters for the reply URL
      const params = encodeReplyParams({
        title: '',
        content: draftReply.content,
        username
      });

      // Create the reply URL
      const replyUrl = `${pendingAction.returnUrl}&title=${params.title}&initialContent=${params.content}&username=${params.username}`;

      // Clear the draft reply and pending action
      clearDraftReply();
      clearPendingReplyAction();

      // Show a success message
      toast({
        title: "Reply retrieved",
        description: "Your reply has been retrieved. You can now post it.",
        variant: "success"
      });

      // Redirect to the reply page
      router.push(replyUrl);
    } catch (error) {
      console.error("Error handling pending reply:", error);
      toast({
        title: "Error",
        description: "Failed to post your reply. Please try again.",
        variant: "destructive"
      });
    }
  };

  // This component doesn't render anything
  return null;
}
