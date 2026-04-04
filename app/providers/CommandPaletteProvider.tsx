'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useCommandPaletteActions } from '../contexts/CommandPaletteActionsContext';

export interface LinkLocationContext {
  lat: number;
  lng: number;
  zoom: number;
}

interface CommandPaletteContextType {
  isOpen: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  linkLocationContext: LinkLocationContext | null;
  openPalette: () => void;
  openPaletteWithQuery: (query: string) => void;
  openPaletteWithLocationLink: (location: LinkLocationContext) => void;
  closePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType>({
  isOpen: false,
  inputValue: '',
  setInputValue: () => {},
  linkLocationContext: null,
  openPalette: () => {},
  openPaletteWithQuery: () => {},
  openPaletteWithLocationLink: () => {},
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
  const [inputValue, setInputValue] = useState('');
  const [linkLocationContext, setLinkLocationContext] = useState<LinkLocationContext | null>(null);
  const { pageActions } = useCommandPaletteActions();

  /**
   * On mobile, programmatic .focus() from useEffect won't open the virtual
   * keyboard because it happens outside a "user activation" context. To work
   * around this, we create a temporary invisible <input>, focus it
   * synchronously inside the tap handler (which IS a user activation), then
   * let the CommandDialog transfer focus to the real input once mounted.
   */
  const claimMobileKeyboard = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Only needed on touch devices
    if (!('ontouchstart' in window)) return;
    const tmp = document.createElement('input');
    tmp.style.position = 'fixed';
    tmp.style.opacity = '0';
    tmp.style.top = '0';
    tmp.style.left = '0';
    tmp.style.height = '0';
    tmp.style.fontSize = '16px'; // prevents iOS auto-zoom
    tmp.setAttribute('aria-hidden', 'true');
    tmp.setAttribute('tabindex', '-1');
    document.body.appendChild(tmp);
    tmp.focus();
    // Remove after the real input has had time to take focus
    setTimeout(() => tmp.remove(), 1000);
  }, []);

  const openPalette = useCallback(() => {
    claimMobileKeyboard();
    setIsOpen(true);
  }, [claimMobileKeyboard]);
  const openPaletteWithQuery = useCallback((query: string) => {
    claimMobileKeyboard();
    setInputValue(query);
    setIsOpen(true);
  }, [claimMobileKeyboard]);
  const openPaletteWithLocationLink = useCallback((location: LinkLocationContext) => {
    setLinkLocationContext(location);
    setInputValue('');
    setIsOpen(true);
  }, []);
  const closePalette = useCallback(() => {
    setIsOpen(false);
    setInputValue('');
    setLinkLocationContext(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Already handled by another listener
      if (e.defaultPrevented) return;

      // Cmd/Ctrl+Shift+P — always works, even when editing
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsOpen(prev => {
          if (prev) { setInputValue(''); setLinkLocationContext(null); }
          return !prev;
        });
        return;
      }

      // Skip Cmd+K when the user is editing a page (it opens the link modal)
      const isEditingPage = pageActions?.isEditing;

      // Cmd/Ctrl+K — only when not editing
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (isEditingPage) return; // let editor handle it
        e.preventDefault();
        setIsOpen(prev => {
          if (prev) { setInputValue(''); setLinkLocationContext(null); }
          return !prev;
        });
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
    <CommandPaletteContext.Provider value={{ isOpen, inputValue, setInputValue, linkLocationContext, openPalette, openPaletteWithQuery, openPaletteWithLocationLink, closePalette }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}
