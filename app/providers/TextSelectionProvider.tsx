"use client";

import React, { createContext, useContext } from 'react';
import { useTextSelection } from '../hooks/useTextSelection';
import TextSelectionMenu from '../components/text-selection/TextSelectionMenu';

interface TextSelectionContextType {
  selectedText: string;
  position: { x: number; y: number } | null;
  isVisible: boolean;
  clearSelection: () => void;
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
}

export const TextSelectionProvider: React.FC<TextSelectionProviderProps> = ({ children }) => {
  const { selectedText, position, isVisible, clearSelection } = useTextSelection();

  const contextValue: TextSelectionContextType = {
    selectedText,
    position,
    isVisible,
    clearSelection,
  };

  return (
    <TextSelectionContext.Provider value={contextValue}>
      {children}
      {isVisible && position && selectedText && (
        <TextSelectionMenu
          selectedText={selectedText}
          position={position}
          onClose={clearSelection}
        />
      )}
    </TextSelectionContext.Provider>
  );
};
