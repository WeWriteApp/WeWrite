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
    selectionRange: null,
  });

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

    // Check if selection is within the content area (if contentRef is provided)
    if (options.contentRef?.current) {
      const range = selection.getRangeAt(0);
      const contentElement = options.contentRef.current;

      // Check if the selection is within the content element
      if (!contentElement.contains(range.commonAncestorContainer)) {
        setSelectionState(prev => ({ ...prev, isVisible: false, selectionRange: null }));
        return;
      }
    }

    // Get the position of the selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate position for the menu (center of selection, above it)
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 45, // Position above selection with more space
    };

    setSelectionState({
      selectedText,
      position,
      isVisible: true,
      selectionRange: range.cloneRange(), // Store a copy of the range
    });
  }, [options.contentRef]);

  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedText: '',
      position: null,
      isVisible: false,
      selectionRange: null,
    });

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
    options,
  };
};
