"use client";

import React, { useState, useContext } from 'react';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import TypeaheadSearch from './TypeaheadSearch';
import { AuthContext } from '../providers/AuthProvider';
import { appendPageReference } from '../firebase/database';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const AddToPageButton = ({ page, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const handleAddToPage = async (selectedPage) => {
    if (!selectedPage || !page) return;

    setIsAdding(true);

    try {
      // Create a source page data object with the current page info
      const sourcePageData = {
        id: page.id,
        title: page.title || 'Untitled Page',
        userId: page.userId // Include the user ID for notification
      };

      // Append the current page reference to the selected page
      const result = await appendPageReference(selectedPage.id, sourcePageData, user.uid);

      if (result) {
        toast.success(`Added to "${selectedPage.title}"`);
        setIsOpen(false);

        // Redirect to the edit state of the target page
        router.push(`/${selectedPage.id}?edit=true`);
      } else {
        toast.error("Failed to add page. Please try again.");
      }
    } catch (error) {
      console.error("Error adding page:", error);
      toast.error(error.message || "An error occurred. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  if (!user || !page) return null;

  // Always show the button, even for the page owner

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 w-full h-10 md:h-8 md:w-auto ${className}`}
        onClick={() => setIsOpen(true)}
        disabled={isAdding}
      >
        {isAdding ? (
          <>
            <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
            <span className="text-sm">Adding...</span>
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add to Page</span>
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Page</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a page to add "{page?.title || 'this page'}" to:
            </p>
            <TypeaheadSearch
              placeholder="Search your pages..."
              editableOnly={true}
              onSelect={handleAddToPage}
              setShowResults={() => {}}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddToPageButton;
