"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SegmentedControl, SegmentedControlList, SegmentedControlTrigger, SegmentedControlContent } from '../ui/segmented-control';
import FilteredSearchResults from '../search/FilteredSearchResults';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '../ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '../ui/drawer';
import logger from '../../utils/logger';
import { ANIMATION_DURATIONS, MODAL_CONFIG, UI_TEXT, TABS, LINK_TYPES } from './constants';
import PillLink from '../utils/PillLink';
import { UsernameBadge } from '../ui/UsernameBadge';

// Helper function to detect if a string is a URL
const isUrl = (str: string): boolean => {
  if (!str) return false;
  const trimmed = str.trim();
  // Check for common URL patterns
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('www.') ||
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/.test(trimmed)
  );
};

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
  const [externalCustomText, setExternalCustomText] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [customText, setCustomText] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const externalUrlInputRef = useRef<HTMLInputElement>(null);
  const customTextInputRef = useRef<HTMLInputElement>(null);
  const externalCustomTextInputRef = useRef<HTMLInputElement>(null);

  // REMOVED: Focus lock mechanism that was interfering with input behavior
  // const [focusLocked, setFocusLocked] = useState(false);

  // Modal title based on editing state and link type
  const modalTitle = isEditing
    ? `Edit ${editingLink?.type === 'external' ? 'External' : 'Internal'} Link`
    : UI_TEXT.MODAL_TITLES.CREATE_LINK;
  const buttonText = isEditing ? 'Update Link' : 'Insert Link';

  // Mobile detection (optimized to prevent unnecessary re-renders)
  useEffect(() => {
    const checkMobile = () => {
      const isMobileSize = window.innerWidth < MODAL_CONFIG.MOBILE_BREAKPOINT;
      setIsMobile(prev => prev !== isMobileSize ? isMobileSize : prev); // Only update if changed
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize modal state when it opens
  // CRITICAL FIX: Move initialization to useEffect to prevent constant re-renders
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize state when modal opens - FIXED: Remove selectedText from dependencies to prevent re-initialization during typing
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      if (editingLink) {
        // EDITING MODE: Pre-populate fields from existing link
        const { type, data } = editingLink;
        console.log('🔥 EDITING LINK DATA:', { type, data });

        // Normalize custom-text flags across legacy fields
        const inferredCustomTextFlag =
          data?.isCustomText === true ||
          data?.hasCustomText === true ||
          (typeof data?.customText === 'string' && data.customText.trim().length > 0) ||
          (typeof data?.text === 'string' && data.text.trim().length > 0);

        // Prefer explicit customText, then text (fallback), otherwise empty
        const resolvedCustomText =
          typeof data?.customText === 'string' && data.customText.trim().length > 0
            ? data.customText
            : typeof data?.text === 'string'
              ? data.text
              : '';

        if (type === 'external') {
          setActiveTab('external');
          setExternalUrl(data.url || '');

          // Initialize external link with canonical LinkNode structure
          const isCustomTextLink = inferredCustomTextFlag;
          const customTextValue = isCustomTextLink ? resolvedCustomText : '';

          console.log('🔧 [MODAL INIT] External link initialization:', {
            isCustomTextLink,
            customTextValue,
            dataCustomText: data.customText,
            dataIsCustomText: data.isCustomText
          });

          // For external links, displayText is not used for the custom text input
          // externalCustomText is used instead
          setDisplayText(''); // Not used for external links
          setExternalCustomText(customTextValue);
          setCustomText(isCustomTextLink);

          // Additional debugging to verify state is set correctly
          console.log('🔧 [MODAL INIT] External states being set:', {
            displayText: '',
            externalCustomText: customTextValue,
            customText: isCustomTextLink
          });
        } else {
          // Page, user, or compound link
          setActiveTab('pages');
          setSelectedPage(data);

          // Initialize internal link with canonical LinkNode structure
          const isCustomTextLink = inferredCustomTextFlag;
          const customTextValue = isCustomTextLink ? resolvedCustomText : '';

          console.log('🔧 [MODAL INIT] Internal link initialization:', {
            isCustomTextLink,
            customTextValue,
            dataCustomText: data.customText,
            dataIsCustomText: data.isCustomText,
            pageTitle: data.pageTitle || data.title,
            pageId: data.pageId
          });

          // CRITICAL FIX: Set states in the correct order and ensure they're applied
          setDisplayText(customTextValue);
          setCustomText(isCustomTextLink);
          setShowAuthor(type === 'compound');

          // Additional debugging to verify state is set correctly
          console.log('🔧 [MODAL INIT] States being set:', {
            displayText: customTextValue,
            customText: isCustomTextLink,
            showAuthor: type === 'compound'
          });
        }
      } else {
        // NEW LINK MODE: Reset to defaults only when first opening
        setActiveTab('pages');
        setExternalUrl('');
        setExternalCustomText('');
        setShowAuthor(false);
        setCustomText(false);
        setSelectedPage(null);
        setDisplayText(selectedText || '');
      }

      setHasInitialized(true);
    }
  }, [isOpen, hasInitialized, editingLink]); // CRITICAL FIX: Removed selectedText from dependencies

  // Reset initialization flag when modal closes
  useEffect(() => {
    if (!isOpen && hasInitialized) {
      setHasInitialized(false);
    }
  }, [isOpen, hasInitialized]);

  // Auto-focus the primary input when opening
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (activeTab === 'external' && externalUrlInputRef.current) {
        externalUrlInputRef.current.focus();
      } else if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, activeTab]);

  // Focus the external URL input when external tab is selected (DISABLED to prevent focus stealing)
  // useEffect(() => {
  //   if (isOpen && activeTab === 'external') {
  //     // Small delay to ensure the tab content is rendered
  //     const timer = setTimeout(() => {
  //       if (externalUrlInputRef.current) {
  //         externalUrlInputRef.current.focus();
  //       }
  //     }, ANIMATION_DURATIONS.FOCUS_DELAY);
  //     return () => clearTimeout(timer);
  //   }
  // }, [isOpen, activeTab]);

  // Handle tab change (FIXED: removed state resets that were causing focus loss)
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);

    // REMOVED: State resets that were causing input fields to lose focus and values
    // Only reset selections when switching tabs, not input values
    if (newTab !== activeTab) {
      setSelectedPage(null);
      // DON'T reset externalUrl or displayText - let users keep their input
    }

    // Focus management disabled to prevent focus stealing from input fields
    // Users can manually click on inputs when they want to type
  };

  // Handle custom text toggle change - OPTIMIZED: Use useCallback to prevent re-renders
  const handleCustomTextToggle = useCallback((enabled: boolean) => {
    console.log('🔧 [TOGGLE] Custom text toggle changed:', { enabled, currentState: customText });
    setCustomText(enabled);

    if (enabled) {
      // When enabling custom text, pre-fill with current display text if available
      if (activeTab === 'external') {
        // For external links, pre-fill with current display text or URL
        if (!externalCustomText) {
          const currentDisplayText = editingLink?.element?.children?.[0]?.text || externalUrl;
          if (currentDisplayText && currentDisplayText !== externalUrl) {
            setExternalCustomText(currentDisplayText);
          }
        }
      } else {
        // For internal links, pre-fill with current display text or page title
        if (!displayText) {
          const currentDisplayText = editingLink?.element?.children?.[0]?.text || selectedPage?.title || '';
          setDisplayText(currentDisplayText);
        }
      }

      // Focus management disabled to prevent focus stealing from input fields
      // Users can manually click on the custom text input when they want to type
    } else {
      // When disabling custom text, clear the display text to revert to auto-generated
      if (activeTab === 'external') {
        setExternalCustomText('');
      } else {
        setDisplayText('');
      }
    }
  }, [activeTab, externalCustomText, displayText, editingLink, externalUrl, selectedPage]);

  // OPTIMIZED: Memoized onChange handlers to prevent unnecessary re-renders
  const handleDisplayTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setDisplayText(e.target.value);
  }, []);

  const handleExternalCustomTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setExternalCustomText(e.target.value);
  }, []);

  const handleExternalUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setExternalUrl(e.target.value);
  }, []);

  // Handle URL detection in the pages search input - auto-switch to external tab
  const handleSearchInputChange = useCallback((value: string) => {
    // Check if the input looks like a URL
    if (isUrl(value)) {
      console.log('🔗 URL detected in search input, switching to external tab:', value);
      // Switch to external tab
      setActiveTab('external');
      // Set the URL in the external URL field
      let normalizedUrl = value.trim();
      // Add https:// if it starts with www. or is a bare domain
      if (normalizedUrl.startsWith('www.')) {
        normalizedUrl = 'https://' + normalizedUrl;
      } else if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      setExternalUrl(normalizedUrl);
      // Focus the external URL input after a short delay
      setTimeout(() => {
        if (externalUrlInputRef.current) {
          externalUrlInputRef.current.focus();
          // Move cursor to end
          externalUrlInputRef.current.setSelectionRange(normalizedUrl.length, normalizedUrl.length);
        }
      }, 100);
    }
  }, []);

  // DISABLED: Focus management that was causing focus stealing after typing
  // Users can manually click on the custom text input when they want to type
  // useEffect(() => {
  //   if (customText) {
  //     const timer = setTimeout(() => {
  //       if (activeTab === 'external' && externalCustomTextInputRef.current) {
  //         externalCustomTextInputRef.current.focus();
  //       } else if (activeTab === 'pages' && customTextInputRef.current) {
  //         customTextInputRef.current.focus();
  //       }
  //     }, 150); // Slightly longer delay to ensure animation completes
  //     return () => clearTimeout(timer);
  //   }
  // }, [customText, activeTab]);

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

  // CRITICAL FIX: Create link data with proper custom text handling
  const createLinkData = useCallback((page: any, customDisplayText?: string) => {
    const isUserLink = page.type === 'user' || page.isUser || page.userType === 'user';
    const pageId = page.id || page.pageId || page.userId || page.uid;
    const pageTitle = isUserLink
      ? (page.username || page.title || page.handle || 'User')
      : (page.title || page.pageTitle);
    // Determine if we have custom text - respect the user's toggle choice
    const isCustomTextValue = customText; // Use the toggle state directly
    const finalCustomText = isCustomTextValue ? (customDisplayText?.trim() || pageTitle) : '';

    const linkType = isUserLink ? 'user' : (showAuthor ? 'compound' : 'page');

    // Resolve author data - check page first, then editingLink data, then current user
    let resolvedAuthorUsername = page.username;
    let resolvedAuthorUserId = page.userId;

    // If no author data from selected page, try editingLink data
    if (!resolvedAuthorUsername && isEditing && editingLink?.data) {
      resolvedAuthorUsername = editingLink.data.authorUsername || editingLink.data.username || editingLink.data.ownerUsername;
      resolvedAuthorUserId = editingLink.data.authorUserId || editingLink.data.userId || editingLink.data.ownerId;
    }

    // Final fallback to current user if showAuthor is enabled but no author found
    if (showAuthor && !resolvedAuthorUsername && user) {
      resolvedAuthorUsername = user.username;
      resolvedAuthorUserId = user.uid;
    }

    const linkData = {
      type: linkType,
      pageId,
      pageTitle,
      originalPageTitle: pageTitle,
      text: finalCustomText, // Use the final custom text (or empty if not custom)
      isCustomText: isCustomTextValue, // STANDARDIZED: Use only isCustomText for consistency
      customText: isCustomTextValue ? finalCustomText : undefined, // Set customText field
      showAuthor: isUserLink ? false : showAuthor,
      authorUsername: isUserLink ? undefined : resolvedAuthorUsername,
      authorUserId: isUserLink ? undefined : resolvedAuthorUserId,
      // Include subscription data if available
      authorTier: isUserLink ? undefined : (page.tier || editingLink?.data?.authorTier),
      authorSubscriptionStatus: isUserLink ? undefined : (page.subscriptionStatus || editingLink?.data?.authorSubscriptionStatus),
      authorSubscriptionAmount: isUserLink ? undefined : (page.subscriptionAmount || editingLink?.data?.authorSubscriptionAmount),
      isEditing,
      element: editingLink?.element,
      isNew: page.isNew,
      url: isUserLink && pageId ? `/u/${pageId}` : (pageId ? `/${pageId}` : undefined),
      isUser: isUserLink
    };

    console.log('🔗 [MODAL DEBUG] Creating link data:', {
      customTextToggle: customText,
      customDisplayText: customDisplayText,
      finalCustomText: finalCustomText,
      isCustomTextValue: isCustomTextValue,
      linkDataPreview: {
        isCustomText: linkData.isCustomText,
        text: linkData.text,
        customText: linkData.customText,
        pageTitle: linkData.pageTitle
      },
      isEditing: isEditing,
      editingElement: editingLink?.element
    });

    return linkData;
  }, [showAuthor, customText, isEditing, editingLink, user]);

  // CRITICAL FIX: Memoize page selection to prevent React state errors
  const handlePageSelect = useCallback((page: any) => {
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
  }, [customText, showAuthor, createLinkData, onInsertLink, onClose]);

  // CRITICAL FIX: Create external link with proper custom text handling
  const handleCreateExternalLink = useCallback(() => {
    if (!externalUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Determine if we have custom text
    const hasCustomTextValue = customText && externalCustomText && externalCustomText.trim() !== '';

    const linkData = {
      type: 'external',
      url: externalUrl.trim(),
      text: hasCustomTextValue ? externalCustomText.trim() : '', // Only set text if we have custom text
      hasCustomText: hasCustomTextValue, // Only true if we actually have custom text
      isCustomText: hasCustomTextValue, // For LinkNode compatibility
      customText: hasCustomTextValue ? externalCustomText.trim() : undefined, // Set customText field
      isExternal: true,
      isEditing,
      element: editingLink?.element
    };

    console.log('🔗 Creating external link data:', {
      hasCustomText: hasCustomTextValue,
      customText: externalCustomText,
      finalText: linkData.text,
      url: externalUrl
    });

    onInsertLink(linkData);
    // Small delay to ensure Slate operations complete before modal closes
    setTimeout(() => {
      onClose();
    }, 50);
  }, [externalUrl, customText, externalCustomText, isEditing, editingLink, onInsertLink, onClose]);

  // CRITICAL FIX: Memoize page link creation to prevent React state errors
  const handleCreatePageLink = useCallback(() => {
    // FIXED: When editing, allow using editingLink data if no new page selected
    const pageToUse = selectedPage || (isEditing && editingLink?.data);

    if (!pageToUse) {
      toast.error('Please select a page');
      return;
    }

    const customDisplayText = customText ? displayText.trim() : '';
    const linkData = createLinkData(pageToUse, customDisplayText);

    console.log('🔗 [MODAL DEBUG] About to save link:', {
      selectedPage: selectedPage,
      pageToUse: pageToUse,
      customText: customText,
      displayText: displayText,
      customDisplayText: customDisplayText,
      finalLinkData: linkData,
      isEditing: isEditing
    });

    onInsertLink(linkData);

    console.log('🔗 [MODAL DEBUG] Called onInsertLink with data:', linkData);

    // Small delay to ensure Slate operations complete before modal closes
    setTimeout(() => {
      onClose();
    }, 50);
  }, [selectedPage, customText, displayText, createLinkData, onInsertLink, onClose, isEditing, editingLink]);

  // CRITICAL FIX: Remove problematic memoization that was causing React state errors
  // Focus is now maintained through proper event handling and useCallback optimization

  // Generate preview data for the link preview section
  const generatePreviewData = useCallback(() => {
    console.log('🔧 [PREVIEW] Generating preview data:', {
      activeTab,
      customText,
      displayText,
      externalCustomText,
      hasInitialized,
      isEditing,
      editingLinkData: editingLink?.data
    });

    if (activeTab === 'external') {
      // External link preview
      const linkText = customText && externalCustomText.trim()
        ? externalCustomText.trim()
        : externalUrl || 'External Link';

      return {
        type: 'external',
        text: linkText,
        url: externalUrl,
        showAuthor: false
      };
    } else {
      // Internal page link preview - FIXED: Show custom text when enabled, page title when disabled
      // CRITICAL FIX: For editing mode, always check original data first, then fall back to state
      let linkText;

      // Follow canonical LinkNode structure for preview
      if (customText && displayText.trim()) {
        // Custom text is enabled and has content
        linkText = displayText.trim();
      } else if (isEditing && editingLink?.data) {
        // Editing mode: use original page title
        linkText = editingLink.data.pageTitle || editingLink.data.title || selectedPage?.title || 'Link';
      } else {
        // New link mode: use selected page title
        linkText = selectedPage?.title || 'Select a page';
      }

      // CRITICAL FIX: Improve author data resolution for editing mode
      let authorUsername, authorUserId;

      if (selectedPage) {
        // Use selected page data
        authorUsername = selectedPage.username;
        authorUserId = selectedPage.userId;
      } else if (isEditing && editingLink?.data) {
        // Use editing link data - check multiple possible fields
        // Also fetch from page owner data if available
        authorUsername = editingLink.data.authorUsername || editingLink.data.username || editingLink.data.ownerUsername;
        authorUserId = editingLink.data.authorUserId || editingLink.data.userId || editingLink.data.ownerId;
      }

      // Final fallback: if showAuthor is toggled but no author data found, use current user
      if (showAuthor && !authorUsername) {
        authorUsername = user?.username;
        authorUserId = user?.uid;
      }

      return {
        type: 'page',
        text: linkText,
        pageId: selectedPage?.id || (isEditing ? editingLink?.data?.pageId : null),
        url: selectedPage?.id ? `/${selectedPage.id}` : (isEditing ? editingLink?.data?.url : '#'),
        showAuthor: showAuthor,
        authorUsername,
        authorUserId
      };
    }
  }, [activeTab, customText, externalCustomText, externalUrl, displayText, selectedPage, showAuthor, isEditing, editingLink, user, hasInitialized]);

  const modalContent = (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
        <div className="space-y-4 pb-2">
          {/* Link Preview Section */}
          <div className="wewrite-card p-4">
            <Label className="text-sm font-medium text-foreground mb-3 block text-center">
              Preview
            </Label>
            <div className="flex items-center justify-center gap-2">
              {(() => {
                const preview = generatePreviewData();

                if (preview.type === 'external') {
                  return (
                    <PillLink
                      href={preview.url || '#'}
                      isPublic={true}
                      className="external-link-preview"
                      clickable={false}
                    >
                      {preview.text}
                    </PillLink>
                  );
                } else {
                  // Internal page link preview
                  if (preview.showAuthor && preview.authorUsername) {
                    return (
                      <span style={{ display: 'inline' }}>
                        <PillLink
                          href={preview.url || '#'}
                          isPublic={true}
                          className="page-link-preview"
                          clickable={false}
                        >
                          {preview.text}
                        </PillLink>
                        {' '}
                        <span className="text-muted-foreground text-sm" style={{ verticalAlign: 'middle' }}>by</span>
                        {' '}
                        <UsernameBadge
                          userId={preview.authorUserId || ''}
                          username={preview.authorUsername?.replace(/^@/, '') || 'Loading...'}
                          tier={editingLink?.data?.authorTier || selectedPage?.tier}
                          subscriptionStatus={editingLink?.data?.authorSubscriptionStatus || selectedPage?.subscriptionStatus}
                          subscriptionAmount={editingLink?.data?.authorSubscriptionAmount || selectedPage?.subscriptionAmount}
                          size="sm"
                          variant="pill"
                          pillVariant="outline"
                          showBadge={true}
                        />
                      </span>
                    );
                  } else {
                    return (
                      <PillLink
                        href={preview.url || '#'}
                        isPublic={true}
                        className="page-link-preview"
                        clickable={false}
                      >
                        {preview.text}
                      </PillLink>
                    );
                  }
                }
              })()}
            </div>
          </div>

          {/* Link Type Selection - Only show when creating new links */}
          {!isEditing && (
            <div>
              <SegmentedControl value={activeTab} onValueChange={handleTabChange} className="w-full min-w-0">
                <SegmentedControlList className="grid w-full grid-cols-2 min-w-0">
                  <SegmentedControlTrigger value="pages" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                    <Icon name="FileText" size={12} className="sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">WeWrite </span>Pages
                  </SegmentedControlTrigger>
                  <SegmentedControlTrigger value="external" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                    <Icon name="ExternalLink" size={12} className="sm:h-4 sm:w-4" />
                    External<span className="hidden sm:inline"> Link</span>
                  </SegmentedControlTrigger>
                </SegmentedControlList>
              </SegmentedControl>
            </div>
          )}

          {/* Main Content Area */}
          {activeTab === 'pages' ? (
            <div className="flex flex-col gap-3 transition-all duration-200 ease-out">
              {/* Link Options - Always visible horizontal row */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="custom-text-settings" className="text-sm font-medium text-foreground">
                      Custom link text
                    </label>
                    <Switch
                      id="custom-text-settings"
                      checked={customText}
                      onCheckedChange={handleCustomTextToggle}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="show-author-settings" className="text-sm font-medium text-foreground">
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

              {/* Custom Text Input - Show when enabled */}
              {customText && (
                <div className="flex-shrink-0 animate-in slide-in-from-top-2 duration-200" style={{ pointerEvents: 'auto' }}>
                  <div className="space-y-2">
                    <Label htmlFor="display-text" className="text-sm font-medium text-foreground">
                      Custom title
                    </Label>
                    <Input
                      ref={customTextInputRef}
                      id="display-text"
                      value={displayText}
                      onChange={handleDisplayTextChange}
                      placeholder="Enter custom link text"
                      leftIcon={<Icon name="Type" size={16} />}
                      className="w-full min-w-0"
                      autoComplete="off"
                      onFocus={(e) => {
                        e.stopPropagation();
                      }}
                      onBlur={(e) => {
                        e.stopPropagation();
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      onKeyUp={(e) => {
                        e.stopPropagation();
                      }}
                      onInput={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Search Results with Current Link Inside Input */}
              <div className="w-full overflow-hidden space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Search for pages
                </Label>
                {/* Simplified Current Link Input - Styled to match wewrite-input */}
                {isEditing && editingLink && editingLink.type !== 'external' ? (
                  <div className="mb-3">
                    <div className="wewrite-input flex items-center gap-2 px-3 min-h-[40px]">
                      <PillLink
                        href={editingLink.data?.url || '#'}
                        isPublic={true}
                        className="current-link-pill text-sm"
                        clickable={false}
                      >
                        {editingLink.data?.title || editingLink.data?.pageTitle || 'Link'}
                      </PillLink>
                      {editingLink.data?.showAuthor && (editingLink.data?.authorUsername || editingLink.data?.username) && (
                        <>
                          <span className="text-muted-foreground text-sm">by</span>
                          <UsernameBadge
                            userId={editingLink.data?.authorUserId || editingLink.data?.userId || ''}
                            username={(editingLink.data?.authorUsername || editingLink.data?.username || 'Loading...').replace(/^@/, '')}
                            size="sm"
                            variant="pill"
                            pillVariant="outline"
                          />
                        </>
                      )}
                      <div className="flex-1"></div>
                      <button
                        onClick={() => {
                          // Clear the selected page to enable search
                          setSelectedPage(null);
                          // Close the modal - let parent handle editingLink state
                          onClose();
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Clear current link"
                      >
                        <Icon name="X" size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Regular Search for New Links */
                  <FilteredSearchResults
                    ref={searchInputRef}
                    onSelect={handlePageSelect}
                    userId={user?.uid}
                    placeholder="Search for pages or users..."
                    initialSearch={
                      // When editing, pre-fill with current page title for easy replacement
                      editingLink && (editingLink.type === 'page' || editingLink.type === 'compound')
                        ? editingLink.data.title || selectedText
                        : selectedText
                    }
                    autoFocus={true}
                    className="h-full"
                    preventRedirect={true}
                    linkedPageIds={linkedPageIds}
                    currentPageId={currentPageId}
                    hideCreateButton={isEditing}
                    onInputChange={handleSearchInputChange}
                    onFilterToggle={(showFilters) => {
                      // Filter toggle is handled internally by FilteredSearchResults
                      // We just need to pass a callback to enable the filter button
                      return true;
                    }}
                  />
                )}
              </div>

              {!customText && !showAuthor && !isEditing && (
                <p className="text-xs text-muted-foreground text-center">
                  Click on a page or user to create link immediately
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col space-y-3 transition-all duration-200 ease-out">
              <div className="space-y-2">
                <Label htmlFor="external-url">URL</Label>
                <div className="relative">
                  <Icon name="Globe" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={externalUrlInputRef}
                    id="external-url"
                    value={externalUrl}
                    onChange={handleExternalUrlChange}
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
                    className="w-full pl-9"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Custom Text Switch */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label htmlFor="custom-text-external" className="text-sm font-medium text-foreground">
                      Custom link text
                    </label>
                    <Switch
                      id="custom-text-external"
                      checked={customText}
                      onCheckedChange={handleCustomTextToggle}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Text Input - Show when enabled */}
              {customText && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="relative">
                    <Icon name="Type" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={externalCustomTextInputRef}
                      id="display-text-external"
                      value={externalCustomText}
                      onChange={handleExternalCustomTextChange}
                      placeholder="Enter custom link text"
                      className="w-full min-w-0 pl-9"
                      autoComplete="off"
                      onFocus={(e) => {
                        e.stopPropagation();
                        console.log('🔒 FOCUS on external custom text input');
                      }}
                      onBlur={(e) => {
                        e.stopPropagation();
                        console.log('🔓 BLUR from external custom text input');
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                      onKeyUp={(e) => {
                        e.stopPropagation();
                      }}
                      onInput={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </>
  );

  // Footer button content - rendered inside DialogFooter/DrawerFooter
  const footerButton = activeTab === 'pages' ? (
    <Button
      onClick={handleCreatePageLink}
      disabled={!selectedPage && !(isEditing && editingLink?.data)}
      className="w-full"
    >
      <Icon name="Link" size={16} className="mr-2" />
      {isEditing ? 'Update Link' : 'Insert Link'}
    </Button>
  ) : (
    <Button
      onClick={handleCreateExternalLink}
      disabled={!externalUrl.trim()}
      className="w-full"
    >
      <Icon name="Link" size={16} className="mr-2" />
      {isEditing ? 'Update Link' : 'Insert Link'}
    </Button>
  );

  // Responsive modal: Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }} hashId="link-editor" analyticsId="link_editor">
        <DrawerContent
          height="85vh"
          tabIndex={-1}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            // Prevent drawer from closing when clicking on input fields
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, [id*="display-text"]')) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onInteractOutside={(e) => {
            // Prevent drawer from handling interactions with input fields
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, [id*="display-text"]')) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onFocusOutside={(e) => {
            // Prevent focus from being managed by the drawer
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, [id*="display-text"]')) {
              console.log('🚫 PREVENTING FOCUS OUTSIDE - Input field detected');
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          // REMOVED: onFocus handler that was stealing focus from custom text input
        >
          <DrawerHeader showCloseButton>
            <DrawerTitle>{modalTitle}</DrawerTitle>
          </DrawerHeader>

          <div
            className="flex-1 min-h-0 flex flex-col px-4"
            onMouseDown={(e) => {
              // CRITICAL FIX: Prevent drawer content wrapper from stealing focus from input fields
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              // CRITICAL FIX: Prevent drawer content wrapper from stealing focus from input fields
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
                e.stopPropagation();
              }
            }}
          >
            {modalContent}
          </div>

          <DrawerFooter className="px-4 pt-4 pb-6">
            {footerButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }} hashId="link-editor" analyticsId="link_editor">
      <DialogContent
        className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden p-4 sm:p-6 transition-all duration-200 ease-out flex flex-col"
        tabIndex={-1}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          // Don't auto-focus to prevent interference with custom text input
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          // Prevent dialog from closing when clicking on input fields
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, [id*="display-text"]')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent dialog from handling interactions with input fields
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, [id*="display-text"]')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onFocusOutside={(e) => {
          // Prevent focus from being managed by the dialog
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea, [id*="display-text"]')) {
            console.log('🚫 PREVENTING FOCUS OUTSIDE - Input field detected');
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        // REMOVED: onFocus handler that was stealing focus from custom text input
      >
        <DialogHeader className="relative flex-shrink-0">
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogClose className="absolute right-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <Icon name="X" size={16} />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        <div
          className="flex-1 min-h-0 flex flex-col"
          onMouseDown={(e) => {
            // CRITICAL FIX: Prevent modal content wrapper from stealing focus from input fields
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
              e.stopPropagation();
            }
          }}
          onClick={(e) => {
            // CRITICAL FIX: Prevent modal content wrapper from stealing focus from input fields
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input, textarea')) {
              e.stopPropagation();
            }
          }}
        >
          {modalContent}
        </div>

        <DialogFooter className="pt-4">
          {footerButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
