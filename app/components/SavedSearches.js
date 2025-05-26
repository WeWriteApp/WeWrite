"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Pin, X, Trash2 } from 'lucide-react';
import { getSavedSearches, clearSavedSearches, deleteSavedSearch } from '../utils/savedSearches';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { ConfirmationModal } from './ConfirmationModal';

/**
 * SavedSearches Component
 *
 * Displays a list of saved searches with the ability to delete them or select one
 *
 * @param {Object} props
 * @param {Function} props.onSelect - Function to call when a search is selected
 * @param {string} props.userId - User ID for personalized saved searches
 */
const SavedSearches = React.memo(function SavedSearches({ onSelect, userId = null }) {
  const [savedSearches, setSavedSearches] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [deleteSearchTerm, setDeleteSearchTerm] = useState('');
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Function to load saved searches
  const loadSavedSearches = () => {
    const searches = getSavedSearches(userId);
    setSavedSearches(searches);
  };

  // Load saved searches on mount and when updated
  useEffect(() => {
    // Load saved searches initially
    loadSavedSearches();

    // Listen for updates to saved searches
    const handleSavedSearchesUpdated = () => {
      loadSavedSearches();
    };

    // Add event listener
    window.addEventListener('savedSearchesUpdated', handleSavedSearchesUpdated);

    // Clean up event listener
    return () => {
      window.removeEventListener('savedSearchesUpdated', handleSavedSearchesUpdated);
    };
  }, [userId]);

  // Handle clearing all saved searches
  const handleClearAll = () => {
    setShowClearAllModal(true);
  };

  // Confirm clearing all saved searches
  const confirmClearAll = () => {
    clearSavedSearches(userId);
    setSavedSearches([]);
    setShowClearAllModal(false);
  };

  // Handle deleting a specific saved search
  const handleDeleteClick = (index, term) => {
    setDeleteIndex(index);
    setDeleteSearchTerm(term);
    setShowDeleteDialog(true);
  };

  // Confirm deletion of a saved search
  const confirmDelete = () => {
    if (deleteIndex !== null) {
      deleteSavedSearch(deleteIndex, userId);
      setSavedSearches(prevSearches =>
        prevSearches.filter((_, i) => i !== deleteIndex)
      );
      setShowDeleteDialog(false);
      setDeleteIndex(null);
    }
  };

  // If there are no saved searches, render an empty container with the same height
  if (!savedSearches.length) {
    return (
      <div className="mt-6 mb-8 min-h-[60px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center">
            <Pin className="h-4 w-4 mr-2" />
            Saved Searches
          </h3>
        </div>
        <div className="text-sm text-muted-foreground">
          Save searches by clicking the pin icon in the search bar
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-8 min-h-[60px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center">
          <Pin className="h-4 w-4 mr-2" />
          Saved Searches
        </h3>
        {savedSearches.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {savedSearches.map((search, index) => (
          <div
            key={`${search.term}-${index}`}
            className="flex items-center bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full text-sm transition-all hover:shadow-sm cursor-pointer group"
          >
            <span
              className="mr-1"
              onClick={() => onSelect(search.term)}
            >
              {search.term}
            </span>
            <X
              className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer opacity-70 group-hover:opacity-100"
              onClick={() => handleDeleteClick(index, search.term)}
            />
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Saved Search</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this saved search?
              <div className="mt-2 p-2 bg-muted rounded-md text-center font-medium">
                "{deleteSearchTerm}"
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={confirmClearAll}
        title="Delete All Saved Searches"
        message={`Are you sure you want to delete ${savedSearches.length} saved searches? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        variant="destructive"
        icon="delete"
      />
    </div>
  );
});

SavedSearches.displayName = 'SavedSearches';

export default SavedSearches;
