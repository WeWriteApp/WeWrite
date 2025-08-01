"use client";

import React, { useState, useEffect } from 'react';
import { MoreHorizontal, UserX } from 'lucide-react';
import { Button } from './button';
import { Switch } from './switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator} from './dropdown-menu';
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
  const [excludeOwnPages, setExcludeOwnPages] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedExcludeOwnPreference = localStorage.getItem('randomPages_excludeOwnPages');
      if (savedExcludeOwnPreference === 'true') {
        setExcludeOwnPages(true);
      }
    }
  }, []);

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
        includePrivate: false,
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
      <DropdownMenuContent align="end" className="w-72 p-2">

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RandomPageFilterMenu;