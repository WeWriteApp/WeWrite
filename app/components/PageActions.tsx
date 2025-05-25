"use client";

import React, { useState, useEffect, useContext } from "react";
import { Button } from "./ui/button";
import { Reply, Edit, Trash2, LayoutPanelLeft, AlignJustify, AlignLeft, X } from "lucide-react";
import dynamic from 'next/dynamic';
import { Switch } from "./ui/switch";
import { useRouter } from "next/navigation";
import { toast } from "./ui/use-toast";
import { deletePage } from "../firebase/database";
import { getUserProfile } from "../firebase/auth";
import { auth } from "../firebase/auth";
import { useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';
import { cn } from "../lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { getCurrentUsername } from "../utils/userUtils";
import { generateReplyTitle, createReplyContent, encodeReplyParams } from "../utils/replyUtils";
import { saveDraftReply, setPendingReplyAction } from "../utils/draftReplyUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "./ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { AuthContext } from "../providers/AuthProvider";
import { getDatabase, ref, onValue, set, get, update } from "firebase/database";
import { app } from "../firebase/config";
import TypeaheadSearch from './TypeaheadSearch';
import FollowButton from './FollowButton';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';

// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('./AddToPageButton'), {
  ssr: false,
  loading: () => <Button variant="outline" size="lg" className="gap-2 w-full rounded-2xl" disabled>Loading...</Button>
});

/**
 * PageActions Component
 *
 * This component provides all interactive actions for a page, including:
 * - Owner-specific actions: Edit and Delete
 * - General actions: Copy Link, Reply to Page, and Toggle Paragraph Mode
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
}

export function PageActions({
  page,
  content,
  isOwner = false,
  isEditing = false,
  setIsEditing,
  className = "",
  showFollowButton = false
}: PageActionsProps) {
  const router = useRouter();
  const { lineMode, setLineMode } = useLineSettings();
  const { user } = useContext(AuthContext);
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
  const [currentLineMode, setCurrentLineMode] = useState(lineMode);

  // Use confirmation modal hook
  const { confirmationState, confirmDelete, closeConfirmation } = useConfirmation();

  // Ensure the switch reflects the current mode from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('lineMode');
      if (savedMode && (savedMode === LINE_MODES.NORMAL || savedMode === LINE_MODES.DENSE)) {
        setCurrentLineMode(savedMode);
      }
    }
  }, []);

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
        await deletePage(page.id);
        toast.success("Page deleted successfully");
        router.push("/");
      } catch (error) {
        console.error("Error deleting page:", error);
        toast.error("Failed to delete page");
      }
    }
  };

  /**
   * Creates a reply to the current page
   * For non-authenticated users, stores the draft reply and redirects to login
   */
  const handleReply = async () => {
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
            const currentAccount = accounts.find(acc => acc.isCurrent);

            if (currentAccount && (currentAccount.username || currentAccount.displayName)) {
              username = currentAccount.username || currentAccount.displayName;
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
      const replyTitle = generateReplyTitle(page.title);
      const initialContent = createReplyContent({
        pageId: page.id,
        pageTitle: page.title,
        userId: page.userId,
        username: page.username,
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

        // Use the direct-reply route instead of the new route
        // Include the page title as a separate parameter to ensure it's available for attribution
        const replyUrl = `/new?replyTo=${page.id}&page=${encodeURIComponent(page.title || "Untitled")}&title=${params.title}&initialContent=${params.content}&username=${params.username}`;
        router.push(replyUrl);
      } catch (error) {
        console.error("Error navigating to direct-reply page:", error);
        toast.error("Failed to create reply");
      }
    } catch (error) {
      console.error("Error in handleReply:", error);
      toast.error("Failed to create reply");
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* All buttons - horizontal on desktop, vertical on mobile */}
      <div className="flex flex-col items-stretch gap-3 w-full">
        {/* Main action buttons - horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col items-stretch gap-3 w-full md:flex-row md:flex-wrap md:items-center md:justify-center">
          {/* Owner-only actions - Edit and Delete buttons */}
          {isOwner && (
            <>
              <Button
                variant={isEditing ? "outline" : "default"}
                size="lg"
                className="gap-2 w-full md:w-auto rounded-2xl font-medium"
                onClick={() => setIsEditing && setIsEditing(!isEditing)}
              >
                {isEditing ? <X className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                <span>{isEditing ? "Cancel" : "Edit"}</span>
              </Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  size="lg"
                  className="gap-2 w-full md:w-auto rounded-2xl font-medium text-white"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-5 w-5" />
                  <span>Delete</span>
                </Button>
              )}
            </>
          )}

          {/* Share button removed - now only in page header */}

          {/* Follow button - available to non-owners when logged in */}
          {showFollowButton && user && !isOwner && !isEditing && (
            <FollowButton
              pageId={page.id}
              pageTitle={page.title}
              pageOwnerId={page.userId}
              className="gap-2 w-full md:w-auto rounded-2xl font-medium"
              size="lg"
            />
          )}

          {/* Add to Page button - available to all users */}
          <AddToPageButton page={page} />

          {/* Reply button - available to all users */}
          <Button
            variant="default"
            size="lg"
            className="gap-2 w-full md:w-auto rounded-2xl font-medium"
            onClick={handleReply}
          >
            <Reply className="h-5 w-5" />
            <span>Reply</span>
          </Button>
        </div>

        {/* Dense Mode toggle in its own row - using a div instead of Button to avoid nested buttons */}
        <div className="mt-2">
          <div
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-medium transition-colors",
              "border border-theme-medium bg-background text-foreground shadow-sm hover:bg-background hover:shadow-md hover:border-theme-medium",
              "h-10 px-4 py-2",
              "gap-2 w-full cursor-pointer"
            )}
            onClick={() => {
              const newMode = currentLineMode === LINE_MODES.DENSE ? LINE_MODES.NORMAL : LINE_MODES.DENSE;
              setCurrentLineMode(newMode); // Update local state immediately
              setLineMode(newMode); // Update the mode without page reload
            }}
          >
            <Switch
              checked={currentLineMode === LINE_MODES.DENSE}
              onCheckedChange={(checked) => {
                const newMode = checked ? LINE_MODES.DENSE : LINE_MODES.NORMAL;
                setCurrentLineMode(newMode); // Update local state immediately
                setLineMode(newMode); // Update the mode without page reload
              }}
            />
            <span>Dense mode</span>
          </div>
        </div>
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
