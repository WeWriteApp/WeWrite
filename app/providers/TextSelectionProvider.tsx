"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { useTextSelection } from '../hooks/useTextSelection';
import UnifiedTextSelectionMenu from '../components/text-selection/UnifiedTextSelectionMenu';

interface TextSelectionContextType {
  selectedText: string;
  position: { x: number; y: number } | null;
  isVisible: boolean;
  selectionRange: Range | null;
  clearSelection: () => void;
  copyToClipboard: (text?: string) => Promise<{ success: boolean; message: string }>;
  createShareableLink: (text?: string, range?: Range | null) => { success: boolean; link?: string; message: string };
}

const TextSelectionContext = createContext<TextSelectionContextType | undefined>(undefined);

export const useTextSelectionContext = () => {
  const context = useContext(TextSelectionContext);
  if (context === undefined) {
    throw new Error('useTextSelectionContext must be used within a TextSelectionProvider');
  }
  return context;
};

interface TextSelectionProviderProps {
  children: React.ReactNode;
  contentRef?: React.RefObject<HTMLElement>;
  enableCopy?: boolean;
  enableShare?: boolean;
  enableAddToPage?: boolean;
  username?: string;
}

export const TextSelectionProvider: React.FC<TextSelectionProviderProps> = ({
  children,
  contentRef,
  enableCopy = true,
  enableShare = true,
  enableAddToPage = true,
  username
}) => {
  const {
    selectedText,
    position,
    isVisible,
    selectionRange,
    clearSelection,
    copyToClipboard,
    createShareableLink
  } = useTextSelection({
    contentRef,
    enableCopy,
    enableShare,
    enableAddToPage
  });

  const contextValue: TextSelectionContextType = {
    selectedText,
    position,
    isVisible,
    selectionRange,
    clearSelection,
    copyToClipboard,
    createShareableLink};

  // Debug logging for visibility changes
  useEffect(() => {
    console.log('🔗 TEXT_SELECTION_PROVIDER: Visibility state changed:', {
      isVisible,
      hasPosition: !!position,
      hasSelectedText: !!selectedText,
      selectedText: selectedText?.substring(0, 50) + (selectedText?.length > 50 ? '...' : '')
    });
  }, [isVisible, position, selectedText]);

  return (
    <TextSelectionContext.Provider value={contextValue}>
      {children}
      {isVisible && position && selectedText && (
        <UnifiedTextSelectionMenu
          selectedText={selectedText}
          position={position}
          onClose={clearSelection}
          onCopy={copyToClipboard}
          onCreateLink={createShareableLink}
          enableCopy={enableCopy}
          enableShare={enableShare}
          enableAddToPage={enableAddToPage}
          username={username}
        />
      )}
    </TextSelectionContext.Provider>
  );
};