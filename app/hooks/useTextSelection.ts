"use client";

import { useState, useEffect, useCallback } from 'react';

interface TextSelectionState {
  selectedText: string;
  position: { x: number; y: number } | null;
  isVisible: boolean;
}

export const useTextSelection = () => {
  const [selectionState, setSelectionState] = useState<TextSelectionState>({
    selectedText: '',
    position: null,
    isVisible: false,
  });

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      setSelectionState(prev => ({ ...prev, isVisible: false }));
      return;
    }

    const selectedText = selection.toString().trim();
    
    if (selectedText.length === 0) {
      setSelectionState(prev => ({ ...prev, isVisible: false }));
      return;
    }

    // Get the position of the selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Calculate position for the menu (center of selection, above it)
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 10, // 10px above the selection
    };

    setSelectionState({
      selectedText,
      position,
      isVisible: true,
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedText: '',
      position: null,
      isVisible: false,
    });
    
    // Clear the browser selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

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
    clearSelection,
  };
};
