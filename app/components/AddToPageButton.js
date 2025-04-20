"use client";

import React, { useState, useContext } from 'react';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import TypeaheadSearch from './TypeaheadSearch';
import { AuthContext } from '../providers/AuthProvider';
import { appendPageReference } from '../firebase/database';
import { toast } from 'sonner';
import { usePage } from '../contexts/PageContext';

const AddToPageButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useContext(AuthContext);
  const { page } = usePage();

  const handleAddToPage = async (selectedPage) => {
    if (!selectedPage || !page) return;

    setIsAdding(true);

    try {
      // Create a source page data object with the current page info
      const sourcePageData = {
        id: page.id,
        title: page.title || 'Untitled Page'
      };

      // Append the current page reference to the selected page
      const result = await appendPageReference(selectedPage.id, sourcePageData);

      if (result) {
        toast({
          title: "Page added successfully",
          description: `Added to "${selectedPage.title}"`,
        });
        setIsOpen(false);
      } else {
        toast({
          title: "Error adding page",
          description: "There was a problem adding this page. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding page:", error);
      toast({
        title: "Error adding page",
        description: error.message || "There was a problem adding this page. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (!user || !page) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 w-full h-10 md:h-8 md:w-auto"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add to Page
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
