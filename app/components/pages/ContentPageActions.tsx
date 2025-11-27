"use client";

import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Reply, Edit, Trash2, LayoutPanelLeft, AlignJustify, AlignLeft, X, Link, ThumbsUp, ThumbsDown } from "lucide-react";
import dynamic from 'next/dynamic';
import { useRouter } from "next/navigation";
import { useToast } from "../ui/use-toast";
// Using API client instead of direct Firebase calls
import { getUserProfile } from "../../utils/apiClient";
import { useAuth } from "../../providers/AuthProvider";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from "../ui/dropdown-menu";
import { getCurrentUsername } from "../../utils/userUtils";
import { generateReplyTitle, createReplyContent, encodeReplyParams } from "../../utils/replyUtils";
import { saveDraftReply, setPendingReplyAction } from "../../utils/draftReplyUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "../ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
// REMOVED: Direct Firebase RTDB imports - now using API endpoints
import { rtdbApi } from "../../utils/apiClient";

import FollowButton from '../utils/FollowButton';
import { useConfirmation } from "../../hooks/useConfirmation";
import ConfirmationModal from '../utils/ConfirmationModal';
import { navigateAfterPageDeletion } from "../../utils/postDeletionNavigation";
import { getAnalyticsService } from "../../utils/analytics-service";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext";

// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('../utils/AddToPageButton'), {
  ssr: false,
  loading: () => <Button variant="secondary" size="lg" className="gap-2 w-full rounded-2xl" disabled>Loading...</Button>
});

/**
 * PageActions Component
 *
 * This component provides all interactive actions for a page, including:
 * - Owner-specific actions: Edit and Delete
 * - General actions: Copy Link, Reply to Page, and Toggle Paragraph Mode
 *
 * UPDATED 2024: Now follows standardized page padding system
 * - Inherits px-4 padding from PageFooter container
 * - Buttons use consistent rounded-2xl styling
 * - Follows unified spacing and alignment standards
 *
 * Paragraph Mode Options:
 * 1. Normal Mode: Traditional document style with paragraph numbers creating indentation
 *    - Numbers positioned to the left of the text
 *    - Clear indent for each paragraph
 *    - Proper spacing between paragraphs
 *
 * 2. Dense Mode: Bible verse style with continuous text flow
 *    - NO line breaks between paragraphs
 *    - Text wraps continuously as if newline characters were temporarily deleted
 *    - Paragraph numbers inserted inline within the continuous text
 *    - Only a small space separates paragraphs
 *
 * Both modes use the same text size (1rem/16px) and paragraph number style (text-muted-foreground).
 *
 * The component is responsive and adapts to mobile and desktop viewports:
 * - On mobile: Buttons stack vertically and take full width
 * - On desktop: Buttons display horizontally and take only necessary width
 *
 * STYLING STANDARDS:
 * - Uses size="lg" for better mobile usability
 * - Consistent gap-2 spacing for icons and text
 * - Follows w-full md:w-auto responsive pattern
 * - Uses rounded-2xl for modern button styling
 *
 * This component replaces the previous PageInteractionButtons and ActionRow components,
 * consolidating all page interactions in one place for better maintainability.
 */
interface PageActionsProps {
  page: {
    id: string;
    title?: string;
    content?: any;
    userId?: string;
    username?: string;
  };
  content: any;
  isOwner: boolean;
  isEditing?: boolean;
  setIsEditing?: (value: boolean) => void;
  className?: string;
  showFollowButton?: boolean;
  onInsertLink?: () => void; // Add insert link callback
  isSaving?: boolean; // Add saving state
}

export function ContentPageActions({
  page,
  content,
  isOwner = false,
  isEditing = false,
  setIsEditing,
  className = "",
  showFollowButton = false,
  onInsertLink,
  isSaving = false
}: PageActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const analytics = getAnalyticsService();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isReplyPickerOpen, setIsReplyPickerOpen] = useState(false);
  const [pageOwnerUsername, setPageOwnerUsername] = useState(page.username || '');
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);

  // Use confirmation modal hook
  const { confirmationState, confirmDelete, closeConfirmation } = useConfirmation();

  // Resolve page owner's display username to avoid showing userId/UUID
  useEffect(() => {
    const resolveUsername = async () => {
      try {
        if (page.username && page.username !== page.userId) {
          setPageOwnerUsername(page.username);
          return;
        }
        if (page.userId) {
          const profile = await getUserProfile(page.userId);
          if (profile?.username) {
            setPageOwnerUsername(profile.username);
            return;
          }
        }
        setPageOwnerUsername('');
      } catch (error) {
        console.error('Error resolving page owner username:', error);
        setPageOwnerUsername('');
      }
    };

    resolveUsername();
  }, [page.userId, page.username]);

  // Use line settings for paragraph mode toggle
  const { lineMode, setLineMode } = useLineSettings();

  // Store the current page content for future use
  const [currentPageContent, setCurrentPageContent] = useState<any>(null);

  // When the component mounts or content changes, capture the content
  useEffect(() => {
    if (content) {
      try {
        // Parse the content if it's a string, otherwise use it directly
        const parsedContent = typeof content === 'string'
          ? JSON.parse(content)
          : content;

        setCurrentPageContent(parsedContent);
        console.log("Captured current page content:", parsedContent);
      } catch (error) {
        console.error("Error parsing content:", error);
      }
    }
  }, [content]);
  // Share functionality moved to page header

  /**
   * Handles page deletion with confirmation
   */
  const handleDelete = async () => {
    const confirmed = await confirmDelete("this page");
    if (confirmed) {
      try {
        // CRITICAL: Navigate IMMEDIATELY before deletion to prevent 404
        // Use graceful navigation with proper browser history handling
        await navigateAfterPageDeletion(page, user, router);

        // Delete the page after navigation has started - use API instead of direct Firebase
        const response = await fetch(`/api/pages?id=${page.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete page');
        }

        // Trigger success event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('page-deleted', {
            detail: { pageId: page.id }
          }));
        }

      } catch (error) {
        console.error("Error deleting page:", error);
        toast({
          title: "Delete failed",
          description: "Failed to delete page",
          variant: "destructive"
        });
      }
    }
  };

  /**
   * Creates a reply to the current page with an optional reply type
   * For non-authenticated users, stores the draft reply and redirects to login
   */
  const startReplyFlow = async (replyType: 'agree' | 'disagree' | 'standard' | null = null) => {
    // Check if user is authenticated
    if (!user) {
      // User is not authenticated, store draft reply and redirect to login
      try {
        // Create standardized reply content
        const replyTitle = generateReplyTitle(page.title || "Untitled");
        const initialContent = createReplyContent({
          pageId: page.id,
          pageTitle: page.title || "Untitled",
          userId: page.userId || "",
          username: page.username || "Anonymous",
          replyType: replyType || "standard"
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
          toast({
            title: "Reply saved",
            description: "Your reply has been saved. Please sign in to post it.",
            variant: "success"
          });

          // Redirect to login page with action parameter
          router.push(`/auth/login?action=posting_reply&return_to=${encodeURIComponent(returnUrl)}`);
        } else {
          toast({
            title: "Save failed",
            description: "Failed to save your reply. Please try again.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error handling guest reply:", error);
        toast({
          title: "Reply failed",
          description: "Failed to create reply",
          variant: "destructive"
        });
      }
      return;
    }

    // User is authenticated, proceed with normal reply flow
    try {
      // Try to get username from multiple sources
      let username = '';

      // 1. Try to get username from getCurrentUsername utility
      try {
        username = await getCurrentUsername();
        console.log("Current user username from utility:", username);
      } catch (error) {
        console.error("Error getting username from utility:", error);
      }

      // 2. If we don't have a username, try to get it from wewrite_accounts
      if (!username) {
        try {
          const wewriteAccounts = sessionStorage.getItem('wewrite_accounts');
          if (wewriteAccounts) {
            const accounts = JSON.parse(wewriteAccounts);
            const user = accounts.find(acc => acc.isCurrent);

            if (user && user.username) {
              username = user.username;
              console.log("Found username in wewrite_accounts:", username);
            }
          }
        } catch (error) {
          console.error("Error getting username from wewrite_accounts:", error);
        }
      }

      // 3. If we still don't have a username, use 'Missing username'
      if (!username) {
        username = 'Missing username';
      }

      // Use utility functions to create standardized reply content
      const replyTitle = generateReplyTitle(page.title || "Untitled");
      const initialContent = createReplyContent({
        pageId: page.id,
        pageTitle: page.title || "Untitled",
        userId: page.userId || "",
        username: page.username || "Anonymous",
        replyType: "standard"
      });

      // Use utility to encode parameters
      try {
        const params = encodeReplyParams({
          title: replyTitle,
          content: initialContent,
          username
        });

        console.log("Navigating to direct-reply page with:", {
          title: replyTitle,
          username,
          initialContent
        });

        // CONSOLIDATION FIX: Use unified /new route for all page creation
        // Include the page title as a separate parameter to ensure it's available for attribution
        const ownerUsername = pageOwnerUsername || page.username || username;
        const replyUrl = `/new?replyTo=${page.id}&page=${encodeURIComponent(page.title || "Untitled")}&pageUserId=${page.userId || ''}&pageUsername=${encodeURIComponent(ownerUsername || '')}&title=${params.title}&initialContent=${params.content}&username=${params.username}&replyType=${replyType || 'standard'}`;
        router.push(replyUrl);
      } catch (error) {
        console.error("Error navigating to direct-reply page:", error);
        toast({
          title: "Reply failed",
          description: "Failed to create reply",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error in handleReply:", error);
      toast({
        title: "Reply failed",
        description: "Failed to create reply",
        variant: "destructive"
      });
    }
  };

  // Wrapper that logs analytics then starts flow
  const handleReply = (replyType: 'agree' | 'disagree' | 'standard' | null = null) => {
    analytics?.trackContentEvent('reply', { replyType: replyType || 'standard' });
    setIsReplyPickerOpen(false);
    startReplyFlow(replyType);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* All buttons - horizontal on desktop, vertical on mobile */}
      <div className="flex flex-col items-stretch gap-3 w-full">
        {/* Main action buttons - horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col items-stretch gap-3 w-full md:flex-row md:flex-wrap md:items-center md:justify-center">
          {/* Follow button - available to non-owners when logged in */}
          {showFollowButton && user && !isOwner && (
            <FollowButton
              pageId={page.id}
              pageTitle={page.title}
              pageOwnerId={page.userId}
              className="gap-2 w-full md:w-auto rounded-2xl font-medium"
              size="lg"
            />
          )}

          {/* Insert Link button - shown when editing */}
          {isEditing && onInsertLink && (
            <Button
              variant="default"
              size="lg"
              className="gap-2 w-full md:w-auto rounded-2xl font-medium"
              onClick={onInsertLink}
              disabled={isSaving}
            >
              <Link className="h-5 w-5" />
              <span>Insert Link</span>
            </Button>
          )}

          {/* Add to Page button - available to all users when not editing */}
          {!isEditing && <AddToPageButton page={page} />}

          {/* Reply button - available to all users when not editing */}
          {!isEditing && (
            <>
              <Button
                variant="default"
                size="lg"
                className="gap-2 w-full md:w-auto rounded-2xl font-medium"
                onClick={() => setIsReplyPickerOpen(true)}
              >
                <Reply className="h-5 w-5" />
                <span>Reply</span>
              </Button>

              <Dialog open={isReplyPickerOpen} onOpenChange={setIsReplyPickerOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Select reply type</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 pt-2">
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={() => handleReply('agree')}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Agree
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={() => handleReply('disagree')}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Disagree
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={() => handleReply(null)}
                    >
                      <Reply className="h-4 w-4" />
                      Just reply
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {/* REMOVED: Duplicate dense mode toggle - keeping only the one under page content */}

      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        variant={confirmationState.variant}
        isLoading={confirmationState.isLoading}
        icon={confirmationState.icon}
      />
    </div>
  );
}

export default ContentPageActions;
