"use client";

import { useState, useEffect, useCallback } from 'react';

interface TextSelectionState {
  selectedText: string;
  position: { x: number; y: number } | null;
  isVisible: boolean;
  selectionRange: Range | null;
}

interface TextSelectionOptions {
  enableCopy?: boolean;
  enableShare?: boolean;
  enableAddToPage?: boolean;
  contentRef?: React.RefObject<HTMLElement>;
}

export const useTextSelection = (options: TextSelectionOptions = {}) => {
  const [selectionState, setSelectionState] = useState<TextSelectionState>({
    selectedText: '',
    position: null,
    isVisible: false,
    selectionRange: null});

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      setSelectionState(prev => ({ ...prev, isVisible: false, selectionRange: null }));
      return;
    }

    const selectedText = selection.toString().trim();

    if (selectedText.length === 0) {
      setSelectionState(prev => ({ ...prev, isVisible: false, selectionRange: null }));
      return;
    }

    const range = selection.getRangeAt(0);

    // Check if selection is within allowed content areas
    const isInAllowedArea = () => {
      // If contentRef is provided, only allow selections within that element
      if (options.contentRef?.current) {
        return options.contentRef.current.contains(range.commonAncestorContainer);
      }

      // Otherwise, check if selection is in any allowed content area
      const allowedSelectors = [
        '[data-page-content]',           // Main page content
        '.user-bio-content',             // User biography content
        '.group-about-content',          // Group about page content
        '[data-editor]',                 // Editor content
        '.page-content',                 // Page content areas
        '.content-area',                 // Generic content areas
        '.unified-text-content',         // Unified text content
        '.prose',                        // Prose content
        '.text-view-content',            // Text view content
        '.editor-content',               // Editor content
        '.paragraph-content',            // Paragraph content
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', // Text elements
        'span', 'div',                   // Generic text containers
        '.slide-up-page',                // Slide-up page content
        '.new-page-container'            // New page container
      ];

      // Check if the selection is within any allowed area
      for (const selector of allowedSelectors) {
        const allowedElement = document.querySelector(selector);
        if (allowedElement && allowedElement.contains(range.commonAncestorContainer)) {
          return true;
        }
      }

      // Prevent selection in navigation, headers, and UI elements
      const forbiddenSelectors = [
        'header',
        'nav',
        '.sidebar',
        '.header',
        '.navigation',
        '.menu',
        '.toolbar',
        '.button',
        '.pill-link',
        '[role="button"]',
        '[role="navigation"]',
        '[role="menubar"]',
        '[role="toolbar"]'
      ];

      // Check if selection is within any forbidden area
      for (const selector of forbiddenSelectors) {
        const forbiddenElement = document.querySelector(selector);
        if (forbiddenElement && forbiddenElement.contains(range.commonAncestorContainer)) {
          return false;
        }
      }

      return true; // Default to allowing selection if not in forbidden areas
    };

    if (!isInAllowedArea()) {
      setSelectionState(prev => ({ ...prev, isVisible: false, selectionRange: null }));
      return;
    }

    // Get the position of the selection
    const selectionRange = selection.getRangeAt(0);
    const rect = selectionRange.getBoundingClientRect();

    // Calculate position for the menu (center of selection, above it)
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 45, // Position above selection with more space
    };

    setSelectionState({
      selectedText,
      position,
      isVisible: true,
      selectionRange: selectionRange.cloneRange(), // Store a copy of the range
    });
  }, [options.contentRef]);

  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedText: '',
      position: null,
      isVisible: false,
      selectionRange: null});

    // Clear the browser selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

  // Utility functions for text selection actions
  const copyToClipboard = useCallback(async (text: string = selectionState.selectedText) => {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, message: 'Text copied to clipboard' };
    } catch (error) {
      console.error('Failed to copy text:', error);
      return { success: false, message: 'Failed to copy text' };
    }
  }, [selectionState.selectedText]);

  const createShareableLink = useCallback((text: string = selectionState.selectedText, range: Range | null = selectionState.selectionRange) => {
    if (!text || !range) {
      return { success: false, message: 'No text selected' };
    }

    try {
      // Create a hash for the selection
      const selectionHash = btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

      // Create the link with highlight parameter
      const currentUrl = window.location.href.split('#')[0];
      const linkWithSelection = `${currentUrl}#highlight=${selectionHash}`;

      // Store highlight information in localStorage
      const rangeInfo = {
        text: text,
        timestamp: Date.now(),
        username: null, // Can be set by the calling component
        url: currentUrl
      };

      localStorage.setItem(`highlight_${selectionHash}`, JSON.stringify(rangeInfo));

      return {
        success: true,
        link: linkWithSelection,
        hash: selectionHash,
        message: 'Shareable link created'
      };
    } catch (error) {
      console.error('Error creating shareable link:', error);
      return { success: false, message: 'Failed to create shareable link' };
    }
  }, [selectionState.selectedText, selectionState.selectionRange]);

  useEffect(() => {
    // Add event listener for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Add event listener for clicks to clear selection
    const handleClick = (event: MouseEvent) => {
      // Small delay to allow selection to be processed first
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
          setSelectionState(prev => ({ ...prev, isVisible: false }));
        }
      }, 10);
    };
    
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('click', handleClick);
    };
  }, [handleSelectionChange]);

  return {
    selectedText: selectionState.selectedText,
    position: selectionState.position,
    isVisible: selectionState.isVisible,
    selectionRange: selectionState.selectionRange,
    clearSelection,
    copyToClipboard,
    createShareableLink,
    options};
};