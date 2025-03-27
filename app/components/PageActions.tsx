"use client";

import React, { useState, useEffect, useContext } from "react";
import { Button } from "./ui/button";
import { Link2, Reply, Edit, Trash2, LayoutPanelLeft, Plus, Check, AlignJustify, AlignLeft, Loader } from "lucide-react";
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
  DropdownMenuSeparator,
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
import { getDatabase, ref, onValue, update, get } from "firebase/database";
import { app } from "../firebase/config";
import TypeaheadSearch from './TypeaheadSearch';

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
  isOwner = false, 
  isEditing = false, 
  setIsEditing,
  className = ""
}: PageActionsProps) {
  const router = useRouter();
  const { lineMode, setLineMode } = useLineSettings();
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

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

    // Get the current user's username using our centralized utility
    try {
      const username = await getCurrentUsername();
      console.log("Current user username from utility:", username);

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
        
        console.log("Navigating to new page with:", {
          title: replyTitle,
          username,
          initialContent
        });
        
        router.push(`/new?title=${params.title}&initialContent=${params.content}&isReply=true&username=${params.username}`);
      } catch (error) {
        console.error("Error navigating to new page:", error);
        toast.error("Failed to create reply");
      }
    } catch (error) {
      console.error("Error getting username:", error);
      toast.error("Failed to create reply");
    }
  };

  /**
   * AddToPageDialogContent Component
   * 
   * Manages searching and selecting a page to add the current content to
   */
  function AddToPageDialogContent({ pageToAdd, onClose }) {
    const [selectedPage, setSelectedPage] = useState(null);
    const { user } = useContext(AuthContext);
    const [searchActive, setSearchActive] = useState(false);
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [selectedData, setSelectedData] = useState(null);
    
    // Handle page selection
    const handleSelectPage = (page) => {
      console.log("Selected page (raw):", page);
      
      // Store the selected page data
      setSelectedPage(page);
      
      // Log the selection
      console.log("Selected page stored:", page);
    };

    const handleAddToPage = async () => {
      // Input validation
      if (!selectedPage) {
        toast.error("Please select a page first");
        return;
      }
      
      if (!pageToAdd) {
        toast.error("Source page data is missing");
        return;
      }
      
      // Start loading state
      setLoading(true);
      
      try {
        console.log("Adding content from", pageToAdd.title, "to", selectedPage.title);
        
        // Get database instance
        const db = getDatabase(app);
        
        // Create direct references
        const targetRef = ref(db, `pages/${selectedPage.id}`);
        const sourceRef = ref(db, `pages/${pageToAdd.id}`);
        
        console.log("Target ref path:", targetRef.toString());
        console.log("Source ref path:", sourceRef.toString());
        
        // Get target page data first
        let targetData = null;
        
        try {
          const targetSnap = await get(targetRef);
          if (targetSnap.exists()) {
            targetData = targetSnap.val();
            console.log("Target page data found:", targetData.title);
          } else {
            console.error("Target page not found at path:", targetRef.toString());
            toast.error("Selected page not found");
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error fetching target page:", error);
          toast.error("Error accessing selected page");
          setLoading(false);
          return;
        }
        
        // Get source page data
        let sourceData = null;
        
        try {
          const sourceSnap = await get(sourceRef);
          if (sourceSnap.exists()) {
            sourceData = sourceSnap.val();
            console.log("Source page data found:", sourceData.title);
          } else {
            console.error("Source page not found at path:", sourceRef.toString());
            toast.error("Current page data not found");
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error fetching source page:", error);
          toast.error("Error accessing current page");
          setLoading(false);
          return;
        }
        
        // Parse target content
        let targetContent = [];
        if (targetData.content) {
          try {
            targetContent = typeof targetData.content === 'string' 
              ? JSON.parse(targetData.content) 
              : targetData.content;
              
            if (!Array.isArray(targetContent)) {
              console.warn("Target content is not an array, initializing empty array");
              targetContent = [];
            }
          } catch (error) {
            console.error("Error parsing target content:", error);
            targetContent = [];
          }
        }
        
        // Parse source content
        let sourceContent = [];
        if (sourceData.content) {
          try {
            sourceContent = typeof sourceData.content === 'string'
              ? JSON.parse(sourceData.content)
              : sourceData.content;
              
            if (!Array.isArray(sourceContent)) {
              console.warn("Source content is not an array, initializing empty array");
              sourceContent = [];
            }
          } catch (error) {
            console.error("Error parsing source content:", error);
            sourceContent = [];
          }
        }
        
        // Create divider and reference
        const separator = {
          type: 'paragraph',
          children: [{ text: '---' }]
        };
        
        const referenceBlock = {
          type: 'paragraph',
          children: [
            { text: 'Content from ' },
            {
              type: 'link',
              url: `/pages/${pageToAdd.id}`,
              children: [{ text: pageToAdd.title || 'Untitled' }]
            },
            { text: ` by ${pageToAdd.username || 'Anonymous'}:` }
          ]
        };
        
        // Combine content
        const newContent = [...targetContent, separator, referenceBlock, ...sourceContent];
        
        // Prepare update
        const updates = {};
        updates[`pages/${selectedPage.id}/content`] = JSON.stringify(newContent);
        updates[`pages/${selectedPage.id}/lastModified`] = new Date().toISOString();
        
        // Close dialog first to avoid UI issues
        console.log("Closing dialog");
        onClose();
        
        // Show success notification
        toast.success(`Content added to "${selectedPage.title || 'Untitled'}"`);
        
        // Redirect immediately
        console.log("Redirecting to", selectedPage.id);
        router.push(`/pages/${selectedPage.id}`);
        
        // Update database in background
        console.log("Updating database...");
        await update(ref(db), updates);
        console.log("Database updated successfully");
        
      } catch (error) {
        console.error("Error in handleAddToPage:", error);
        toast.error("An error occurred while adding content to page");
        setLoading(false);
      }
    };
    
    return (
      <div className="space-y-4">
        <div className="p-2">
          <h2 className="text-sm font-medium mb-2">Select a page to add the current content to</h2>
          
          <div className="overflow-y-auto max-h-[40vh]">
            <TypeaheadSearch 
              onSelect={handleSelectPage}
              placeholder="Search pages..."
              radioSelection={true}
              selectedId={selectedPage?.id}
              editableOnly={true}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 p-2 pt-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddToPage} 
            disabled={!selectedPage || loading}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                Adding...
              </>
            ) : (
              'Add to Page'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Owner-only actions - Edit and Delete buttons */}
      {isOwner && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 mb-3 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing && setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-3 text-base"
          >
            <Edit className="h-5 w-5" />
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-3 text-base"
          >
            <Trash2 className="h-5 w-5" />
            Delete
          </Button>
        </div>
      )}
      
      {/* Actions available to all users - Copy, Reply, Add, Layout */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 border-t pt-4 w-full">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-3 text-base"
        >
          <Link2 className="h-5 w-5" />
          Copy Link
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReply}
          className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-3 text-base"
        >
          <Reply className="h-5 w-5" />
          Reply to Page
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-3 text-base"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-5 w-5" />
          Add to Page
        </Button>
        
        {/* Add to Page Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add to Page</DialogTitle>
              <DialogDescription>
                Select a page to add the current content to
              </DialogDescription>
            </DialogHeader>
            <AddToPageDialogContent pageToAdd={page} onClose={() => setShowAddDialog(false)} />
          </DialogContent>
        </Dialog>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 justify-center w-full sm:w-auto px-4 py-3 text-base"
            >
              <LayoutPanelLeft className="h-5 w-5 mr-1.5" />
              Paragraph Mode
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-sm">Select Paragraph Display</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 py-2 cursor-pointer"
              onClick={() => setLineMode(LINE_MODES.NORMAL)}
            >
              <AlignLeft className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="font-medium">Normal Mode</span>
                <span className="text-xs text-muted-foreground">Standard paragraph formatting</span>
              </div>
              {lineMode === LINE_MODES.NORMAL && <Check className="h-5 w-5 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 cursor-pointer"
              onClick={() => setLineMode(LINE_MODES.DENSE)}
            >
              <AlignJustify className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="font-medium">Dense Mode</span>
                <span className="text-xs text-muted-foreground">Continuous text with verse numbers</span>
              </div>
              {lineMode === LINE_MODES.DENSE && <Check className="h-5 w-5 ml-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
