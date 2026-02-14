'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useCommandPaletteActions } from '../contexts/CommandPaletteActionsContext';

interface CommandPaletteContextType {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType>({
  isOpen: false,
  openPalette: () => {},
  closePalette: () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

/** Returns true when the event target is an input, textarea, contenteditable, or Slate editor */
function isInputTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  if (target.closest('[data-slate-editor]')) return true;
  return false;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { pageActions } = useCommandPaletteActions();

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Already handled by another listener
      if (e.defaultPrevented) return;

      // Cmd/Ctrl+Shift+P — always works, even when editing
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // Skip Cmd+K when the user is editing a page (it opens the link modal)
      const isEditingPage = pageActions?.isEditing;

      // Cmd/Ctrl+K — only when not editing
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (isEditingPage) return; // let editor handle it
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // "/" key — only when not in an input
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (isInputTarget(e)) return;
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pageActions?.isEditing]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, openPalette, closePalette }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}
