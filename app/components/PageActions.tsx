"use client";

import React, { useState, useEffect, useContext } from "react";
import { Button } from "./ui/button";
import { Link2, Reply, Edit, Trash2, LayoutPanelLeft, AlignJustify, AlignLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deletePage } from "../firebase/database";
import { getUserProfile } from "../firebase/auth";
import { auth } from "../firebase/auth";
import { useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { getCurrentUsername } from "../utils/userUtils";
import { generateReplyTitle, createReplyContent, encodeReplyParams } from "../utils/replyUtils";
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
import { AuthModal } from "./AuthModal";

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
}

export function PageActions({
  page,
  content,
  isOwner = false,
  isEditing = false,
  setIsEditing,
  className = ""
}: PageActionsProps) {
  const router = useRouter();
  const { lineMode, setLineMode } = useLineSettings();
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Get user from AuthContext
  const { user } = useContext(AuthContext);
  const actualIsOwner = user && user.uid === page.userId;

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
  /**
   * Copies the current page URL to clipboard
   */
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    });
  };

  /**
   * Handles page deletion with confirmation
   */
  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this page? This action cannot be undone.")) {
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
   */
  const handleReply = async () => {
    if (!user) {
      toast.error("You must be logged in to reply");
      return;
    }

    // Username is now available from the auth context directly (user.displayName)
    // or we can fetch it more reliably if needed, but for the URL generation,
    // let's keep using the utility function for consistency as it handles fallbacks.
    try {
      // We still need the current username for the reply metadata
      const replyInitiatorUsername = user?.displayName || await getCurrentUsername();
      console.log("Reply initiator username:", replyInitiatorUsername);

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
          username: replyInitiatorUsername // Use the fetched/context username
        });

        console.log("Navigating to new page with:", {
          title: replyTitle,
          username: replyInitiatorUsername,
          initialContent
        });

        // Ensure username param is encoded correctly
        router.push(`/new?title=${params.title}&initialContent=${params.content}&isReply=true&username=${encodeURIComponent(replyInitiatorUsername)}`);
      } catch (error) {
        console.error("Error navigating to new page:", error);
        toast.error("Failed to create reply");
      }
    } catch (error) {
      console.error("Error getting username:", error);
      toast.error("Failed to create reply");
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Owner-only actions - Edit and Delete buttons */}
      {actualIsOwner && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 mb-3 w-full">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={isEditLoading}
            onClick={() => {
              if (isEditing) {
                // If already editing, just cancel
                setIsEditing && setIsEditing(false);
              } else {
                // If not editing, show loading state while transitioning to edit mode
                setIsEditLoading(true);
                setIsEditing && setIsEditing(true);
                // Reset loading state after a short delay to ensure UI feedback
                setTimeout(() => setIsEditLoading(false), 500);
              }
            }}
          >
            {isEditLoading ? (
              <>
                <div className="loader"></div>
                Loading...
              </>
            ) : (
              <>
                <Edit className="h-4 w-4" />
                {isEditing ? "Cancel" : "Edit"}
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}

      {/* Actions available to all users - Copy, Reply, Layout */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 border-t-only pt-4 w-full">
        {/* Copy Link Button (always shown) */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleCopyLink}
        >
          <Link2 className="h-4 w-4" />
          Copy Link
        </Button>

        {/* Conditional Reply Button */}
        {user ? (
          // Logged-in user: Show direct reply button
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleReply}
          >
            <Reply className="h-4 w-4" />
            Reply to Page
          </Button>
        ) : (
          // Logged-out user: Show reply button wrapped in AuthModal
          <AuthModal initialTab="login">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              // No onClick needed here, AuthModal handles opening
            >
              <Reply className="h-4 w-4" />
              Reply to Page
            </Button>
          </AuthModal>
        )}

        {/* Layout Dropdown (always shown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <LayoutPanelLeft className="h-4 w-4" />
              Paragraph Mode
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Layout Options</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setLineMode(LINE_MODES.NORMAL)}>
              <AlignLeft className="h-4 w-4 mr-2" />
              Normal Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLineMode(LINE_MODES.DENSE)}>
              <AlignJustify className="h-4 w-4 mr-2" />
              Dense Mode
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
