"use client";

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Link2, Reply, Edit, Trash2, LayoutPanelLeft, Plus, Check, AlignJustify, AlignLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu';

/**
 * PageActions Component
 * 
 * This component provides all interactive actions for a page, including:
 * - Owner-specific actions: Edit and Delete
 * - General actions: Copy Link, Reply to Page, Add to Page, and Toggle Paragraph Mode
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
  isOwner: boolean;
  isEditing?: boolean;
  setIsEditing?: (value: boolean) => void;
  className?: string;
}

export function PageActions({ 
  page, 
  isOwner, 
  isEditing = false, 
  setIsEditing,
  className = "" 
}: PageActionsProps) {
  const router = useRouter();
  const { lineMode, setLineMode } = useLineSettings();
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);

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
    if (!auth.currentUser) {
      toast.error("You must be logged in to reply");
      return;
    }

    // Create a new page with title "Re: [original page title]"
    const newPageTitle = `Re: "${page.title || "Untitled"}"`;
    
    // Get the current user's username instead of using the original page's username
    let username = "anonymous";
    try {
      const userProfile = await getUserProfile(auth.currentUser.uid);
      if (userProfile && userProfile.username) {
        username = userProfile.username;
      }
    } catch (error) {
      console.error("Error getting user profile:", error);
    }

    // Navigate to the new page creation form with pre-filled values
    router.push(`/create?title=${encodeURIComponent(newPageTitle)}&username=${encodeURIComponent(username)}&replyTo=${page.id}`);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Owner-only actions - Edit and Delete buttons */}
      {isOwner && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 mb-3 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing && setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-2"
          >
            <Edit className="h-4 w-4" />
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}
      
      {/* Actions available to all users - Copy, Reply, Add, Layout */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 border-t pt-4 w-full">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-2"
        >
          <Link2 className="h-4 w-4" />
          Copy Link
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReply}
          className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-2"
        >
          <Reply className="h-4 w-4" />
          Reply to Page
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          asChild
          className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-2"
        >
          <Link href={`/pages/${page.id}/add`}>
            <Plus className="h-4 w-4" />
            Add to Page
          </Link>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-2"
            >
              <LayoutPanelLeft className="h-4 w-4 mr-1.5" />
              Paragraph Mode
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side="top" 
            align="start"
            alignOffset={0}
            sideOffset={5}
            avoidCollisions={true}
            className="max-w-[95vw]"
          >
            <DropdownMenuItem 
              className={`flex flex-col cursor-pointer ${lineMode === LINE_MODES.NORMAL ? 'bg-accent/50' : ''}`}
              onClick={() => {
                setLineMode(LINE_MODES.NORMAL);
              }}
            >
              <div className="flex items-start w-full py-1">
                <AlignLeft className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-left flex-grow overflow-hidden">
                  <div className="font-medium break-words">Normal</div>
                  <div className="text-sm opacity-90 break-words">Traditional style with paragraph numbers and spacing</div>
                </div>
                {lineMode === LINE_MODES.NORMAL && (
                  <Check className="h-4 w-4 ml-2 flex-shrink-0 mt-0.5" />
                )}
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className={`flex flex-col cursor-pointer ${lineMode === LINE_MODES.DENSE ? 'bg-accent/50' : ''}`}
              onClick={() => {
                setLineMode(LINE_MODES.DENSE);
              }}
            >
              <div className="flex items-start w-full py-1">
                <AlignJustify className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-left flex-grow overflow-hidden">
                  <div className="font-medium break-words">Dense</div>
                  <div className="text-sm opacity-90 break-words">Collapses all paragraphs for a more comfortable reading experience</div>
                </div>
                {lineMode === LINE_MODES.DENSE && (
                  <Check className="h-4 w-4 ml-2 flex-shrink-0 mt-0.5" />
                )}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
