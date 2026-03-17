"use client";

import React, { useEffect, useMemo } from 'react';
import NavPageLayout from '../components/layout/NavPageLayout';
import { useCommandPalette } from '../providers/CommandPaletteProvider';
import { useHasKeyboard } from '../hooks/useHasKeyboard';

export default function SearchPage() {
  const { openPaletteWithQuery, openPalette } = useCommandPalette();
  const hasKeyboard = useHasKeyboard();

  const initialQuery = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('q')?.trim() || '';
    }
    return '';
  }, []);

  useEffect(() => {
    if (initialQuery) {
      openPaletteWithQuery(initialQuery);
    } else {
      openPalette();
    }
  }, [initialQuery, openPaletteWithQuery, openPalette]);

  return (
    <NavPageLayout>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <p className="text-muted-foreground mb-2">
          {hasKeyboard
            ? 'Press Cmd+K (or Ctrl+K) to search for pages, users, and commands.'
            : 'Use the search button to find pages, users, and commands.'}
        </p>
      </div>
    </NavPageLayout>
  );
}
