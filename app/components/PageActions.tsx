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

    // Direct Firebase operation with minimal transformation
    const handleAddToPage = async () => {
      if (!selectedPageId) {
        toast.error("Please select a page first");
        return;
      }
      
      setLoading(true);
      console.log("🚨 DIRECT DB OPERATION STARTED");
      
      try {
        // SETUP - Get database reference
        const db = getDatabase(app);
        
        // SOURCE INFO
        const sourceTitle = pageToAdd?.title || 'Unknown Page';
        console.log("🚨 Source:", { title: sourceTitle, id: pageToAdd?.id });
        
        // 1. Get target page data directly from Firebase
        console.log("🚨 Fetching target page:", selectedPageId);
        const targetRef = ref(db, `pages/${selectedPageId}`);
        const targetSnapshot = await get(targetRef);
        
        if (!targetSnapshot.exists()) {
          console.error("🚨 TARGET PAGE NOT FOUND!");
          toast.error("Target page not found in database");
          setLoading(false);
          return;
        }
        
        // 2. Extract target page data
        const targetData = targetSnapshot.val();
        console.log("🚨 Target page data:", { 
          title: targetData.title,
          contentType: typeof targetData.content 
        });
        
        // 3. Extract and log raw content string/object for debugging
        console.log("🚨 TARGET RAW CONTENT:", targetData.content);
        
        // 4. Create a GUARANTEED array format for target content
        let targetContent = [];
        
        try {
          // Handle string or array formats
          if (typeof targetData.content === 'string') {
            targetContent = JSON.parse(targetData.content);
            console.log("🚨 Parsed string content into array");
          } else if (Array.isArray(targetData.content)) {
            targetContent = targetData.content;
            console.log("🚨 Content was already array");
          } else {
            console.error("🚨 Content is neither string nor array:", typeof targetData.content);
          }
          
          // Ensure we have an array
          if (!Array.isArray(targetContent)) {
            console.error("🚨 Content is not an array after parsing, creating empty array");
            targetContent = [];
          }
        } catch (e) {
          console.error("🚨 Error parsing content:", e);
          targetContent = [];
        }
        
        console.log("🚨 Target content array length:", targetContent.length);
        
        // 5. Create a super simple new paragraph to add
        // This should be extremely obvious when added to the page
        const newParagraphs = [
          // Empty paragraph as separator
          {
            type: 'paragraph',
            children: [{ text: '' }]
          },
          // Test paragraph with timestamp to make it unique and identifiable
          {
            type: 'paragraph',
            children: [{ 
              text: `★ ADDED FROM "${sourceTitle}" at ${new Date().toISOString()} ★`
            }]
          }
        ];
        
        console.log("🚨 New paragraphs to add:", JSON.stringify(newParagraphs));
        
        // 6. Create the combined content array 
        const updatedContent = [...targetContent, ...newParagraphs];
        console.log("🚨 Combined content length:", updatedContent.length);
        
        // 7. Update the database with the new content
        console.log("🚨 WRITING TO DATABASE NOW");
        
        // Convert to string for storage
        const contentString = JSON.stringify(updatedContent);
        console.log("🚨 Content string length:", contentString.length);
        
        // Update the database with transaction to avoid race conditions
        await set(ref(db, `pages/${selectedPageId}/content`), contentString);
        await set(ref(db, `pages/${selectedPageId}/lastModified`), new Date().toISOString());
        
        console.log("🚨 DATABASE UPDATED SUCCESSFULLY");
        
        // 8. Close dialog and redirect to see changes
        onClose();
        toast.success(`Added content to "${selectedPageTitle}"`);
        
        // Wait a moment before redirecting to ensure the database update has propagated
        setTimeout(() => {
          console.log("🚨 REDIRECTING NOW to:", `/pages/${selectedPageId}`);
          router.push(`/pages/${selectedPageId}`);
        }, 300);
        
      } catch (error) {
        console.error("🚨 CRITICAL ERROR:", error);
        toast.error("Error adding to page");
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
