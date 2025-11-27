'use client';

import React, { useState, useEffect } from 'react';
import { Shuffle, MoreHorizontal, Grid3X3, UserX } from 'lucide-react';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator} from '../ui/dropdown-menu';
import RandomPageFilterMenu from '../ui/RandomPageFilterMenu';

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
  const [denseMode, setDenseMode] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(false);
  const [excludeUsername, setExcludeUsername] = useState('');

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDenseModePreference = localStorage.getItem('randomPages_denseMode');
      if (savedDenseModePreference === 'true') {
        setDenseMode(true);
      }

      const savedExcludeOwnPreference = localStorage.getItem('randomPages_excludeOwnPages');
      if (savedExcludeOwnPreference === 'true') {
        setExcludeOwnPages(true);
      }

      const savedExcludeUsername = localStorage.getItem('randomPages_excludeUsername') || '';
      setExcludeUsername(savedExcludeUsername);
    }
  }, []);

  // Handle dense mode toggle change
  const handleDenseModeToggle = () => {
    const newValue = !denseMode;
    setDenseMode(newValue);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_denseMode', String(newValue));
    }

    // Trigger display mode change event
    const denseModeEvent = new CustomEvent('randomPagesDenseModeChange', {
      detail: { denseMode: newValue }
    });
    window.dispatchEvent(denseModeEvent);
  };

  // Handle "Not mine" toggle change
  const handleExcludeOwnToggle = () => {
    const newValue = !excludeOwnPages;
    setExcludeOwnPages(newValue);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_excludeOwnPages', String(newValue));
    }

    // Trigger shuffle with new filter setting
    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: {
        includePrivate: false,
        excludeOwnPages: newValue
      }
    });
    window.dispatchEvent(shuffleEvent);
  };

  // Handle shuffle button click
  const handleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: {
        includePrivate: false,
        excludeOwnPages: excludeOwnPages,
        excludeUsername: excludeUsername
      }
    });
    window.dispatchEvent(shuffleEvent);
  };

  const renderPrivacyMenu = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-2xl hover:bg-muted/80 transition-colors"
            aria-label="Random pages options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-72 p-3 z-[200000] text-foreground"
        >
          {/* Privacy and "Not mine" filters using reusable component */}

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleExcludeOwnToggle();
            }}
            className="flex items-center justify-between cursor-pointer py-4 px-3 rounded-lg hover:bg-muted/50 focus:bg-muted/50"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <UserX className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-sm">Not mine</span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Exclude pages you authored
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 ml-3">
              <Switch
                checked={excludeOwnPages}
                onCheckedChange={(checked) => {
                  if (checked !== excludeOwnPages) {
                    handleExcludeOwnToggle();
                  }
                }}
                aria-label="Toggle exclude own pages"
              />
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-2" />

          {/* Dense mode toggle - specific to random pages section */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleDenseModeToggle();
            }}
            className="flex items-center justify-between cursor-pointer py-4 px-3 rounded-lg hover:bg-muted/50 focus:bg-muted/50"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <Grid3X3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-sm">Dense Mode</span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Show only page titles as pill links
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 ml-3">
              <Switch
                checked={denseMode}
                onCheckedChange={(checked) => {
                  if (checked !== denseMode) {
                    handleDenseModeToggle();
                  }
                }}
                aria-label="Toggle dense mode"
              />
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-2" />

          <div className="p-2 space-y-2">
            <div className="text-sm font-medium text-foreground">Exclude username</div>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={excludeUsername}
              onChange={(e) => setExcludeUsername(e.target.value)}
              placeholder="Enter username"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleShuffle(e as any);
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof window !== 'undefined') {
                  localStorage.setItem('randomPages_excludeUsername', excludeUsername.trim());
                }
                const shuffleEvent = new CustomEvent('shuffleRandomPages', {
                  detail: {
                    includePrivate: false,
                    excludeOwnPages,
                    excludeUsername: excludeUsername.trim()
                  }
                });
                window.dispatchEvent(shuffleEvent);
              }}
            >
              Apply
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <SectionTitle
      title="Random Pages"
      rightContent={
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Shuffle Buttons - Responsive: text on desktop, icon-only on mobile */}
          <>
            {/* Desktop: Button with text and icon */}
            <Button
              variant="secondary"
              onClick={handleShuffle}
              className="hidden sm:flex items-center gap-2 rounded-2xl h-8 px-3"
            >
              <Shuffle className="h-4 w-4" />
              <span className="hidden md:inline">Shuffle</span>
            </Button>

            {/* Mobile: Icon-only button */}
            <Button
              variant="secondary"
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
