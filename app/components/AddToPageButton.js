"use client";

import React, { useState, useContext } from 'react';
import { Button } from './ui/button';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from './ui/dialog';
import TypeaheadSearch from './TypeaheadSearch';
import { AuthContext } from '../providers/AuthProvider';
import { appendPageReference } from '../firebase/database';
import { toast } from './ui/use-toast';
import { useRouter } from 'next/navigation';

const AddToPageButton = ({
  page,
  className = "",
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  hideButton = false
}) => {
  // Use external state if provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const { user } = useContext(AuthContext);
  const router = useRouter();

  // Determine which state to use
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const handleAddToPage = async (selected) => {
    if (!selected || !page) return;

    // Store the selected page for the Insert button
    setSelectedPage(selected);
  };

  const handleInsert = async () => {
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
        setSelectedPage(null);

        // Redirect to the target page (will load in view mode with click-to-edit functionality)
        router.push(`/${selectedPage.id}`);
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

  const handleClose = () => {
    setIsOpen(false);
    setSelectedPage(null);
  };

  if (!user || !page) return null;

  // Always show the button, even for the page owner

  return (
    <>
      {!hideButton && (
        <Button
          variant="default"
          size="lg"
          className={`gap-2 w-full md:w-auto rounded-2xl font-medium ${className}`}
          onClick={() => setIsOpen(true)}
          disabled={isAdding}
        >
          {isAdding ? (
            <>
              <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
              <span>Adding...</span>
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              <span>Add to Page</span>
            </>
          )}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-lg border border-border dark:border-neutral-700 bg-white dark:bg-neutral-900 animate-in fade-in-0 zoom-in-95 duration-300 px-6 py-6">
          <DialogClose asChild>
            <Button variant="outline" size="icon" className="absolute right-4 top-4">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>Add to Page</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
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

          <DialogFooter className="mt-4 pt-4 border-t border-border dark:border-neutral-700">
            <Button
              onClick={handleInsert}
              disabled={!selectedPage || isAdding}
              className="w-full sm:w-auto rounded-2xl font-medium"
              size="lg"
            >
              {isAdding ? (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                  <span>Adding...</span>
                </>
              ) : (
                'Insert Link'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddToPageButton;
