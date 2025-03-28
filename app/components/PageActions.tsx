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
import { getDatabase, ref, onValue, set, get, update } from "firebase/database";
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Store the current page content for the Add to Page functionality
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
        console.log("Captured current page content for Add to Page:", parsedContent);
      } catch (error) {
        console.error("Error parsing content for Add to Page:", error);
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

  // Add to Page Dialog Content
  const AddToPageDialogContent = ({
    onClose,
    pageToAdd,
  }) => {
    const [selectedPageId, setSelectedPageId] = useState("");
    const [selectedPageTitle, setSelectedPageTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user } = useContext(AuthContext);
    
    console.log("Dialog opened for page:", pageToAdd?.title, pageToAdd?.id);
    
    // This is called when a page is selected in the TypeaheadSearch
    const handleSelectPage = React.useCallback((page) => {
      if (page && page.id) {
        console.log("Selected page:", page.title, page.id);
        setSelectedPageId(page.id);
        setSelectedPageTitle(page.title || "Selected Page");
      } else {
        console.warn("Invalid page selected:", page);
        setSelectedPageId("");
        setSelectedPageTitle("");
      }
    }, []);
    
    // Direct database operation with maximum debugging
    const handleAddToPage = async () => {
      if (!selectedPageId) {
        toast.error("Please select a page first");
        return;
      }
      
      setLoading(true);
      console.log(" Add to Page Operation Starting");
      console.log(" Selected page ID:", selectedPageId);
      console.log(" Selected page title:", selectedPageTitle);
      
      try {
        const db = getDatabase(app);
        
        // STEP 1: Verify source page (the page we're adding from)
        console.log(" Source page:", pageToAdd?.id, pageToAdd?.title);
        if (!pageToAdd?.id) {
          console.error(" Source page ID is missing!");
          toast.error("Source page information is missing");
          setLoading(false);
          return;
        }
        
        // STEP 2: Verify the target page exists
        const targetPagePath = `pages/${selectedPageId}`;
        console.log(" Looking up target page at path:", targetPagePath);
        
        const targetSnapshot = await get(ref(db, targetPagePath));
        if (!targetSnapshot.exists()) {
          console.error(" Target page not found at path:", targetPagePath);
          toast.error("Target page not found - please try selecting a different page");
          setLoading(false);
          return;
        }
        
        // STEP 3: Get target page data
        const targetData = targetSnapshot.val();
        console.log(" Target page found:", targetData.title);
        
        // STEP 4: Parse target content
        let targetContent = [];
        try {
          if (typeof targetData.content === 'string') {
            targetContent = JSON.parse(targetData.content);
            console.log(" Parsed target content string, length:", targetContent.length);
          } else if (Array.isArray(targetData.content)) {
            targetContent = targetData.content;
            console.log(" Target content is already array, length:", targetContent.length);
          } else {
            console.warn(" Target content is neither string nor array:", typeof targetData.content);
            targetContent = [];
          }
          
          if (!Array.isArray(targetContent)) {
            console.warn(" Target content is not an array after parsing");
            targetContent = [];
          }
        } catch (error) {
          console.error(" Error parsing target content:", error);
          targetContent = [];
        }
        
        // STEP 5: Create new content with timestamp for easy testing
        const timestamp = new Date().toLocaleTimeString();
        const newParagraphs = [
          // Empty line separator
          {
            type: 'paragraph',
            children: [{ text: '' }]
          },
          // Test content with timestamp
          {
            type: 'paragraph',
            children: [{ text: `Content added at ${timestamp} from ${pageToAdd.title}` }]
          }
        ];
        
        // STEP 6: Combine content
        const combinedContent = [...targetContent, ...newParagraphs];
        console.log(" Created combined content with", combinedContent.length, "items");
        
        // STEP 7: Update the database
        const targetPageRef = ref(db, targetPagePath);
        console.log(" Updating target page...");
        
        const updates = {
          content: JSON.stringify(combinedContent),
          lastModified: new Date().toISOString()
        };
        
        await update(targetPageRef, updates);
        console.log(" Database updated successfully!");
        
        // STEP 8: Close dialog and redirect
        onClose();
        toast.success(`Added to "${targetData.title}"`);
        
        // STEP 9: Force hard reload with cache busting
        const targetUrl = `/pages/${selectedPageId}?refresh=${Date.now()}`;
        console.log(" Redirecting to:", targetUrl);
        window.location.href = targetUrl;
        
      } catch (error) {
        console.error(" Error in add to page operation:", error);
        toast.error("Error adding to page: " + error.message);
        setLoading(false);
      }
    };
    
    return (
      <div className="grid gap-4 py-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Select a page</h3>
          <TypeaheadSearch 
            onSelect={handleSelectPage}
            placeholder="Search for a page"
            radioSelection={true}
            selectedId={selectedPageId}
            editableOnly={true}
          />
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddToPage}
            disabled={!selectedPageId || loading}
            className="bg-primary"
          >
            {loading ? <Loader size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
            Add to Page
          </Button>
        </DialogFooter>
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
                id: page.id || '',
                // Pass the current page content directly from state
                parsedContent: currentPageContent,
                content: typeof content === 'string' 
                  ? content 
                  : (content ? JSON.stringify(content) : '[]')
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
