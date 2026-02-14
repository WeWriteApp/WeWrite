'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import RandomPageFilterMenu from '../ui/RandomPageFilterMenu';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';

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
  const { isEnabled } = useFeatureFlags();
  const lineFeaturesEnabled = isEnabled('line_numbers');
  const [denseMode, setDenseMode] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(false);
  const [excludeUsername, setExcludeUsername] = useState('');

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDenseModePreference = localStorage.getItem('randomPages_denseMode');
      if (lineFeaturesEnabled && savedDenseModePreference === 'true') {
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
    if (!lineFeaturesEnabled) return;
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

  const handleFiltersChange = (filters: { includePrivate?: boolean; excludeOwnPages?: boolean; excludeUsername?: string; }) => {
    setExcludeOwnPages(!!filters.excludeOwnPages);
    setExcludeUsername(filters.excludeUsername || '');

    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: {
        includePrivate: false,
        excludeOwnPages: !!filters.excludeOwnPages,
        excludeUsername: filters.excludeUsername || ''
      }
    });
    window.dispatchEvent(shuffleEvent);
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
              <Icon name="Shuffle" size={16} />
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
              <Icon name="Shuffle" size={16} />
            </Button>
          </>

          {/* Filters + Dense toggle */}
          <div className="flex items-center gap-2">
            <RandomPageFilterMenu
              onFiltersChange={handleFiltersChange}
              className="opacity-100"
              size="md"
            />
            {lineFeaturesEnabled && (
              <div className="flex items-center gap-2 rounded-2xl border border-border px-2 py-1 bg-background">
                <Switch
                  checked={denseMode}
                  onCheckedChange={handleDenseModeToggle}
                  aria-label="Toggle dense mode"
                />
                <span className="text-xs text-muted-foreground">Dense mode</span>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};

export default RandomPagesHeader;
