"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '../ui/drawer';
import { MoreHorizontal, UserX, Grid3X3, Search, X, Check, Loader2 } from 'lucide-react';

interface UserSuggestion {
  id: string;
  username: string;
  photoURL?: string;
}

interface RandomPagesFilterDrawerProps {
  excludeOwnPages: boolean;
  onExcludeOwnToggle: () => void;
  denseMode: boolean;
  onDenseModeToggle: () => void;
  lineFeaturesEnabled: boolean;
  filterMode: 'exclude' | 'include';
  onFilterModeChange: (mode: 'exclude' | 'include') => void;
  excludeUsername: string;
  includeUsername: string;
  onUsernameChange: (value: string) => void;
  onApplyFilter: () => void;
}

/**
 * RandomPagesFilterDrawer - Filter UI for random pages
 * Uses bottom drawer with consistent styling
 * Includes typeahead username search
 */
export default function RandomPagesFilterDrawer({
  excludeOwnPages,
  onExcludeOwnToggle,
  denseMode,
  onDenseModeToggle,
  lineFeaturesEnabled,
  filterMode,
  onFilterModeChange,
  excludeUsername,
  includeUsername,
  onUsernameChange,
  onApplyFilter,
}: RandomPagesFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentUsername = filterMode === 'include' ? includeUsername : excludeUsername;

  // Initialize search query from current username when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(currentUsername);
    }
  }, [isOpen, currentUsername]);

  // Debounced user search
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search-unified?q=${encodeURIComponent(query)}&includeUsers=true&includePages=false&limit=8`);
      if (response.ok) {
        const data = await response.json();
        const users = (data.users || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          photoURL: user.photoURL,
        }));
        setSuggestions(users);
        setShowSuggestions(users.length > 0);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (username: string) => {
    setSearchQuery(username);
    onUsernameChange(username);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Handle apply
  const handleApply = () => {
    onUsernameChange(searchQuery);
    onApplyFilter();
    setIsOpen(false);
  };

  // Handle clear username
  const handleClearUsername = () => {
    setSearchQuery('');
    onUsernameChange('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const filterContent = (
    <div className="space-y-6">
      {/* Not Mine Toggle */}
      <div
        className="flex items-center justify-between cursor-pointer py-3 px-1 rounded-lg hover:bg-muted/50"
        onClick={onExcludeOwnToggle}
      >
        <div className="flex items-center gap-3">
          <UserX className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-medium text-sm">Not mine</span>
            <span className="text-xs text-muted-foreground">
              Exclude pages you authored
            </span>
          </div>
        </div>
        <Switch
          checked={excludeOwnPages}
          onCheckedChange={onExcludeOwnToggle}
          aria-label="Toggle exclude own pages"
        />
      </div>

      {/* Dense Mode Toggle (if enabled) */}
      {lineFeaturesEnabled && (
        <div
          className="flex items-center justify-between cursor-pointer py-3 px-1 rounded-lg hover:bg-muted/50"
          onClick={onDenseModeToggle}
        >
          <div className="flex items-center gap-3">
            <Grid3X3 className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium text-sm">Dense Mode</span>
              <span className="text-xs text-muted-foreground">
                Show only page titles as pill links
              </span>
            </div>
          </div>
          <Switch
            checked={denseMode}
            onCheckedChange={onDenseModeToggle}
            aria-label="Toggle dense mode"
          />
        </div>
      )}

      <div className="h-px bg-border" />

      {/* Username Filter Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">Filter by username</span>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={filterMode === 'exclude' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onFilterModeChange('exclude')}
            >
              Exclude
            </Button>
            <Button
              variant={filterMode === 'include' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onFilterModeChange('include')}
            >
              Include
            </Button>
          </div>
        </div>

        {/* Username Search with Typeahead */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={filterMode === 'include' ? 'Search username to include...' : 'Search username to exclude...'}
              className="pl-9 pr-9"
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApply();
                }
                if (e.key === 'Escape') {
                  setShowSuggestions(false);
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={handleClearUsername}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {isSearching && (
              <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((user) => (
                <button
                  key={user.id}
                  className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                  onClick={() => handleSelectSuggestion(user.username)}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.username}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{user.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {currentUsername && (
          <p className="text-xs text-muted-foreground">
            Currently {filterMode === 'include' ? 'including' : 'excluding'}: <span className="font-medium text-foreground">{currentUsername}</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-2xl border border-border"
        aria-label="Filter options"
        onClick={() => setIsOpen(true)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent height="auto">
          <DrawerHeader className="text-center">
            <DrawerTitle>Filter Random Pages</DrawerTitle>
            <DrawerDescription>
              Customize your random page discovery experience
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 px-4 pb-4 overflow-y-auto">
            {filterContent}
          </div>

          <DrawerFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleApply}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
