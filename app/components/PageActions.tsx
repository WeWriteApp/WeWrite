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
    const [selectedPage, setSelectedPage] = useState(null);
    const [selectedPageId, setSelectedPageId] = useState("");
    const [selectedPageTitle, setSelectedPageTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user } = useContext(AuthContext);
    
    console.log("Dialog opened for page:", pageToAdd?.title, pageToAdd?.id);
    
    // Track the FULL page object when selected, not just ID
    const handleSelectPage = React.useCallback((page) => {
      if (page && page.id) {
        console.log(" STORING FULL PAGE OBJECT:", page);
        // Store the complete page object itself
        setSelectedPage(page);
        // Also store ID and title for convenience
        setSelectedPageId(page.id);
        setSelectedPageTitle(page.title || "Selected Page");
      } else {
        console.warn("Invalid page selected:", page);
        setSelectedPage(null);
        setSelectedPageId("");
        setSelectedPageTitle("");
      }
    }, []);
    
    // DIRECT DATABASE LOOKUP APPROACH
    const handleAddToPage = async () => {
      if (!selectedPage || !selectedPageId) {
        toast.error("Please select a page first");
        return;
      }
      
      console.log(" Add to Page Operation Starting");
      console.log(" Selected page object:", selectedPage);
      console.log(" Selected ID:", selectedPageId);
      
      setLoading(true);
      
      try {
        const db = getDatabase(app);
        
        // CRITICAL FIX: Use the EXACT ID format from the search result
        // This is what we see in the console logs: M80CceBv7RD5UZeVYN
        const exactId = selectedPageId;
        console.log(" Using exact ID from search:", exactId);
        
        // DIRECT LOOKUP: Get all pages and find the matching one by ID
        console.log(" Getting all pages to find exact match");
        const allPagesRef = ref(db, 'pages');
        const allPagesSnapshot = await get(allPagesRef);
        
        if (!allPagesSnapshot.exists()) {
          throw new Error("No pages found in database");
        }
        
        const allPages = allPagesSnapshot.val();
        console.log(" Found pages in database:", Object.keys(allPages).length);
        
        // Find the page with the matching ID
        let targetPageKey = null;
        let targetPageData = null;
        
        Object.entries(allPages).forEach(([key, pageData]) => {
          // Check for exact match
          if (key === exactId) {
            console.log(" FOUND EXACT MATCH by key:", key);
            targetPageKey = key;
            targetPageData = pageData;
          }
          // Check for partial match (in case ID is truncated)
          else if (key.includes(exactId) || exactId.includes(key)) {
            console.log(" FOUND PARTIAL MATCH:", key, "contains", exactId);
            if (!targetPageKey) { // Only use if we don't have an exact match
              targetPageKey = key;
              targetPageData = pageData;
            }
          }
          // Check for title match as last resort
          else if (pageData && typeof pageData === 'object' && 
                  'title' in pageData && selectedPageTitle && 
                  typeof pageData.title === 'string' &&
                  pageData.title.toLowerCase() === selectedPageTitle.toLowerCase()) {
            console.log(" FOUND MATCH BY TITLE:", key);
            if (!targetPageKey) { // Only use if we don't have any other match
              targetPageKey = key;
              targetPageData = pageData;
            }
          }
        });
        
        if (!targetPageKey || !targetPageData) {
          throw new Error("Page not found in database after searching all pages");
        }
        
        console.log(" Target page found:", targetPageKey);
        console.log(" Page title:", targetPageData.title);
        
        // Parse the existing content
        let existingContent = [];
        try {
          if (typeof targetPageData.content === 'string') {
            existingContent = JSON.parse(targetPageData.content);
          } else if (Array.isArray(targetPageData.content)) {
            existingContent = targetPageData.content;
          }
        } catch (error) {
          console.error(" Error parsing content:", error);
          existingContent = [];
        }
        
        // Create updated content
        const timestamp = new Date().toLocaleTimeString();
        const updatedContent = [
          ...existingContent,
          { type: 'paragraph', children: [{ text: '' }] },
          { type: 'paragraph', children: [{ text: `Content added at ${timestamp}` }] }
        ];
        
        // Update the database with the new content
        console.log(" Updating page content for key:", targetPageKey);
        await set(ref(db, `pages/${targetPageKey}/content`), JSON.stringify(updatedContent));
        await set(ref(db, `pages/${targetPageKey}/lastModified`), new Date().toISOString());
        
        // Close dialog and show success
        onClose();
        toast.success(`Added to "${targetPageData.title}"`);
        
        // Navigate to the page
        const navUrl = `/pages/${targetPageKey}?refresh=${Date.now()}`;
        console.log(" Navigating to:", navUrl);
        window.location.href = navUrl;
      } catch (error) {
        console.error(" Error:", error);
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
