"use client";

import { useEffect } from 'react';

export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Handle keyboard shortcuts
      if (event.metaKey || event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case 'k':
            event.preventDefault();
            handlers.search?.();
            break;
          case 'b':
            event.preventDefault();
            handlers.toggleSidebar?.();
            break;
          case 'n':
            event.preventDefault();
            handlers.newPage?.();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
} 