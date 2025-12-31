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
  // View mode: 'cards' (detailed), 'list' (dense wrapped pills), or 'graph' (3D graph cards)
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'graph'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('randomPages_viewMode');
      if (saved === 'list' || saved === 'graph') return saved;
      return 'cards';
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
    const newMode = mode as 'cards' | 'list' | 'graph';
    setViewMode(newMode);
    const newDenseMode = newMode === 'list';
    setDenseMode(newDenseMode);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_viewMode', newMode);
      localStorage.setItem('randomPages_denseMode', String(newDenseMode));
    }

    // Trigger display mode change event for RandomPages component
    const viewModeEvent = new CustomEvent('randomPagesViewModeChange', {
      detail: { viewMode: newMode, denseMode: newDenseMode }
    });
    window.dispatchEvent(viewModeEvent);

    // Also dispatch legacy event for backwards compatibility
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

          {/* Desktop Controls */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {/* View Mode Segmented Control */}
            <SegmentedControl value={viewMode} onValueChange={handleViewModeChange}>
              <SegmentedControlList className="h-9">
                <SegmentedControlTrigger value="cards" className="text-xs px-3 gap-1.5">
                  <Icon name="Square" size={14} />
                  <span>Detailed</span>
                </SegmentedControlTrigger>
                <SegmentedControlTrigger value="list" className="text-xs px-3 gap-1.5">
                  <Icon name="LayoutGrid" size={14} />
                  <span>Dense</span>
                </SegmentedControlTrigger>
                <SegmentedControlTrigger value="graph" className="text-xs px-3 gap-1.5">
                  <Icon name="Network" size={14} />
                  <span>Graph</span>
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
              <span>Shuffle</span>
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

          {/* Mobile: Only filter and shuffle buttons in header */}
          <div className="flex sm:hidden items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleShuffle}
              className="flex items-center gap-2 rounded-2xl h-8 px-3"
            >
              <Icon name="Shuffle" size={16} />
            </Button>
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

        {/* Mobile: Full-width View Mode Switcher */}
        <div className="sm:hidden">
          <SegmentedControl value={viewMode} onValueChange={handleViewModeChange} className="w-full">
            <SegmentedControlList className="h-10 w-full grid grid-cols-3">
              <SegmentedControlTrigger value="cards" className="text-sm gap-1.5">
                <Icon name="Square" size={16} />
                Detailed
              </SegmentedControlTrigger>
              <SegmentedControlTrigger value="list" className="text-sm gap-1.5">
                <Icon name="LayoutGrid" size={16} />
                Dense
              </SegmentedControlTrigger>
              <SegmentedControlTrigger value="graph" className="text-sm gap-1.5">
                <Icon name="Network" size={16} />
                Graph
              </SegmentedControlTrigger>
            </SegmentedControlList>
          </SegmentedControl>
        </div>
      </div>

      {/* Random Pages Content */}
      <div className="min-h-[600px]">
        <RandomPages
          limit={20}
          priority="high"
          onExcludeUser={handleExcludeUser}
        />
      </div>
    </NavPageLayout>
  );
}
