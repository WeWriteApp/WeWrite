"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import Header from '../components/layout/Header';
import RandomPages from '../components/features/RandomPages';
import { Shuffle, MoreHorizontal, Grid3X3, UserX } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../components/ui/dropdown-menu';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import { RandomPagesSkeleton } from '../components/ui/skeleton-loaders';

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
  const [mounted, setMounted] = useState(false);
  const [denseMode, setDenseMode] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem('randomPages_excludeOwnPages') === 'true';
    }
    return false;
  });

  useEffect(() => {
    setMounted(true);

    // Load preferences from localStorage on mount
    if (typeof window !== 'undefined') {
      const savedDenseModePreference = localStorage.getItem('randomPages_denseMode');
      if (savedDenseModePreference === 'true') {
        setDenseMode(true);
      }

      // Note: excludeOwnPages is already initialized from localStorage in useState
      // No need to set it again here to avoid double state updates
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
        excludeOwnPages: excludeOwnPages
      }
    });
    window.dispatchEvent(shuffleEvent);
  };

  // Show progressive loading state during hydration - show page structure immediately
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        {/* Show page structure immediately */}
        <div className="p-5 md:p-4">
          {/* Navigation header skeleton */}
          <div className="flex items-center mb-6">
            <div className="flex-1">
              <div className="h-9 w-20 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="flex-1 flex justify-end">
              <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
            </div>
          </div>

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
      </div>
    );
  }

  // Render mobile filter menu
  const renderMobileFilterMenu = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-2xl hover:bg-muted/80 transition-colors md:hidden"
            aria-label="Random pages options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-2 min-w-80" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleExcludeOwnToggle();
            }}
            className="flex items-center justify-between cursor-pointer py-4 px-3 rounded-lg hover:bg-muted/50 focus:bg-muted/50 text-left"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                <UserX className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-medium text-sm whitespace-nowrap">Not mine</span>
                <span className="text-xs text-muted-foreground leading-relaxed whitespace-nowrap">
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

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleDenseModeToggle();
            }}
            className="flex items-center justify-between cursor-pointer py-4 px-3 rounded-lg hover:bg-muted/50 focus:bg-muted/50 text-left"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                <Grid3X3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-medium text-sm whitespace-nowrap">Dense Mode</span>
                <span className="text-xs text-muted-foreground leading-relaxed whitespace-nowrap">
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
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main content area */}
      <main className="transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 py-6">
          {/* Page Header with Controls */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">Random Pages</h1>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Desktop Filter Toggles */}
                <div className="hidden md:flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Not mine</span>
                    <Switch
                      checked={excludeOwnPages}
                      onCheckedChange={handleExcludeOwnToggle}
                      aria-label="Toggle exclude own pages"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Dense Mode</span>
                    <Switch
                      checked={denseMode}
                      onCheckedChange={handleDenseModeToggle}
                      aria-label="Toggle dense mode"
                    />
                  </div>
                </div>

                {/* Shuffle Button */}
                <Button
                  variant="outline"
                  onClick={handleShuffle}
                  className="flex items-center gap-2 rounded-2xl h-8 px-3"
                >
                  <Shuffle className="h-4 w-4" />
                  <span className="hidden sm:inline">Shuffle</span>
                </Button>

                {/* Mobile Filter Menu */}
                {renderMobileFilterMenu()}
              </div>
            </div>

            <p className="text-muted-foreground text-lg">
              Discover interesting content from across WeWrite. Find new pages, authors, and ideas.
            </p>
          </div>

          {/* Random Pages Content */}
          <div className="min-h-[600px]">
            <RandomPages limit={20} priority="high" />
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
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
