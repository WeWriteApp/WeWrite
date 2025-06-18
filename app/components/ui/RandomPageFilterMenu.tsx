"use client";

import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Lock, UserX } from 'lucide-react';
import { Button } from './button';
import { Switch } from './switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './dropdown-menu';
import { RandomPageFilters } from '../../utils/randomPageNavigation';

interface RandomPageFilterMenuProps {
  onFiltersChange?: (filters: RandomPageFilters) => void;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Reusable filter menu component for random page options
 * Used in both sidebar and random pages section
 */
export const RandomPageFilterMenu: React.FC<RandomPageFilterMenuProps> = ({
  onFiltersChange,
  onOpenChange,
  className = '',
  size = 'md'
}) => {
  const [includePrivatePages, setIncludePrivatePages] = useState(false);
  const [excludeOwnPages, setExcludeOwnPages] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrivacyPreference = localStorage.getItem('randomPages_includePrivate');
      if (savedPrivacyPreference === 'true') {
        setIncludePrivatePages(true);
      }

      const savedExcludeOwnPreference = localStorage.getItem('randomPages_excludeOwnPages');
      if (savedExcludeOwnPreference === 'true') {
        setExcludeOwnPages(true);
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

    // Notify parent component of filter changes
    if (onFiltersChange) {
      onFiltersChange({
        includePrivate: newValue,
        excludeOwnPages: excludeOwnPages
      });
    }
  };

  // Handle "Not mine" toggle change
  const handleExcludeOwnToggle = () => {
    const newValue = !excludeOwnPages;
    setExcludeOwnPages(newValue);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_excludeOwnPages', String(newValue));
    }

    // Notify parent component of filter changes
    if (onFiltersChange) {
      onFiltersChange({
        includePrivate: includePrivatePages,
        excludeOwnPages: newValue
      });
    }
  };

  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} rounded-2xl hover:bg-muted/80 transition-colors opacity-0 group-hover:opacity-100 ${className}`}
          aria-label="Random page filter options"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className={iconSize} />
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

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleExcludeOwnToggle();
          }}
          className="flex items-center justify-between cursor-pointer py-3"
        >
          <div className="flex items-center gap-3">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">Not mine</span>
              <span className="text-xs text-muted-foreground">
                Exclude pages you authored
              </span>
            </div>
          </div>
          <Switch
            checked={excludeOwnPages}
            onCheckedChange={(checked) => {
              if (checked !== excludeOwnPages) {
                handleExcludeOwnToggle();
              }
            }}
            aria-label="Toggle exclude own pages"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RandomPageFilterMenu;
