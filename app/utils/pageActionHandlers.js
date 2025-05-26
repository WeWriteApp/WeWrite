"use client";

import { toast } from "../components/ui/use-toast";
import { generateReplyTitle, createReplyContent, encodeReplyParams } from "./replyUtils";
import { saveDraftReply, setPendingReplyAction } from "./draftReplyUtils";
import { getCurrentUsername } from "./userUtils";

/**
 * Shared handler for "Add to Page" functionality
 * This ensures consistent behavior between top navigation and bottom page buttons
 *
 * @param {Object} page - The page object
 * @param {Function} setIsAddToPageOpen - Function to open the Add to Page modal
 * @returns {void}
 */
export const handleAddToPage = (page, setIsAddToPageOpen) => {
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
 * @param {Object} page - The page object
 * @param {Object} user - The current user object (null if not authenticated)
 * @param {Object} router - Next.js router object
 * @returns {Promise<void>}
 */
export const handleReply = async (page, user, router) => {
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
    if (!user) {
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
      const username = await getCurrentUsername(user);

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
 * @param {Object} page - The page object
 * @param {string} title - The page title
 * @returns {void}
 */
export const handleShare = (page, title) => {
  if (!page) {
    console.error("No page data provided to handleShare");
    return;
  }

  const pageUrl = `${window.location.origin}/${page.id}`;
  const shareText = `"${title || page.title || "Untitled"}" by ${page.username || "Anonymous"}`;

  if (navigator.share) {
    // Use native sharing if available
    navigator.share({
      title: shareText,
      url: pageUrl
    }).catch(err => {
      console.log('Error sharing:', err);
      // Fallback to clipboard
      fallbackShare(pageUrl, shareText);
    });
  } else {
    // Fallback to clipboard
    fallbackShare(pageUrl, shareText);
  }
};

/**
 * Fallback share function that copies to clipboard
 *
 * @param {string} url - The URL to share
 * @param {string} text - The share text
 * @returns {void}
 */
const fallbackShare = (url, text) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      toast.error("Failed to copy link");
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
    } catch (err) {
      console.error('Fallback copy failed:', err);
      toast.error("Failed to copy link");
    }
    document.body.removeChild(textArea);
  }
};
