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
import { getDatabase, ref, onValue, update } from "firebase/database";
import { app } from "../firebase/config";

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
    const [searchQuery, setSearchQuery] = useState('');
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPage, setSelectedPage] = useState(null);
    const { user } = useContext(AuthContext);
    
    // Search for pages when dialog opens
    useEffect(() => {
      if (user) {
        setLoading(true);
        
        // Get pages that the user has edit access to
        const db = getDatabase(app);
        const pagesRef = ref(db, 'pages');
        
        onValue(pagesRef, (snapshot) => {
          const pagesData = snapshot.val();
          if (pagesData) {
            // Filter pages that the user has edit access to (user is the owner)
            const userPages = Object.entries(pagesData)
              .map(([id, page]) => ({ id, ...page }))
              .filter(page => 
                // Only include pages the user owns
                page.userId === user.uid && 
                // Exclude the current page
                pageToAdd && page.id !== pageToAdd.id
              )
              .sort((a, b) => {
                // Sort by last modified date (newest first)
                const aDate = a.lastModified || 0;
                const bDate = b.lastModified || 0;
                return bDate - aDate;
              });
            
            setPages(userPages);
          } else {
            setPages([]);
          }
          setLoading(false);
        });
      }
    }, [user, pageToAdd]);
    
    // Filter pages based on search query
    const filteredPages = searchQuery.trim() === '' 
      ? pages 
      : pages.filter(page => 
          (page.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase())
        );
    
    const handleAddToPage = async () => {
      if (!selectedPage || !pageToAdd) return;
      
      try {
        // Get the content of the selected page
        const db = getDatabase(app);
        const pageRef = ref(db, `pages/${selectedPage.id}`);
        
        onValue(pageRef, (snapshot) => {
          const targetPage = snapshot.val();
          if (!targetPage) {
            toast({
              title: "Error",
              description: "Selected page not found",
              variant: "destructive"
            });
            return;
          }
          
          // Parse the content
          let targetContent;
          try {
            targetContent = typeof targetPage.content === 'string' 
              ? JSON.parse(targetPage.content) 
              : targetPage.content;
          } catch (error) {
            console.error("Error parsing target page content:", error);
            targetContent = [];
          }
          
          if (!Array.isArray(targetContent)) {
            targetContent = [];
          }
          
          // Parse the content of the page to add
          let sourceContent;
          try {
            sourceContent = typeof pageToAdd.content === 'string' 
              ? JSON.parse(pageToAdd.content) 
              : pageToAdd.content;
          } catch (error) {
            console.error("Error parsing source page content:", error);
            sourceContent = [];
          }
          
          if (!Array.isArray(sourceContent)) {
            sourceContent = [];
          }
          
          // Add a divider and reference to the source page
          targetContent.push({
            type: "thematicBreak",
            children: [{ text: "" }]
          });
          
          targetContent.push({
            type: "paragraph",
            children: [
              { text: "Added from " },
              {
                type: "link",
                url: `/pages/${pageToAdd.id}`,
                children: [{ text: pageToAdd.title || "Untitled" }]
              },
              { text: ` by ${pageToAdd.username || "Anonymous"}` }
            ]
          });
          
          // Add the content from the source page
          targetContent = [...targetContent, ...sourceContent];
          
          // Update the page
          const updates = {};
          updates[`pages/${selectedPage.id}/content`] = JSON.stringify(targetContent);
          updates[`pages/${selectedPage.id}/lastModified`] = Date.now();
          
          const dbRef = ref(db);
          update(dbRef, updates)
            .then(() => {
              toast({
                title: "Success",
                description: `Content added to "${selectedPage.title || 'Untitled'}"`,
              });
              onClose();
            })
            .catch((error) => {
              console.error("Error updating page:", error);
              toast({
                title: "Error",
                description: "Failed to add content to page",
                variant: "destructive"
              });
            });
        }, { onlyOnce: true });
      } catch (error) {
        console.error("Error in handleAddToPage:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        });
      }
    };
    
    return (
      <>
        <div className="py-4">
          <Command className="rounded-lg border shadow-md">
            <CommandInput 
              placeholder="Search pages..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No pages found</CommandEmpty>
              
              {/* All Pages */}
              <CommandGroup heading="Your Pages">
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Loading pages...</span>
                  </div>
                ) : (
                  filteredPages.map(page => (
                    <CommandItem
                      key={page.id}
                      value={page.id}
                      onSelect={() => setSelectedPage(page)}
                      className={`flex items-center justify-between ${selectedPage?.id === page.id ? 'bg-accent' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span>{page.title || 'Untitled'}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(page.lastModified || 0).toLocaleDateString()}
                        </span>
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleAddToPage} 
            disabled={!selectedPage || loading}
          >
            Add to Page
          </Button>
        </DialogFooter>
      </>
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
