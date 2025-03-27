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
        // Log page data for debugging
        console.log("Source page data being used:", {
          id: pageToAdd.id,
          title: pageToAdd.title,
          contentType: typeof pageToAdd.content,
          contentLength: pageToAdd.content ? 
            (typeof pageToAdd.content === 'string' ? pageToAdd.content.length : 'non-string') 
            : 'undefined'
        });
        
        // Get database reference
        const db = getDatabase(app);
        
        // First try to use the page content directly if available
        let sourceContent = [];
        
        // Try to parse the content from the passed page object
        if (pageToAdd.parsedContent) {
          sourceContent = pageToAdd.parsedContent;
        } else if (pageToAdd.content) {
          try {
            sourceContent = typeof pageToAdd.content === 'string'
              ? JSON.parse(pageToAdd.content)
              : pageToAdd.content;
              
            if (Array.isArray(sourceContent) && sourceContent.length > 0) {
              console.log("Using direct page content - found", sourceContent.length, "blocks");
            } else {
              console.log("Direct content was empty or invalid array - will fetch from DB");
            }
          } catch (e) {
            console.error("Error parsing direct content:", e);
          }
        }
        
        // If we couldn't use the direct content, try to fetch from DB
        if (!Array.isArray(sourceContent) || sourceContent.length === 0) {
          console.log("Attempting to fetch source page from database at path:", `pages/${pageToAdd.id}`);
          
          // Try to get the page from the database
          try {
            const sourceSnapshot = await get(ref(db, `pages/${pageToAdd.id}`));
            
            if (sourceSnapshot.exists()) {
              const sourceData = sourceSnapshot.val();
              console.log("Found source page in database:", sourceData.title);
              
              try {
                if (sourceData.content) {
                  sourceContent = typeof sourceData.content === 'string'
                    ? JSON.parse(sourceData.content)
                    : sourceData.content;
                    
                  if (!Array.isArray(sourceContent)) {
                    console.warn("Content from DB is not an array");
                    sourceContent = [];
                  }
                }
              } catch (e) {
                console.error("Error parsing DB content:", e);
              }
            } else {
              // Log error but don't fail - we might have content directly
              console.error("Source page not found in database at path:", `pages/${pageToAdd.id}`);
              
              // Create a simple default content if we have nothing else
              if (sourceContent.length === 0) {
                sourceContent = [
                  { 
                    type: 'paragraph', 
                    children: [{ text: pageToAdd.title || 'Untitled content' }] 
                  }
                ];
              }
            }
          } catch (e) {
            console.error("Error fetching source page:", e);
            // Don't fail - we might have content directly
          }
        }
        
        // Now process the target page
        const targetRef = ref(db, `pages/${selectedPageId}`);
        const targetSnapshot = await get(targetRef);
        
        if (!targetSnapshot.exists()) {
          toast.error("Target page not found in database");
          setLoading(false);
          return;
        }
        
        const targetData = targetSnapshot.val();
        console.log("Target page data:", targetData.title);
        
        // Parse target content
        let targetContent = [];
        try {
          if (targetData.content) {
            targetContent = typeof targetData.content === 'string'
              ? JSON.parse(targetData.content)
              : targetData.content;
          }
        } catch (e) {
          console.error("Error parsing target content:", e);
        }
        
        if (!Array.isArray(targetContent)) targetContent = [];
        
        console.log("Target content blocks:", targetContent.length);
        console.log("Source content blocks:", sourceContent.length);
        
        // Make sure we have some content to add
        if (sourceContent.length === 0) {
          sourceContent = [{ type: 'paragraph', children: [{ text: "Content was empty" }] }];
        }
        
        // Create combined content with separator and attribution
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
        
        // Update the target page with the combined content
        await set(ref(db, `pages/${selectedPageId}/content`), JSON.stringify(combinedContent));
        await set(ref(db, `pages/${selectedPageId}/lastModified`), new Date().toISOString());
        
        // Close dialog and show success message
        onClose();
        toast.success(`Added content to "${selectedPageTitle}"`);
        
        // Redirect to the target page
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
