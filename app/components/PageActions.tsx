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
import { getDatabase, ref, onValue, set, get } from "firebase/database";
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
    const [selectedPageId, setSelectedPageId] = useState("");
    const [selectedPageTitle, setSelectedPageTitle] = useState("");
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    // Simple page selection handler - store only the essential data
    const handleSelectPage = (page) => {
      if (page && page.id) {
        setSelectedPageId(page.id);
        setSelectedPageTitle(page.title || "Untitled");
      }
    };

    // Completely simplified approach - no background operations, direct database access
    const handleAddToPage = async () => {
      // Validate we have the necessary data
      if (!selectedPageId) {
        toast.error("Please select a page first");
        return;
      }
      
      if (!pageToAdd?.id) {
        toast.error("Source page information is missing");
        return;
      }
      
      // Set loading state
      setLoading(true);
      
      try {
        // Get database reference
        const db = getDatabase(app);
        
        // 1. First get the current page (source) content from the database
        const sourceRef = ref(db, `pages/${pageToAdd.id}`);
        const sourceSnapshot = await get(sourceRef);
        
        if (!sourceSnapshot.exists()) {
          toast.error("Source page not found in database");
          setLoading(false);
          return;
        }
        
        const sourceData = sourceSnapshot.val();
        console.log("Source page data:", sourceData);
        
        // 2. Then get the target page content
        const targetRef = ref(db, `pages/${selectedPageId}`);
        const targetSnapshot = await get(targetRef);
        
        if (!targetSnapshot.exists()) {
          toast.error("Target page not found in database");
          setLoading(false);
          return;
        }
        
        const targetData = targetSnapshot.val();
        console.log("Target page data:", targetData);
        
        // 3. Parse both contents
        let targetContent = [];
        let sourceContent = [];
        
        try {
          if (targetData.content) {
            targetContent = typeof targetData.content === 'string'
              ? JSON.parse(targetData.content)
              : targetData.content;
          }
        } catch (e) {
          console.error("Error parsing target content:", e);
        }
        
        try {
          if (sourceData.content) {
            sourceContent = typeof sourceData.content === 'string'
              ? JSON.parse(sourceData.content)
              : sourceData.content;
          }
        } catch (e) {
          console.error("Error parsing source content:", e);
        }
        
        if (!Array.isArray(targetContent)) targetContent = [];
        if (!Array.isArray(sourceContent)) sourceContent = [];
        
        console.log("Target content blocks:", targetContent.length);
        console.log("Source content blocks:", sourceContent.length);
        
        // 4. Create combined content with separator and attribution
        const combinedContent = [
          ...targetContent,
          // Add empty paragraph as separator
          { type: 'paragraph', children: [{ text: '' }] },
          // Add divider
          { type: 'paragraph', children: [{ text: '---' }] },
          // Add attribution
          { 
            type: 'paragraph', 
            children: [
              { text: 'Content from ' },
              { 
                type: 'link',
                url: `/pages/${pageToAdd.id}`,
                children: [{ text: pageToAdd.title || 'Untitled' }]
              },
              { text: ':' }
            ]
          },
          // Add empty paragraph for spacing
          { type: 'paragraph', children: [{ text: '' }] },
          // Add the source content
          ...sourceContent
        ];
        
        // 5. Update the target page with the combined content
        await set(ref(db, `pages/${selectedPageId}/content`), JSON.stringify(combinedContent));
        await set(ref(db, `pages/${selectedPageId}/lastModified`), new Date().toISOString());
        
        // 6. Close dialog and show success message
        onClose();
        toast.success(`Added content to "${selectedPageTitle}"`);
        
        // 7. Redirect to the target page
        router.push(`/pages/${selectedPageId}`);
        
      } catch (error) {
        console.error("Error adding content to page:", error);
        toast.error("An error occurred while adding content");
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
              selectedId={selectedPageId}
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
            disabled={!selectedPageId || loading}
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
            <AddToPageDialogContent 
              pageToAdd={{
                ...page,
                content: typeof page.content === 'string' 
                  ? page.content 
                  : (page.content ? JSON.stringify(page.content) : '[]')
              }} 
              onClose={() => setShowAddDialog(false)} 
            />
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
