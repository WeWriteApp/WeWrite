"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../ui/segmented-control';
import { Link, ExternalLink, Users, FileText, X } from 'lucide-react';
import FilteredSearchResults from '../search/FilteredSearchResults';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../ui/drawer';
import logger from '../../utils/logger';
import { ANIMATION_DURATIONS, MODAL_CONFIG, UI_TEXT, TABS, LINK_TYPES } from './constants';

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
  currentPageId?: string;
}

export default function LinkEditorModal({
  isOpen,
  onClose,
  onInsertLink,
  editingLink = null,
  selectedText = '',
  linkedPageIds = [],
  currentPageId
}: LinkEditorModalProps) {

  const { user } = useAuth();
  const isEditing = !!editingLink; // Derive isEditing from editingLink existence
  const [activeTab, setActiveTab] = useState(TABS.PAGES);
  const [externalUrl, setExternalUrl] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [customText, setCustomText] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const externalUrlInputRef = useRef<HTMLInputElement>(null);
  const customTextInputRef = useRef<HTMLInputElement>(null);
  const externalCustomTextInputRef = useRef<HTMLInputElement>(null);

  // Modal title based on editing state
  const modalTitle = isEditing ? UI_TEXT.MODAL_TITLES.EDIT_LINK : UI_TEXT.MODAL_TITLES.CREATE_LINK;
  const buttonText = isEditing ? 'Update Link' : 'Create Link';

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileSize = window.innerWidth < MODAL_CONFIG.MOBILE_BREAKPOINT;
      setIsMobile(isMobileSize);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize modal state when it opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingLink) {
      // EDITING MODE: Pre-populate fields from existing link
      const { type, data } = editingLink;
      console.log('🔥 EDITING LINK DATA:', { type, data });

      if (type === 'external') {
        setActiveTab('external');
        setExternalUrl(data.url || '');
        setDisplayText(data.currentDisplayText || data.text || data.url || '');
        setCustomText(!!data.text);
      } else {
        // Page, user, or compound link
        setActiveTab('pages');
        setSelectedPage(data);
        setDisplayText(data.currentDisplayText || data.text || data.title || '');
        setCustomText(!!data.text);
        setShowAuthor(type === 'compound');
      }
    } else {
      // NEW LINK MODE: Reset to defaults
      setActiveTab('pages');
      setExternalUrl('');
      setDisplayText(selectedText || '');
      setShowAuthor(false);
      setCustomText(false);
      setSelectedPage(null);
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
      }, ANIMATION_DURATIONS.FOCUS_DELAY);
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

  // Handle custom text toggle change
  const handleCustomTextToggle = (enabled: boolean) => {
    setCustomText(enabled);

    if (enabled) {
      // When enabling custom text, pre-fill with appropriate default text
      if (!displayText) {
        const defaultText = getDefaultDisplayText();
        if (defaultText) {
          setDisplayText(defaultText);
        }
      }

      // Focus and select the custom text input after animation completes
      setTimeout(() => {
        const inputRef = activeTab === 'external' ? externalCustomTextInputRef : customTextInputRef;
        if (inputRef.current) {
          // Blur any currently focused element first
          if (document.activeElement && document.activeElement !== inputRef.current) {
            (document.activeElement as HTMLElement).blur();
          }
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 350); // Wait for animation to complete (300ms + 50ms buffer)
    } else {
      // When disabling custom text, clear the display text to revert to auto-generated
      setDisplayText('');
    }
  };

  // Helper function to get default display text based on current context
  const getDefaultDisplayText = () => {
    if (activeTab === 'external') {
      return externalUrl || '';
    } else if (selectedPage) {
      return selectedPage.title || '';
    } else if (editingLink) {
      if (editingLink.type === 'external') {
        return editingLink.data.url || '';
      } else if (editingLink.type === 'page' || editingLink.type === 'compound') {
        return editingLink.data.title || '';
      }
    }
    return '';
  };

  // Helper function to create consistent link data
  const createLinkData = (page: any, customDisplayText?: string) => {
    const linkData = {
      type: showAuthor ? 'compound' : 'page',
      pageId: page.id,
      pageTitle: page.title,
      originalPageTitle: page.title,
      text: customDisplayText || '', // Empty string means revert to auto-generated
      showAuthor,
      authorUsername: page.username,
      authorUserId: page.userId,
      // Include subscription data if available
      authorTier: page.tier,
      authorSubscriptionStatus: page.subscriptionStatus,
      authorSubscriptionAmount: page.subscriptionAmount,
      isEditing,
      element: editingLink?.element,
      isNew: page.isNew,
      url: `/${page.id}` // Add URL for consistency
    };

    return linkData;
  };

  // Handle page selection from search results
  const handlePageSelect = (page: any) => {
    setSelectedPage(page);

    // If custom text and show author are both disabled, create the link immediately
    if (!customText && !showAuthor) {
      setDisplayText(page.title || '');
      const linkData = createLinkData(page);

      if (typeof onInsertLink === 'function') {
        onInsertLink(linkData);
      }
      // Small delay to ensure Slate operations complete before modal closes
      setTimeout(() => {
        onClose();
      }, 50);
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
      text: customText ? displayText.trim() : '',
      isEditing,
      element: editingLink?.element
    };

    onInsertLink(linkData);
    // Small delay to ensure Slate operations complete before modal closes
    setTimeout(() => {
      onClose();
    }, 50);
  };

  // Handle page link creation
  const handleCreatePageLink = () => {
    if (!selectedPage) {
      toast.error('Please select a page');
      return;
    }

    const customDisplayText = customText ? displayText.trim() : '';
    const linkData = createLinkData(selectedPage, customDisplayText);

    onInsertLink(linkData);
    // Small delay to ensure Slate operations complete before modal closes
    setTimeout(() => {
      onClose();
    }, 50);
  };

  // Shared content component for both Dialog and Sheet
  const ModalContent = () => (
    <>
      {/* Link Type Selection - Fixed at top */}
      <div className="flex-shrink-0 mb-4">
        <SegmentedControl value={activeTab} onValueChange={handleTabChange} className="w-full min-w-0">
          <SegmentedControlList className="grid w-full grid-cols-2 min-w-0">
            <SegmentedControlTrigger value="pages" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">WeWrite </span>Pages
            </SegmentedControlTrigger>
            <SegmentedControlTrigger value="external" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
              External<span className="hidden sm:inline"> Link</span>
            </SegmentedControlTrigger>
          </SegmentedControlList>
        </SegmentedControl>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SegmentedControl value={activeTab} onValueChange={handleTabChange} className="h-full">
        <SegmentedControlContent value="pages" className="h-full flex flex-col transition-all duration-200 ease-out">
          {/* Link Options - Always visible horizontal row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="custom-text-settings" className="text-sm font-medium">
                  Custom link text
                </label>
                <Switch
                  id="custom-text-settings"
                  checked={customText}
                  onCheckedChange={handleCustomTextToggle}
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="show-author-settings" className="text-sm font-medium">
                  Show author
                </label>
                <Switch
                  id="show-author-settings"
                  checked={showAuthor}
                  onCheckedChange={setShowAuthor}
                />
              </div>
            </div>
          </div>

          {/* Custom Text Input - Show when enabled with smooth animation */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            customText ? 'max-h-20 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
          }`}>
            <div className="flex-shrink-0">
              <Input
                ref={customTextInputRef}
                id="display-text"
                value={displayText}
                onChange={(e) => setDisplayText(e.target.value)}
                placeholder="Enter custom display text"
                className="w-full min-w-0"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Search Results - scrollable area */}
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <FilteredSearchResults
              ref={searchInputRef}
              onSelect={handlePageSelect}
              userId={user?.uid}
              placeholder="Search for pages..."
              initialSearch={
                // When editing, pre-fill with current page title for easy replacement
                editingLink && (editingLink.type === 'page' || editingLink.type === 'compound')
                  ? editingLink.data.title || selectedText
                  : selectedText
              }
              autoFocus={!selectedText && !editingLink}
              className="h-full"
              preventRedirect={true}
              linkedPageIds={linkedPageIds}
              currentPageId={currentPageId}
              hideCreateButton={isEditing}
              onFilterToggle={(showFilters) => {
                // Filter toggle is handled internally by FilteredSearchResults
                // We just need to pass a callback to enable the filter button
                return true;
              }}
            />
          </div>

          {/* Action Button - Show when custom text is enabled, show author is enabled, or when editing */}
          {(customText || showAuthor || isEditing) && (
            <div className="flex-shrink-0 mt-3">
              <Button
                onClick={() => handleCreatePageLink()}
                disabled={!selectedPage}
                className="w-full"
              >
                <Link className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Link' : 'Save'}
              </Button>
            </div>
          )}

          {!customText && !showAuthor && !isEditing && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Click on a page to create link immediately
            </p>
          )}
        </SegmentedControlContent>

        <SegmentedControlContent value="external" className="h-full flex flex-col space-y-4 transition-all duration-200 ease-out">
          <div className="space-y-2">
            <Label htmlFor="external-url">URL</Label>
            <Input
              ref={externalUrlInputRef}
              id="external-url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && externalUrl.trim() && !customText) {
                  e.preventDefault();
                  handleCreateExternalLink();
                }
              }}
              onPaste={(e) => {
                // Ensure paste events are handled properly in the modal
                e.stopPropagation();
              }}
              placeholder="https://example.com"
              className="w-full"
              autoComplete="off"
            />
          </div>

          {/* Custom Text Input - Show when enabled with smooth animation */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            customText ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="space-y-2">
              <Input
                ref={externalCustomTextInputRef}
                id="display-text-external"
                value={displayText}
                onChange={(e) => setDisplayText(e.target.value)}
                placeholder="Enter custom display text"
                className="w-full min-w-0"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Spacer to push button to bottom */}
          <div className="flex-1"></div>

          {/* Action Button - Always show for external links */}
          <div className="flex-shrink-0">
            <Button
              onClick={handleCreateExternalLink}
              disabled={!externalUrl.trim()}
              className="w-full"
            >
              <Link className="h-4 w-4 mr-2" />
              {isEditing ? 'Update Link' : 'Save'}
            </Button>
          </div>

          {!customText && externalUrl.trim() && (
            <p className="text-xs text-muted-foreground text-center">
              Press Enter to create link
            </p>
          )}
        </SegmentedControlContent>
        </SegmentedControl>
      </div>


    </>
  );

  // Responsive modal: Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
        <DrawerContent height="85vh" className="border-t-2 border-border">
          <DrawerHeader>
            <DrawerTitle>{modalTitle}</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
            <ModalContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden p-4 sm:p-6 transition-all duration-200 ease-out flex flex-col">
        <DialogHeader className="relative flex-shrink-0">
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogClose className="absolute right-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <ModalContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
