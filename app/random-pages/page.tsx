"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import RandomPages from '../components/features/RandomPages';
import RandomPagesFilterDrawer from '../components/features/RandomPagesFilterDrawer';
import { Button } from '../components/ui/button';
import { RandomPagesSkeleton } from '../components/ui/skeleton-loaders';
import { useFeatureFlags } from '../contexts/FeatureFlagContext';
import { toast } from '../components/ui/use-toast';
import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTrigger,
} from '../components/ui/segmented-control';

/**
 * Random Pages Full Page Experience
 * 
 * Dedicated page for discovering random pages with enhanced functionality:
 * - Full page layout with header
 * - Enhanced random pages component with more results
 * - Filter controls and settings
 * - Better discovery experience
 */
export default function RandomPagesPage() {
  const { user, isAuthenticated } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const lineFeaturesEnabled = isEnabled('line_numbers');
  const [mounted, setMounted] = useState(false);
  // View mode: 'cards' (default) or 'list' (dense wrapped pills)
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('randomPages_viewMode');
      return saved === 'list' ? 'list' : 'cards';
    }
    return 'cards';
  });
  const [denseMode, setDenseMode] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('randomPages_excludeOwnPages') === 'true';
    }
    return false;
  });
  const [excludeUsername, setExcludeUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('randomPages_excludeUsername') || '';
    }
    return '';
  });
  const [includeUsername, setIncludeUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('randomPages_includeUsername') || '';
    }
    return '';
  });
  const [filterMode, setFilterMode] = useState<'exclude' | 'include'>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('randomPages_filterMode');
      return savedMode === 'include' ? 'include' : 'exclude';
    }
    return 'exclude';
  });

  const handleUsernameChange = (value: string) => {
    if (filterMode === 'include') {
      setIncludeUsername(value);
    } else {
      setExcludeUsername(value);
    }
  };

  useEffect(() => {
    setMounted(true);

    // Load preferences from localStorage on mount
    if (typeof window !== 'undefined') {
      // Load view mode and sync with denseMode
      const savedViewMode = localStorage.getItem('randomPages_viewMode');
      if (savedViewMode === 'list') {
        setViewMode('list');
        setDenseMode(true);
      }

      const savedExcludeUsername = localStorage.getItem('randomPages_excludeUsername') || '';
      setExcludeUsername(savedExcludeUsername);

      // Note: excludeOwnPages is already initialized from localStorage in useState
      // No need to set it again here to avoid double state updates
    }
  }, []);

  // Handle view mode change from segmented controller
  const handleViewModeChange = (mode: string) => {
    const newMode = mode as 'cards' | 'list';
    setViewMode(newMode);
    const newDenseMode = newMode === 'list';
    setDenseMode(newDenseMode);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_viewMode', newMode);
      localStorage.setItem('randomPages_denseMode', String(newDenseMode));
    }

    // Trigger display mode change event for RandomPages component
    const denseModeEvent = new CustomEvent('randomPagesDenseModeChange', {
      detail: { denseMode: newDenseMode }
    });
    window.dispatchEvent(denseModeEvent);
  };

  // Handle dense mode toggle change (kept for filter drawer compatibility)
  const handleDenseModeToggle = () => {
    if (!lineFeaturesEnabled) return;
    const newDenseMode = !denseMode;
    const newViewMode = newDenseMode ? 'list' : 'cards';
    setDenseMode(newDenseMode);
    setViewMode(newViewMode);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_denseMode', String(newDenseMode));
      localStorage.setItem('randomPages_viewMode', newViewMode);
    }

    // Trigger display mode change event
    const denseModeEvent = new CustomEvent('randomPagesDenseModeChange', {
      detail: { denseMode: newDenseMode }
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
        excludeOwnPages: newValue,
        excludeUsername
      }
    });
    window.dispatchEvent(shuffleEvent);
  };

  const handleFilterModeChange = (mode: 'exclude' | 'include') => {
    setFilterMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_filterMode', mode);
    }
  };

  const applyUsernameFilter = () => {
    const trimmedExclude = excludeUsername.trim();
    const trimmedInclude = includeUsername.trim();

    if (filterMode === 'include') {
      setIncludeUsername(trimmedInclude);
      if (typeof window !== 'undefined') {
        localStorage.setItem('randomPages_includeUsername', trimmedInclude);
        localStorage.setItem('randomPages_filterMode', 'include');
      }
      const shuffleEvent = new CustomEvent('shuffleRandomPages', {
        detail: {
          includePrivate: false,
          excludeOwnPages,
          excludeUsername: '',
          includeUsername: trimmedInclude
        }
      });
      window.dispatchEvent(shuffleEvent);
      return;
    }

    setExcludeUsername(trimmedExclude);
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_excludeUsername', trimmedExclude);
      localStorage.setItem('randomPages_filterMode', 'exclude');
    }
    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: {
        includePrivate: false,
        excludeOwnPages,
        excludeUsername: trimmedExclude,
        includeUsername: ''
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
        excludeUsername: filterMode === 'exclude' ? excludeUsername : '',
        includeUsername: filterMode === 'include' ? includeUsername : ''
      }
    });
    window.dispatchEvent(shuffleEvent);
  };

  // Handle excluding a user directly from a page card
  const handleExcludeUser = (username: string) => {
    // Set the filter mode to exclude and update the username
    setFilterMode('exclude');
    setExcludeUsername(username);
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_excludeUsername', username);
      localStorage.setItem('randomPages_filterMode', 'exclude');
    }

    // Show toast notification
    toast({
      title: "User filtered out",
      description: `Pages by ${username} will be excluded from results`,
    });

    // Trigger shuffle with new filter
    const shuffleEvent = new CustomEvent('shuffleRandomPages', {
      detail: {
        includePrivate: false,
        excludeOwnPages: excludeOwnPages,
        excludeUsername: username,
        includeUsername: ''
      }
    });
    window.dispatchEvent(shuffleEvent);
  };

  // Show progressive loading state during hydration
  if (!mounted) {
    return (
      <NavPageLayout loading={true} loadingFallback={
        <div>
          {/* Page header skeleton */}
          <div className="text-center mb-8">
            <div className="h-10 w-48 bg-muted rounded-md mx-auto mb-4 animate-pulse" />
            <div className="h-6 w-96 bg-muted rounded-md mx-auto animate-pulse" />
          </div>

          {/* Controls skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="h-8 w-20 bg-muted rounded-2xl animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded-2xl animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-muted rounded-2xl animate-pulse" />
          </div>

          {/* Content skeleton */}
          <div className="min-h-[600px]">
            <RandomPagesSkeleton limit={20} />
          </div>
        </div>
      } />
    );
  }

  return (
    <NavPageLayout>
      {/* Page Header with Controls */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Random Pages</h1>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Mode Segmented Control */}
            <SegmentedControl value={viewMode} onValueChange={handleViewModeChange}>
              <SegmentedControlList className="h-8 w-[120px]">
                <SegmentedControlTrigger value="cards" className="text-xs px-2">
                  <Icon name="Grid3X3" size={14} className="mr-1" />
                  Cards
                </SegmentedControlTrigger>
                <SegmentedControlTrigger value="list" className="text-xs px-2">
                  <Icon name="List" size={14} className="mr-1" />
                  List
                </SegmentedControlTrigger>
              </SegmentedControlList>
            </SegmentedControl>

            {/* Shuffle Button */}
            <Button
              variant="secondary"
              onClick={handleShuffle}
              className="flex items-center gap-2 rounded-2xl h-8 px-3"
            >
              <Icon name="Shuffle" size={16} />
              <span className="hidden sm:inline">Shuffle</span>
            </Button>

            {/* Filter Drawer/Modal */}
            <RandomPagesFilterDrawer
              excludeOwnPages={excludeOwnPages}
              onExcludeOwnToggle={handleExcludeOwnToggle}
              denseMode={denseMode}
              onDenseModeToggle={handleDenseModeToggle}
              lineFeaturesEnabled={lineFeaturesEnabled}
              filterMode={filterMode}
              onFilterModeChange={handleFilterModeChange}
              excludeUsername={excludeUsername}
              includeUsername={includeUsername}
              onUsernameChange={handleUsernameChange}
              onApplyFilter={applyUsernameFilter}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-lg">
          Discover interesting content from across WeWrite. Find new pages, authors, and ideas.
        </p>
      </div>

      {/* Random Pages Content */}
      <div className="min-h-[600px]">
        <RandomPages 
          limit={20} 
          priority="high" 
          onExcludeUser={handleExcludeUser}
        />
      </div>

      {/* Additional Info */}
      <div className="mt-12 p-6 bg-muted/30 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">About Random Pages</h2>
        <div className="space-y-2 text-muted-foreground">
          <p>
            Random pages help you discover content you might not have found otherwise. 
            Each shuffle brings you a fresh selection of pages from across the platform.
          </p>
          <p>
            Use the filters to customize your discovery experience - exclude your own pages 
            to find content from other creators, or adjust the view mode for different layouts.
          </p>
        </div>
      </div>
    </NavPageLayout>
  );
}
