"use client";

import React from "react";
import { Button } from "./ui/button";
import { Link2, Reply, Edit, Trash2, LayoutPanelLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deletePage } from "../firebase/database";

interface PageActionsProps {
  page: {
    id: string;
    title?: string;
    content?: any;
    userId?: string;
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

  const handleCopyLink = () => {
    const pageUrl = `${window.location.origin}/pages/${page.id}`;
    navigator.clipboard.writeText(pageUrl).then(() => {
      toast.success("Link copied to clipboard", {
        description: "Share this link with others to view this page",
        duration: 3000,
      });
    }).catch(err => {
      console.error('Failed to copy link:', err);
      toast.error("Failed to copy link", {
        description: "Please try again",
      });
    });
  };

  const handleReplyToPage = () => {
    if (!page || !page.id) {
      console.error("Cannot reply to page: page data is missing");
      return;
    }

    // Create a new page with title "Re: "[original page title]""
    const newPageTitle = `Re: "${page.title || "Untitled"}"`;
    
    // Navigate to new page creation with reference to original
    router.push(`/new?reply=${page.id}&title=${encodeURIComponent(newPageTitle)}`);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this page?")) {
      return;
    }
    
    try {
      const result = await deletePage(page.id);
      if (result) {
        toast.success("Page deleted successfully");
        router.push("/");
      } else {
        toast.error("Failed to delete page");
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      toast.error("Error deleting page");
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Owner-only actions */}
      {isOwner && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing && setIsEditing(!isEditing)}
            className="flex items-center gap-1.5"
          >
            <Edit className="h-4 w-4" />
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="flex items-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}
      
      {/* Actions available to all users */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5"
        >
          <Link2 className="h-4 w-4" />
          Copy Link
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReplyToPage}
          className="flex items-center gap-1.5"
        >
          <Reply className="h-4 w-4" />
          Reply to Page
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          asChild
          className="flex items-center gap-1.5"
        >
          <Link href={`/pages/${page.id}/add`}>
            <Plus className="h-4 w-4" />
            Add to Page
          </Link>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Toggle layout mode in localStorage
            const currentMode = localStorage.getItem("pageLayoutMode") || "default";
            const newMode = currentMode === "default" ? "compact" : "default";
            localStorage.setItem("pageLayoutMode", newMode);
            
            // Refresh the page to apply the new layout
            window.location.reload();
          }}
          className="flex items-center gap-1.5"
        >
          <LayoutPanelLeft className="h-4 w-4" />
          Page Layout
        </Button>
      </div>
    </div>
  );
}

// Missing Plus icon import
import { Plus } from "lucide-react";
