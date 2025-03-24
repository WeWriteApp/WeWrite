"use client";

import React, { useState, useEffect, useContext } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Search, Plus, FileText, Lock, Globe } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import { rtdb } from "../firebase/rtdb";
import { ref, get, update } from "firebase/database";
import { getEditablePagesByUser } from "../firebase/database";
import { Badge } from "./ui/badge";
import { cn, interactiveCard } from "../lib/utils";

interface Page {
  id: string;
  title: string;
  isPublic: boolean;
  userId: string;
  authorName?: string;
  lastModified?: string;
  createdAt: string;
  groupId?: string;
  groupName?: string;
}

interface AddExistingPageDialogProps {
  groupId: string;
  trigger?: React.ReactNode;
  onPagesAdded?: () => void;
}

export default function AddExistingPageDialog({ 
  groupId, 
  trigger, 
  onPagesAdded 
}: AddExistingPageDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [filteredPages, setFilteredPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const { user } = useContext(AuthContext);
  
  // Fetch user's pages when dialog opens
  useEffect(() => {
    if (open && user) {
      setLoading(true);
      fetchUserPages();
    }
  }, [open, user]);
  
  // Filter pages when search term changes
  useEffect(() => {
    if (pages.length > 0) {
      const filtered = pages.filter(page => 
        page.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPages(filtered);
    }
  }, [searchTerm, pages]);
  
  const fetchUserPages = async () => {
    if (!user) return;
    
    try {
      // Get all pages the user can edit
      const userPagesData = await getEditablePagesByUser(user.uid);
      
      // Ensure proper typing for userPages
      const userPages: Page[] = userPagesData.map(page => ({
        id: page.id,
        title: page.title || 'Untitled',
        isPublic: page.isPublic || false,
        userId: page.userId || user.uid,
        authorName: page.authorName,
        lastModified: page.lastModified,
        createdAt: page.createdAt || new Date().toISOString(),
        groupId: page.groupId,
        groupName: page.groupName
      }));
      
      // Get current group pages to exclude
      const groupRef = ref(rtdb, `groups/${groupId}`);
      const groupSnapshot = await get(groupRef);
      
      if (groupSnapshot.exists()) {
        const groupData = groupSnapshot.val();
        const groupPageIds = groupData.pages ? Object.keys(groupData.pages) : [];
        
        // Filter out pages that are already in the group
        const availablePages = userPages.filter(page => !groupPageIds.includes(page.id));
        setPages(availablePages);
        setFilteredPages(availablePages);
      } else {
        setPages(userPages);
        setFilteredPages(userPages);
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const togglePageSelection = (pageId: string) => {
    setSelectedPages(prev => {
      if (prev.includes(pageId)) {
        return prev.filter(id => id !== pageId);
      } else {
        return [...prev, pageId];
      }
    });
  };
  
  const handleAddPages = async () => {
    if (selectedPages.length === 0) return;
    
    setAdding(true);
    try {
      // Get the group reference
      const groupRef = ref(rtdb, `groups/${groupId}/pages`);
      
      // Get current pages
      const groupPagesSnapshot = await get(groupRef);
      const currentPages = groupPagesSnapshot.exists() ? groupPagesSnapshot.val() : {};
      
      // Add selected pages
      const selectedPageObjects = pages.filter(page => selectedPages.includes(page.id));
      const updates: Record<string, any> = {};
      
      selectedPageObjects.forEach(page => {
        updates[page.id] = {
          id: page.id,
          title: page.title,
          isPublic: page.isPublic,
          userId: page.userId,
          lastModified: page.lastModified || page.createdAt,
          createdAt: page.createdAt,
          groupId: groupId
        };
      });
      
      // Update the group with new pages
      await update(groupRef, updates);
      
      // Close dialog and reset state
      setOpen(false);
      setSelectedPages([]);
      if (onPagesAdded) onPagesAdded();
    } catch (error) {
      console.error("Error adding pages to group:", error);
    } finally {
      setAdding(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Existing Page
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Existing Pages to Group</DialogTitle>
          <DialogDescription>
            Select pages you want to add to this group. Group members will be able to edit these pages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative my-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search your pages..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-md p-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading your pages...</p>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No pages found</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filteredPages.map(page => (
                <div 
                  key={page.id}
                  className={cn(
                    interactiveCard("flex items-center gap-3 cursor-pointer"),
                    selectedPages.includes(page.id) && "border-primary bg-primary/5"
                  )}
                  onClick={() => togglePageSelection(page.id)}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    "bg-primary/10 text-primary"
                  )}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium">{page.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {new Date(page.lastModified || page.createdAt).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {page.isPublic ? (
                          <>
                            <Globe className="h-3 w-3" />
                            <span>Public</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            <span>Private</span>
                          </>
                        )}
                      </Badge>
                      {page.groupName && (
                        <span className="text-xs">in {page.groupName}</span>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border border-primary flex items-center justify-center",
                    selectedPages.includes(page.id) ? "bg-primary" : "bg-transparent"
                  )}>
                    {selectedPages.includes(page.id) && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {selectedPages.length} {selectedPages.length === 1 ? 'page' : 'pages'} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddPages} 
              disabled={selectedPages.length === 0 || adding}
            >
              {adding ? 'Adding...' : 'Add to Group'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
