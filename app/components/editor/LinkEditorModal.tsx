"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Link, ExternalLink, Users, FileText } from 'lucide-react';
import FilteredSearchResults from '../search/FilteredSearchResults';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface LinkEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertLink: (linkData: any) => void;
  editingLink?: {
    element: HTMLElement;
    type: 'page' | 'user' | 'external' | 'compound';
    data: any;
  } | null;
  selectedText?: string;
  linkedPageIds?: string[];
}

export default function LinkEditorModal({
  isOpen,
  onClose,
  onInsertLink,
  editingLink = null,
  selectedText = '',
  linkedPageIds = []
}: LinkEditorModalProps) {
  console.log('🔗 LINK_MODAL: Component rendered with props:', {
    isOpen,
    selectedText,
    hasOnClose: !!onClose,
    hasOnInsertLink: !!onInsertLink
  });
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pages');
  const [externalUrl, setExternalUrl] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [customText, setCustomText] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const externalUrlInputRef = useRef<HTMLInputElement>(null);

  // Determine if we're editing an existing link
  const isEditing = !!editingLink;
  const modalTitle = isEditing ? 'Edit Link' : 'Insert Link';
  const buttonText = isEditing ? 'Update Link' : 'Create Link';

  // Reset state when modal opens/closes
  useEffect(() => {
    console.log('🔗 LINK_MODAL: useEffect triggered, isOpen:', isOpen);
    if (isOpen) {
      console.log('🔗 LINK_MODAL: Modal is opening, selectedText:', selectedText);
      if (editingLink) {
        // Pre-populate fields when editing
        const { type, data } = editingLink;
        
        if (type === 'external') {
          setActiveTab('external');
          setExternalUrl(data.url || '');
          setDisplayText(data.text || '');
        } else if (type === 'page' || type === 'user') {
          setActiveTab('pages');
          setSelectedPage(data);
          setDisplayText(data.text || '');
          setCustomText(!!data.text);
        } else if (type === 'compound') {
          setActiveTab('pages');
          setSelectedPage(data);
          setDisplayText(data.text || '');
          setShowAuthor(true);
          setCustomText(!!data.text);
        }
      } else {
        // Reset for new link
        setActiveTab('pages');
        setExternalUrl('');
        setDisplayText(selectedText || '');
        setShowAuthor(false);
        setCustomText(!!selectedText);
        setSelectedPage(null);
      }
    }
  }, [isOpen, editingLink, selectedText]);

  // Focus the external URL input when external tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'external') {
      // Small delay to ensure the tab content is rendered
      const timer = setTimeout(() => {
        if (externalUrlInputRef.current) {
          externalUrlInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Handle tab change with proper focus management
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);

    // Reset selections when switching tabs
    setSelectedPage(null);
    setExternalUrl('');
    setDisplayText('');

    // Focus appropriate input when tab changes
    if (newTab === 'external') {
      setTimeout(() => {
        if (externalUrlInputRef.current) {
          externalUrlInputRef.current.focus();
        }
      }, 100);
    } else if (newTab === 'pages') {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  };

  // Handle page selection from search results
  const handlePageSelect = (page: any) => {
    setSelectedPage(page);
    
    // If custom text is not enabled, use the page title as display text
    if (!customText) {
      setDisplayText(page.title || '');
    }
  };

  // Handle external link creation
  const handleCreateExternalLink = () => {
    if (!externalUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    const linkData = {
      type: 'external',
      url: externalUrl.trim(),
      text: displayText.trim() || externalUrl.trim(),
      isEditing,
      element: editingLink?.element
    };

    onInsertLink(linkData);
    onClose();
  };

  // Handle page link creation
  const handleCreatePageLink = () => {
    if (!selectedPage) {
      toast.error('Please select a page');
      return;
    }

    console.log('handleCreatePageLink called');
    console.log('onInsertLink type:', typeof onInsertLink);
    console.log('onInsertLink:', onInsertLink);

    const linkData = {
      type: showAuthor ? 'compound' : 'page',
      pageId: selectedPage.id,
      pageTitle: selectedPage.title,
      text: customText ? displayText.trim() : '',
      showAuthor,
      authorUsername: selectedPage.username,
      isEditing,
      element: editingLink?.element,
      isNew: selectedPage.isNew // For creating new pages
    };

    if (typeof onInsertLink === 'function') {
      onInsertLink(linkData);
    } else {
      console.error('onInsertLink is not a function:', onInsertLink);
    }
    onClose();
  };



  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('🔗 LINK_MODAL: Dialog onOpenChange called with:', open);
      if (!open) {
        console.log('🔗 LINK_MODAL: Dialog wants to close, calling onClose');
        onClose();
      }
    }}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
        {/* Custom Link Text - Above tabs and persistent */}
        <div className="space-y-3">
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

          {customText && (
            <div className="space-y-2">
              <Input
                id="display-text"
                value={displayText}
                onChange={(e) => setDisplayText(e.target.value)}
                placeholder="Enter custom display text"
                className="w-full"
              />
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pages" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">WeWrite </span>Pages
            </TabsTrigger>
            <TabsTrigger value="external" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
              External<span className="hidden sm:inline"> Link</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="space-y-4">
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

            {/* Search Results */}
            <div className="h-48 sm:h-64">
              <FilteredSearchResults
                ref={searchInputRef}
                onSelect={handlePageSelect}
                userId={user?.uid}
                placeholder="Search for pages..."
                autoFocus={!selectedText}
                className="h-full p-2 sm:p-3"
                preventRedirect={true}
                linkedPageIds={linkedPageIds}
              />
            </div>
          </TabsContent>

          <TabsContent value="external" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="external-url">URL</Label>
              <Input
                ref={externalUrlInputRef}
                id="external-url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                onPaste={(e) => {
                  // Ensure paste events are handled properly in the modal
                  e.stopPropagation();
                }}
                placeholder="https://example.com"
                autoFocus={activeTab === 'external'}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={activeTab === 'external' ? handleCreateExternalLink : handleCreatePageLink}
            disabled={
              activeTab === 'external'
                ? !externalUrl.trim()
                : !selectedPage
            }
            className="w-full sm:w-auto"
          >
            <Link className="h-4 w-4 mr-2" />
            {buttonText}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
