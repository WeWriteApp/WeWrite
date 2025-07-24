"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Link, ExternalLink, Users, FileText } from 'lucide-react';
import FilteredSearchResults from '../search/FilteredSearchResults';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/use-toast';

interface LinkEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertLink: (linkData: any) => void;
  editingLink?: {
    element: HTMLElement;
    type: 'page' | 'user' | 'external' | 'compound';
    data: any;
  } | null;
}

export default function LinkEditorModal({
  isOpen,
  onClose,
  onInsertLink,
  editingLink = null
}: LinkEditorModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pages');
  const [externalUrl, setExternalUrl] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [customText, setCustomText] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Determine if we're editing an existing link
  const isEditing = !!editingLink;
  const modalTitle = isEditing ? 'Edit Link' : 'Insert Link';
  const buttonText = isEditing ? 'Update Link' : 'Create Link';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
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
        setDisplayText('');
        setShowAuthor(false);
        setCustomText(false);
        setSelectedPage(null);
      }
    }
  }, [isOpen, editingLink]);

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

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Reset selections when switching tabs
    setSelectedPage(null);
    setExternalUrl('');
    setDisplayText('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              WeWrite Pages
            </TabsTrigger>
            <TabsTrigger value="external" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              External Link
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
                  placeholder="Enter custom display text"
                />
              </div>
            )}

            {/* Search Results */}
            <div className="h-64">
              <FilteredSearchResults
                ref={searchInputRef}
                onSelect={handlePageSelect}
                userId={user?.uid}
                placeholder="Search for pages..."
                autoFocus={true}
                className="h-full p-3"
                preventRedirect={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="external" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="external-url">URL</Label>
              <Input
                id="external-url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus={activeTab === 'external'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-display-text">Display text (optional)</Label>
              <Input
                id="external-display-text"
                value={displayText}
                onChange={(e) => setDisplayText(e.target.value)}
                placeholder="Link text"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={activeTab === 'external' ? handleCreateExternalLink : handleCreatePageLink}
            disabled={
              activeTab === 'external'
                ? !externalUrl.trim()
                : !selectedPage
            }
          >
            <Link className="h-4 w-4 mr-2" />
            {buttonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
