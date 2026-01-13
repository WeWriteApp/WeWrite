/**
 * WHY: Centralized text-selection logic so view-mode pages allow copying/attribution
 * while ignoring UI chrome. Keeps a single selection menu and prepares clipboard
 * payloads with WeWrite attribution metadata for downstream paste handling.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface TextSelectionState {
  selectedText: string;
  selectedHtml: string;
  position: { x: number; y: number } | null;
  isVisible: boolean;
  selectionRange: Range | null;
}

interface TextSelectionOptions {
  enableCopy?: boolean;
  enableShare?: boolean;
  enableAddToPage?: boolean;
  contentRef?: React.RefObject<HTMLElement>;
  attribution?: {
    username?: string;
    userId?: string;
    pageId?: string;
    pageTitle?: string;
  };
}

export const useTextSelection = (options: TextSelectionOptions = {}) => {
  const [selectionState, setSelectionState] = useState<TextSelectionState>({
    selectedText: '',
    selectedHtml: '',
    position: null,
    isVisible: false,
    selectionRange: null});

  // Track if any modal is currently open to prevent clearing selection
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debounce ref to prevent oscillation on iOS
  const selectionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();

    if (isModalOpen) {
      // Preserve selection visibility while modal is open
      return;
    }

    if (!selection || selection.rangeCount === 0) {
      setSelectionState(prev => ({ ...prev, isVisible: false, selectionRange: null }));
      return;
    }

    const selectedText = selection.toString();
    let selectedHtml = '';

    try {
      const range = selection.getRangeAt(0);
      const cloned = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(cloned);
      selectedHtml = tempDiv.innerHTML;
    } catch (err) {
      selectedHtml = selectedText;
    }

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
    // Use viewport-relative position (not scroll-adjusted) for fixed positioning
    const newPosition = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10, // Position above selection (fixed positioning, no scrollY needed)
    };

    // iOS oscillation prevention: Only update position if it changed significantly
    // This prevents rapid position updates that cause the native menu to jump
    const POSITION_THRESHOLD = 5; // pixels
    const lastPos = lastPositionRef.current;
    const positionChanged = !lastPos ||
      Math.abs(newPosition.x - lastPos.x) > POSITION_THRESHOLD ||
      Math.abs(newPosition.y - lastPos.y) > POSITION_THRESHOLD;

    // Debounce position updates on iOS to prevent oscillation
    if (selectionDebounceRef.current) {
      clearTimeout(selectionDebounceRef.current);
    }

    // If position hasn't changed significantly, don't update (prevents oscillation)
    if (!positionChanged && selectionState.isVisible && selectionState.selectedText === selectedText) {
      return;
    }

    // Use debounced update to prevent rapid state changes
    selectionDebounceRef.current = setTimeout(() => {
      lastPositionRef.current = newPosition;
      setSelectionState({
        selectedText,
        selectedHtml,
        position: newPosition,
        isVisible: true,
        selectionRange: selectionRange.cloneRange(),
      });
    }, 50); // 50ms debounce to stabilize on iOS
  }, [options.contentRef, selectionState.isVisible, selectionState.selectedText]);

  const clearSelection = useCallback(() => {
    // Clear any pending debounce
    if (selectionDebounceRef.current) {
      clearTimeout(selectionDebounceRef.current);
      selectionDebounceRef.current = null;
    }
    lastPositionRef.current = null;

    setSelectionState({
      selectedText: '',
      selectedHtml: '',
      position: null,
      isVisible: false,
      selectionRange: null
    });

    // Clear the browser selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

  // Utility functions for text selection actions
  const copyToClipboard = useCallback(async (text: string = selectionState.selectedText, htmlOverride?: string) => {
    const author = options.attribution || {};
    const cleanUsername = (author.username || 'unknown').replace(/^@/, '');
    const meta = {
      username: cleanUsername,
      userId: author.userId || 'unknown',
      pageId: author.pageId || 'unknown',
      pageTitle: author.pageTitle || '',
      copiedAt: Date.now()
    };

    const quotedText = `“${text}” — by ${cleanUsername || 'unknown'}`;
    const escapeHtml = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const attributionHref = cleanUsername ? `/@${cleanUsername}` : '#';
    const selectionHtml = htmlOverride || selectionState.selectedHtml || escapeHtml(text);
    const htmlPayload = `
      <blockquote data-wewrite-attribution='${encodeURIComponent(JSON.stringify(meta))}'>
        ${selectionHtml}
      </blockquote>
      <p data-wewrite-attribution='${encodeURIComponent(JSON.stringify(meta))}'>
        — by <a href="${attributionHref}" data-user-id="${escapeHtml(meta.userId)}" class="user-link pill-link" data-wewrite-attribution='${encodeURIComponent(JSON.stringify(meta))}'>${escapeHtml(cleanUsername || 'Unknown')}</a>
      </p>
    `;

    try {
      const canWriteRich =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard?.write &&
        typeof ClipboardItem !== 'undefined';

      if (canWriteRich) {
        const items: Record<string, Blob> = {
          'text/plain': new Blob([quotedText], { type: 'text/plain' }),
          'text/html': new Blob([htmlPayload], { type: 'text/html' })
        };
        await navigator.clipboard.write([new ClipboardItem(items)]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(quotedText);
      } else {
        throw new Error('Clipboard API not available');
      }
      return { success: true, message: 'Text copied with attribution' };
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback to plain text copy
      try {
        await navigator.clipboard.writeText(quotedText);
        return { success: true, message: 'Text copied (plain)' };
      } catch (err) {
        return { success: false, message: 'Failed to copy text' };
      }
    }
  }, [selectionState.selectedText, options.attribution]);

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
      const target = event.target as Element;
      const isInputField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';

      // CRITICAL FIX: Allow input fields to work normally regardless of modal state
      if (isInputField) {
        return; // Let the input field handle the click normally
      }

      // Check if any modal is open by looking for dialog elements
      const hasOpenModal = document.querySelector('[role="dialog"][data-state="open"]') ||
                          document.querySelector('[data-radix-dialog-content]') ||
                          document.querySelector('.text-selection-menu');

      // Don't clear selection if any modal is open (but input fields are already handled above)
      if (hasOpenModal || isModalOpen) {
        return;
      }

      // Small delay to allow selection to be processed first
      setTimeout(() => {
        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;

        if (!hasSelection) {
          setSelectionState(prev => ({ ...prev, isVisible: false }));
        }
      }, 10);
    };
    
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('click', handleClick);
      // Clean up debounce timer on unmount
      if (selectionDebounceRef.current) {
        clearTimeout(selectionDebounceRef.current);
      }
    };
  }, [handleSelectionChange]);

    return {
    selectedText: selectionState.selectedText,
    selectedHtml: selectionState.selectedHtml,
    position: selectionState.position,
    isVisible: selectionState.isVisible,
    selectionRange: selectionState.selectionRange,
    clearSelection,
    copyToClipboard,
    createShareableLink,
    options,
    setIsModalOpen};
};
