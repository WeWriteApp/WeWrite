/**
 * WHY: Wraps page/content areas with a single text-selection context so copy/share
 * behavior (including attribution metadata) stays consistent across the app.
 */
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
  userId?: string;
  pageId?: string;
  pageTitle?: string;
  canEdit?: boolean;
}

export const TextSelectionProvider: React.FC<TextSelectionProviderProps> = ({
  children,
  contentRef,
  enableCopy = true,
  enableShare = true,
  enableAddToPage = true,
  username,
  userId,
  pageId,
  pageTitle,
  canEdit = true
}) => {
  const [forceMenu, setForceMenu] = React.useState(false);
  const {
    selectedText,
    selectedHtml,
    position,
    isVisible,
    selectionRange,
    clearSelection,
    copyToClipboard,
    createShareableLink,
    setIsModalOpen
  } = useTextSelection({
    contentRef,
    enableCopy,
    enableShare,
    enableAddToPage,
    attribution: {
      username,
      userId,
      pageId,
      pageTitle
    }
  });

  const contextValue: TextSelectionContextType = {
    selectedText,
    position,
    isVisible,
    selectionRange,
    clearSelection,
    copyToClipboard,
    createShareableLink};

  const shouldRenderMenu = (isVisible && position && selectedText) || forceMenu;

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
      {shouldRenderMenu && (
        <UnifiedTextSelectionMenu
          selectedText={selectedText}
          selectedHtml={selectedHtml}
          position={position}
          onClose={clearSelection}
          onCopy={copyToClipboard}
          onCreateLink={createShareableLink}
          selectedHtml={selectedHtml}
          selectedHtml={(selectionRange as any)?.selectedHtml || ''}
          enableCopy={enableCopy}
          enableShare={enableShare}
          enableAddToPage={enableAddToPage}
          username={username}
          userId={userId}
          pageId={pageId}
          pageTitle={pageTitle}
          canEdit={canEdit}
          setSelectionModalOpen={(open) => {
            setForceMenu(open);
            setIsModalOpen(open);
          }}
        />
      )}
    </TextSelectionContext.Provider>
  );
};
