"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { FileText, Sparkles } from 'lucide-react';
import FilteredSearchResults from '../search/FilteredSearchResults';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/use-toast';
import { LinkSuggestion } from '../../services/linkSuggestionService';

interface LinkSuggestionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertLink: (linkData: any) => void;
  suggestion: LinkSuggestion | null;
  matchedText: string;
}

export default function LinkSuggestionEditorModal({
  isOpen,
  onClose,
  onInsertLink,
  suggestion,
  matchedText
}: LinkSuggestionEditorModalProps) {
  const { user } = useAuth();
  const [showAuthor, setShowAuthor] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [customText, setCustomText] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pre-populate search with the suggestion's title
  const initialSearchTerm = suggestion?.title || '';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && suggestion) {
      setShowAuthor(false);
      setCustomText(false);
      setDisplayText('');
      setSelectedPage(null);
      
      // Auto-select the suggested page if it matches
      if (suggestion.id && suggestion.title) {
        setSelectedPage({
          id: suggestion.id,
          title: suggestion.title,
          username: suggestion.username || 'Unknown'
        });
      }
    }
  }, [isOpen, suggestion]);

  // Handle page selection from search results
  const handlePageSelect = (page: any) => {
    console.log('LinkSuggestionEditorModal: Page selected:', page);
    setSelectedPage(page);
  };

  // Handle link creation
  const handleCreateLink = () => {
    if (!selectedPage) {
      toast.error('Please select a page');
      return;
    }

    console.log('LinkSuggestionEditorModal: Creating link');

    const linkData = {
      type: showAuthor ? 'compound' : 'page',
      pageId: selectedPage.id,
      pageTitle: selectedPage.title,
      text: customText ? displayText.trim() : matchedText, // Use matched text as default
      showAuthor,
      authorUsername: selectedPage.username,
      isEditing: false,
      element: null,
      isNew: selectedPage.isNew,
      replaceSuggestion: true, // Flag to indicate this replaces a suggestion
      matchedText: matchedText // Original text that was matched
    };

    if (typeof onInsertLink === 'function') {
      onInsertLink(linkData);
    } else {
      console.error('onInsertLink is not a function:', onInsertLink);
    }
    onClose();
  };

  // Handle modal close
  const handleClose = () => {
    setSelectedPage(null);
    setDisplayText('');
    setCustomText(false);
    setShowAuthor(false);
    onClose();
  };

  if (!suggestion) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Link Suggestion"
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        {/* Suggestion Info */}
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">
              Replace "<span className="font-medium text-foreground">{matchedText}</span>" with a link to:
            </p>
            <p className="text-sm font-medium text-primary truncate">
              {suggestion.title}
            </p>
          </div>
        </div>

        {/* Show Author Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="show-author" className="text-sm font-medium">
            Show author
          </Label>
          <Switch
            id="show-author"
            checked={showAuthor}
            onCheckedChange={setShowAuthor}
          />
        </div>

        {/* Custom Text Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="custom-text" className="text-sm font-medium">
            Custom link text
          </Label>
          <Switch
            id="custom-text"
            checked={customText}
            onCheckedChange={setCustomText}
          />
        </div>

        {/* Custom Text Input */}
        {customText && (
          <div className="space-y-2">
            <Label htmlFor="display-text">Display text</Label>
            <Input
              id="display-text"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder={`Default: "${matchedText}"`}
            />
          </div>
        )}

        {/* Search Results */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Select page to link to
          </Label>
          <div className="h-64">
            <FilteredSearchResults
              ref={searchInputRef}
              onSelect={handlePageSelect}
              userId={user?.uid}
              placeholder="Search for pages..."
              initialSearch={initialSearchTerm}
              autoFocus={true}
              className="h-full p-3"
              preventRedirect={true}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateLink}
            disabled={!selectedPage}
            className="bg-primary hover:bg-primary/90"
          >
            Create Link
          </Button>
        </div>
      </div>
    </Modal>
  );
}
