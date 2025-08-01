"use client";

/**
 * WeWrite Page Button Consistency Fix - Shared Page Action Handlers
 *
 * This module provides shared handler utilities that ensure identical functionality
 * between top navigation menu buttons and bottom page buttons for "Add to Page",
 * "Reply", and "Share" actions.
 *
 * Problem Solved:
 * Before this fix, top navigation and bottom page buttons had different functionality:
 * - Add to Page: Top navigation only logged to console, bottom used proper modal
 * - Reply: Top navigation used simple navigation, bottom had complex authentication flow
 * - Share: Inconsistent behavior across different button locations
 *
 * Solution Implementation:
 * 1. Created shared handler utilities for consistent behavior
 * 2. Enhanced AddToPageButton component for external state management
 * 3. Updated PageHeader component to use shared handlers
 *
 * Benefits:
 * - Single Source of Truth: All button actions use the same underlying functions
 * - Consistent User Experience: Identical behavior regardless of button location
 * - Maintainability: Changes to functionality only need to be made in one place
 * - Error Handling: Consistent error messages and user feedback
 * - Accessibility: Proper keyboard navigation and screen reader support
 * - Performance: Optimized with dynamic imports and proper state management
 *
 * Handler Functions:
 * - handleAddToPage(): Validates page data and opens Add to Page modal
 * - handleReply(): Handles authenticated/non-authenticated users with draft saving
 * - handleShare(): Uses native Web Share API with clipboard fallback
 *
 * Testing Coverage:
 * - Functional: Both top and bottom buttons use identical logic
 * - Cross-Platform: Desktop dropdown and mobile touch interactions
 * - Authentication: Proper handling for logged-in and logged-out users
 * - Accessibility: Keyboard navigation and screen reader support
 */

import { toast } from "../components/ui/use-toast";
import { generateReplyTitle, createReplyContent, encodeReplyParams } from "./replyUtils";
import { saveDraftReply, setPendingReplyAction } from "./draftReplyUtils";
import { getCurrentUsername } from "./userUtils";
import { getAnalyticsService } from "./analytics-service";
import { INTERACTION_EVENTS } from "../constants/analytics-events";
import { SharesTrackingService } from "../services/sharesTracking";

/**
 * Page interface for action handlers
 */
interface Page {
  id: string;
  title?: string;
  username?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * User interface for action handlers
 */
interface User {
  uid: string;
  email?: string;
  [key: string]: any;
}

/**
 * Router interface for navigation
 */
interface Router {
  push: (url: string) => void;
  [key: string]: any;
}

/**
 * Shared handler for "Add to Page" functionality
 * This ensures consistent behavior between top navigation and bottom page buttons
 *
 * @param page - The page object
 * @param setIsAddToPageOpen - Function to open the Add to Page modal
 */
export const handleAddToPage = (page: Page, setIsAddToPageOpen: (open: boolean) => void): void => {
  if (!page) {
    console.error("No page data provided to handleAddToPage");
    toast.error("Unable to add to page - page data missing");
    return;
  }

  if (!page.id) {
    console.error("No page ID provided to handleAddToPage");
    toast.error("Unable to add to page - page ID missing");
    return;
  }

  // Open the Add to Page modal
  if (setIsAddToPageOpen) {
    console.log("Opening Add to Page modal for page:", page.id);
    setIsAddToPageOpen(true);
  } else {
    console.error("setIsAddToPageOpen function not provided");
    toast.error("Unable to open Add to Page modal");
  }
};

/**
 * Shared handler for "Reply" functionality
 * This ensures consistent behavior between top navigation and bottom page buttons
 * Handles both authenticated and non-authenticated users
 *
 * @param page - The page object
 * @param user - The current user object (null if not authenticated)
 * @param router - Next.js router object
 */
export const handleReply = async (page: Page, user: User | null, router: Router): Promise<void> => {
  if (!page) {
    console.error("No page data provided to handleReply");
    toast.error("Unable to create reply - page data missing");
    return;
  }

  if (!router) {
    console.error("No router provided to handleReply");
    toast.error("Unable to create reply - navigation error");
    return;
  }

  try {
    // Check if user is authenticated
    if (!session) {
      // User is not authenticated, store draft reply and redirect to login
      try {
        // Create standardized reply content
        const replyTitle = generateReplyTitle(page.title);
        const initialContent = createReplyContent({
          pageId: page.id,
          pageTitle: page.title,
          userId: page.userId,
          username: page.username,
          replyType: "standard"
        });

        // Create the return URL that would be used after authentication
        const returnUrl = `/new?replyTo=${page.id}&page=${encodeURIComponent(page.title || "Untitled")}`;

        // Save the draft reply to local storage
        const draftReply = {
          pageId: page.id,
          pageTitle: page.title || "Untitled",
          content: initialContent,
          returnUrl
        };

        const saved = saveDraftReply(draftReply);

        if (saved) {
          // Set the pending reply action
          setPendingReplyAction({
            pageId: page.id,
            returnUrl
          });

          // Show a toast message
          toast.success("Your reply has been saved. Please sign in to post it.");

          // Redirect to login page with action parameter
          router.push(`/auth/login?action=posting_reply&return_to=${encodeURIComponent(returnUrl)}`);
        } else {
          toast.error("Failed to save your reply. Please try again.");
        }
      } catch (error) {
        console.error("Error handling guest reply:", error);
        toast.error("Failed to create reply");
      }
      return;
    }

    // User is authenticated, proceed with reply creation
    try {
      // Get the current username
      const username = await getCurrentUsername(session);

      // Use utility functions to create standardized reply content
      const replyTitle = generateReplyTitle(page.title);
      const initialContent = createReplyContent({
        pageId: page.id,
        pageTitle: page.title,
        userId: page.userId,
        username: page.username,
        replyType: "standard"
      });

      // Use utility to encode parameters
      const params = encodeReplyParams({
        title: replyTitle,
        content: initialContent,
        username
      });

      console.log("Navigating to reply page with:", {
        title: replyTitle,
        username,
        initialContent
      });

      // CONSOLIDATION FIX: Use unified /new route for all page creation
      const replyUrl = `/new?replyTo=${page.id}&page=${encodeURIComponent(page.title || "Untitled")}&title=${params.title}&initialContent=${params.content}&username=${params.username}`;

      // Navigate to the reply page
      router.push(replyUrl);
    } catch (error) {
      console.error("Error creating authenticated reply:", error);
      toast.error("Failed to create reply");
    }
  } catch (error) {
    console.error("Error in handleReply:", error);
    toast.error("Failed to create reply");
  }
};

/**
 * Shared handler for "Share" functionality
 * This ensures consistent behavior across the application
 *
 * @param page - The page object
 * @param title - The page title
 * @param user - The current user object (optional, for analytics)
 */
export const handleShare = (page: Page, title?: string, user?: User | null): void => {
  if (!page) {
    console.error("No page data provided to handleShare");
    return;
  }

  const pageUrl = `${window.location.origin}/${page.id}`;
  const shareText = `"${title || page.title || "Untitled"}" by ${page.username || "Anonymous"}`;
  const analytics = getAnalyticsService();

  if (navigator.share) {
    // Use native sharing if available
    navigator.share({
      title: shareText,
      url: pageUrl
    }).then(() => {
      // Track successful share via native Web Share API
      analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_SUCCEEDED, {
        page_id: page.id,
        share_method: 'native_share',
        user_id: session?.uid || null,
        page_title: title || page.title || "Untitled",
        page_author: page.username || "Anonymous"
      });

      // Also track in Firestore for dashboard analytics
      SharesTrackingService.trackShareSucceeded(
        page.id,
        'native_share',
        session?.uid,
        session?.displayName || session?.username,
        title || page.title,
        page.username
      );
    }).catch(err => {
      console.log('Error sharing:', err);

      // Check if user cancelled the share (AbortError)
      if (err.name === 'AbortError') {
        // Track aborted share
        analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_ABORTED, {
          page_id: page.id,
          share_method: 'native_share',
          user_id: session?.uid || null,
          page_title: title || page.title || "Untitled",
          page_author: page.username || "Anonymous",
          abort_reason: 'user_cancelled'
        });

        // Also track in Firestore for dashboard analytics
        SharesTrackingService.trackShareAborted(
          page.id,
          'native_share',
          'user_cancelled',
          session?.uid,
          session?.displayName || session?.username,
          title || page.title,
          page.username
        );
      } else {
        // Track aborted share due to error
        analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_ABORTED, {
          page_id: page.id,
          share_method: 'native_share',
          user_id: session?.uid || null,
          page_title: title || page.title || "Untitled",
          page_author: page.username || "Anonymous",
          abort_reason: 'share_error'
        });

        // Also track in Firestore for dashboard analytics
        SharesTrackingService.trackShareAborted(
          page.id,
          'native_share',
          'share_error',
          session?.uid,
          session?.displayName || session?.username,
          title || page.title,
          page.username
        );

        // Fallback to clipboard
        fallbackShare(pageUrl, shareText, page, session, title);
      }
    });
  } else {
    // Fallback to clipboard
    fallbackShare(pageUrl, shareText, page, session, title);
  }
};

/**
 * Fallback share function that copies to clipboard
 *
 * @param url - The URL to share
 * @param text - The share text
 * @param page - The page object (for analytics)
 * @param user - The current user object (for analytics)
 * @param title - The page title (for analytics)
 */
const fallbackShare = (url: string, text: string, page?: Page, user?: User | null, title?: string): void => {
  const analytics = getAnalyticsService();

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard!");

      // Track successful share via clipboard
      if (page) {
        analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_SUCCEEDED, {
          page_id: page.id,
          share_method: 'copy_link',
          user_id: session?.uid || null,
          page_title: title || page.title || "Untitled",
          page_author: page.username || "Anonymous"
        });

        // Also track in Firestore for dashboard analytics
        SharesTrackingService.trackShareSucceeded(
          page.id,
          'copy_link',
          session?.uid,
          session?.displayName || session?.username,
          title || page.title,
          page.username
        );
      }
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);

      // Track aborted share due to clipboard error
      if (page) {
        analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_ABORTED, {
          page_id: page.id,
          share_method: 'copy_link',
          user_id: session?.uid || null,
          page_title: title || page.title || "Untitled",
          page_author: page.username || "Anonymous",
          abort_reason: 'clipboard_error'
        });

        // Also track in Firestore for dashboard analytics
        SharesTrackingService.trackShareAborted(
          page.id,
          'copy_link',
          'clipboard_error',
          session?.uid,
          session?.displayName || session?.username,
          title || page.title,
          page.username
        );
      }
      // Remove error toast - allow users to cancel share actions without showing error messages
    });
  } else {
    // Very old browser fallback
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success("Link copied to clipboard!");

      // Track successful share via legacy clipboard
      if (page) {
        analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_SUCCEEDED, {
          page_id: page.id,
          share_method: 'copy_link_legacy',
          user_id: session?.uid || null,
          page_title: title || page.title || "Untitled",
          page_author: page.username || "Anonymous"
        });

        // Also track in Firestore for dashboard analytics
        SharesTrackingService.trackShareSucceeded(
          page.id,
          'copy_link_legacy',
          session?.uid,
          session?.displayName || session?.username,
          title || page.title,
          page.username
        );
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);

      // Track aborted share due to legacy clipboard error
      if (page) {
        analytics.trackInteractionEvent(INTERACTION_EVENTS.PAGE_SHARE_ABORTED, {
          page_id: page.id,
          share_method: 'copy_link_legacy',
          user_id: session?.uid || null,
          page_title: title || page.title || "Untitled",
          page_author: page.username || "Anonymous",
          abort_reason: 'legacy_clipboard_error'
        });

        // Also track in Firestore for dashboard analytics
        SharesTrackingService.trackShareAborted(
          page.id,
          'copy_link_legacy',
          'legacy_clipboard_error',
          session?.uid,
          session?.displayName || session?.username,
          title || page.title,
          page.username
        );
      }
      // Remove error toast - allow users to cancel share actions without showing error messages
    }
    document.body.removeChild(textArea);
  }
};