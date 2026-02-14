'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface PageActions {
  pageId: string;
  pageTitle?: string;
  isEditing: boolean;
  isOwner: boolean;
  canEdit: boolean;
  // View actions
  onEdit?: () => void;
  onReply?: () => void;
  onDelete?: () => void;
  onCopyLink?: () => void;
  onToggleParagraphMode?: () => void;
  // Editor actions
  onInsertLink?: () => void;
  onAddLocation?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

interface CommandPaletteActionsContextType {
  pageActions: PageActions | null;
  registerPageActions: (actions: PageActions) => void;
  unregisterPageActions: (pageId: string) => void;
}

const CommandPaletteActionsContext = createContext<CommandPaletteActionsContextType>({
  pageActions: null,
  registerPageActions: () => {},
  unregisterPageActions: () => {},
});

export function CommandPaletteActionsProvider({ children }: { children: ReactNode }) {
  const [pageActions, setPageActions] = useState<PageActions | null>(null);

  const registerPageActions = useCallback((actions: PageActions) => {
    setPageActions(actions);
  }, []);

  const unregisterPageActions = useCallback((pageId: string) => {
    setPageActions(prev => (prev?.pageId === pageId ? null : prev));
  }, []);

  return (
    <CommandPaletteActionsContext.Provider value={{ pageActions, registerPageActions, unregisterPageActions }}>
      {children}
    </CommandPaletteActionsContext.Provider>
  );
}

export function useCommandPaletteActions() {
  return useContext(CommandPaletteActionsContext);
}
