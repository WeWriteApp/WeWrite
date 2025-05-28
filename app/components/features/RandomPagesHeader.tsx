'use client';

import React, { useState, useEffect } from 'react';
import { Shuffle, MoreHorizontal, Lock } from 'lucide-react';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/**
 * RandomPagesHeader Component
 *
 * Header component for the Random Pages section that includes:
 * - Section title with shuffle icon
 * - Shuffle button (responsive: text on desktop, icon-only on mobile)
 * - Privacy toggle menu with three-dot button
 * - Persistent toggle state in localStorage
 */
const RandomPagesHeader = () => {
  const [includePrivatePages, setIncludePrivatePages] = useState(false);

  // Load privacy toggle state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPreference = localStorage.getItem('randomPages_includePrivate');
      if (savedPreference === 'true') {
        setIncludePrivatePages(true);
      }
    }
  }, []);

  // Handle privacy toggle change
  const handlePrivacyToggle = () => {
    const newValue = !includePrivatePages;
    setIncludePrivatePages(newValue);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_includePrivate', String(newValue));
    }

    // Trigger shuffle with new privacy setting
    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: { includePrivate: newValue }
    });
    window.dispatchEvent(shuffleEvent);
  };

  // Handle shuffle button click
  const handleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: { includePrivate: includePrivatePages }
    });
    window.dispatchEvent(shuffleEvent);
  };

  const renderPrivacyMenu = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-2xl hover:bg-muted/80 transition-colors"
            aria-label="Random pages privacy options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handlePrivacyToggle();
            }}
            className="flex items-center justify-between cursor-pointer py-3"
          >
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">Include private pages</span>
                <span className="text-xs text-muted-foreground">
                  Show private pages you have access to
                </span>
              </div>
            </div>
            <Switch
              checked={includePrivatePages}
              onCheckedChange={(checked) => {
                if (checked !== includePrivatePages) {
                  handlePrivacyToggle();
                }
              }}
              aria-label="Toggle private pages inclusion"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <SectionTitle
      icon={Shuffle}
      title="Random Pages"
      rightContent={
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Shuffle Buttons - Responsive: text on desktop, icon-only on mobile */}
          <>
            {/* Desktop: Button with text and icon */}
            <Button
              variant="outline"
              onClick={handleShuffle}
              className="hidden sm:flex items-center gap-2 rounded-2xl h-8 px-3"
            >
              <Shuffle className="h-4 w-4" />
              <span className="hidden md:inline">Shuffle</span>
            </Button>

            {/* Mobile: Icon-only button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleShuffle}
              className="sm:hidden h-8 w-8 rounded-2xl"
              aria-label="Shuffle random pages"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </>

          {/* Privacy Menu */}
          {renderPrivacyMenu()}
        </div>
      }
    />
  );
};

export default RandomPagesHeader;
