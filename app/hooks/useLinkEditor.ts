import { useState, useCallback } from 'react';

export interface LinkData {
  type: 'page' | 'external' | 'compound';
  pageId?: string;
  pageTitle?: string;
  originalPageTitle?: string;
  url?: string;
  text: string;
  showAuthor: boolean;
  authorUsername?: string;
  authorUserId?: string;
  authorTier?: string;
  authorSubscriptionStatus?: string;
  authorSubscriptionAmount?: number;
  isEditing: boolean;
  element?: HTMLElement;
  isNew?: boolean;
}

export interface LinkEditorState {
  customText: boolean;
  showAuthor: boolean;
  displayText: string;
  selectedPage: any | null;
  externalUrl: string;
}

export interface LinkEditorActions {
  setCustomText: (enabled: boolean) => void;
  setShowAuthor: (enabled: boolean) => void;
  setDisplayText: (text: string) => void;
  setSelectedPage: (page: any | null) => void;
  setExternalUrl: (url: string) => void;
  handleCustomTextToggle: (enabled: boolean) => void;
  createPageLinkData: (page: any, customDisplayText?: string) => LinkData;
  createExternalLinkData: (url: string, customDisplayText?: string) => LinkData;
  getDefaultDisplayText: () => string;
  resetState: () => void;
}

export interface UseLinkEditorOptions {
  isEditing?: boolean;
  editingLink?: any;
  selectedText?: string;
  activeTab?: string;
}

/**
 * Shared hook for link editor functionality
 * Consolidates common logic between LinkEditorModal and LinkSuggestionEditorModal
 */
export function useLinkEditor({
  isEditing = false,
  editingLink = null,
  selectedText = '',
  activeTab = 'pages'
}: UseLinkEditorOptions = {}): [LinkEditorState, LinkEditorActions] {
  
  // State
  const [customText, setCustomText] = useState(false);
  const [showAuthor, setShowAuthor] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [externalUrl, setExternalUrl] = useState('');

  // Get default display text based on current context
  const getDefaultDisplayText = useCallback(() => {
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
    return selectedText || '';
  }, [activeTab, externalUrl, selectedPage, editingLink, selectedText]);

  // Handle custom text toggle with smart defaults
  const handleCustomTextToggle = useCallback((enabled: boolean) => {
    setCustomText(enabled);

    if (enabled && !displayText) {
      // Pre-fill with appropriate default text when enabling
      const defaultText = getDefaultDisplayText();
      if (defaultText) {
        setDisplayText(defaultText);
      }
    } else if (!enabled) {
      // Clear display text to revert to auto-generated when disabling
      setDisplayText('');
    }
  }, [displayText, getDefaultDisplayText]);

  // Create page link data with consistent structure
  const createPageLinkData = useCallback((page: any, customDisplayText?: string): LinkData => {
    return {
      type: showAuthor ? 'compound' : 'page',
      pageId: page.id,
      pageTitle: page.title,
      originalPageTitle: page.title,
      text: customDisplayText || '',
      showAuthor,
      authorUsername: page.username,
      authorUserId: page.userId,
      authorTier: page.tier,
      authorSubscriptionStatus: page.subscriptionStatus,
      authorSubscriptionAmount: page.subscriptionAmount,
      isEditing,
      element: editingLink?.element,
      isNew: page.isNew,
      url: `/${page.id}`
    };
  }, [showAuthor, isEditing, editingLink]);

  // Create external link data with consistent structure
  const createExternalLinkData = useCallback((url: string, customDisplayText?: string): LinkData => {
    return {
      type: 'external',
      url: url.trim(),
      text: customDisplayText || '',
      showAuthor: false, // External links don't show authors
      isEditing,
      element: editingLink?.element,
      isNew: false
    };
  }, [isEditing, editingLink]);

  // Reset all state to defaults
  const resetState = useCallback(() => {
    setCustomText(false);
    setShowAuthor(false);
    setDisplayText('');
    setSelectedPage(null);
    setExternalUrl('');
  }, []);

  const state: LinkEditorState = {
    customText,
    showAuthor,
    displayText,
    selectedPage,
    externalUrl
  };

  const actions: LinkEditorActions = {
    setCustomText,
    setShowAuthor,
    setDisplayText,
    setSelectedPage,
    setExternalUrl,
    handleCustomTextToggle,
    createPageLinkData,
    createExternalLinkData,
    getDefaultDisplayText,
    resetState
  };

  return [state, actions];
}
