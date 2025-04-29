"use client";

import React, { useState, useEffect, useContext } from "react";
import { Button } from "./ui/button";
import { Link2, Reply, Edit, Trash2, LayoutPanelLeft, AlignJustify, AlignLeft, X } from "lucide-react";
import dynamic from 'next/dynamic';
import { Switch } from "./ui/switch";
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

// Dynamically import AddToPageButton to avoid SSR issues
const AddToPageButton = dynamic(() => import('./AddToPageButton'), {
  ssr: false,
  loading: () => <Button variant="outline" size="sm" className="gap-2 w-full h-10 md:h-8 md:w-auto" disabled>Loading...</Button>
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
  const [currentLineMode, setCurrentLineMode] = useState(lineMode);

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
    // Get the current user's username using our centralized utility
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

      // 3. If we still don't have a username, use 'Anonymous'
      if (!username) {
        username = 'Anonymous';
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
        <div className="flex flex-col items-stretch gap-3 w-full md:flex-row md:flex-wrap md:items-center">
          {/* Owner-only actions - Edit and Delete buttons */}
          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full h-10 md:h-8 md:w-auto"
                onClick={() => setIsEditing && setIsEditing(!isEditing)}
              >
                {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                <span className="text-sm">{isEditing ? "Cancel" : "Edit"}</span>
              </Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 w-full h-10 md:h-8 md:w-auto text-white"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Delete</span>
                </Button>
              )}
            </>
          )}

          {/* Reply button - available to all users */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full h-10 md:h-8 md:w-auto"
            onClick={handleReply}
          >
            <Reply className="h-4 w-4" />
            <span className="text-sm">Reply</span>
          </Button>

          {/* Add to Page button - styled and placed with other actions */}
          <AddToPageButton page={page} className="gap-2 w-full h-10 md:h-8 md:w-auto" />
        </div>

        {/* Dense Mode switch - moved below other buttons */}
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full h-10 md:h-8 md:w-auto"
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
            <span className="text-sm">Dense mode</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
