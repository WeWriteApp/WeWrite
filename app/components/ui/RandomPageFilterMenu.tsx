"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from './button';
import { Switch } from './switch';
import { Input } from './input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
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
  const [excludeUsername, setExcludeUsername] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedExcludeOwnPreference = localStorage.getItem('randomPages_excludeOwnPages');
      if (savedExcludeOwnPreference === 'true') {
        setExcludeOwnPages(true);
      }
      const savedExcludeUsername = localStorage.getItem('randomPages_excludeUsername') || '';
      setExcludeUsername(savedExcludeUsername);
    }
  }, []);

  const handleApplyFilters = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('randomPages_excludeUsername', excludeUsername.trim());
      localStorage.setItem('randomPages_excludeOwnPages', String(excludeOwnPages));
    }

    if (onFiltersChange) {
      onFiltersChange({
        includePrivate: false,
        excludeOwnPages,
        excludeUsername: excludeUsername.trim()
      });
    }
    setIsFilterModalOpen(false);
  };

  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`${buttonSize} rounded-2xl hover:bg-muted/80 transition-colors opacity-0 group-hover:opacity-100 ${className}`}
            aria-label="Random page filter options"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="MoreHorizontal" className={iconSize} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60 p-2 bg-background border border-border shadow-xl"
        >
          <DropdownMenuItem
            className="flex items-center gap-3 cursor-pointer py-3 px-3 rounded-lg hover:bg-muted/50 focus:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation();
              setIsFilterModalOpen(true);
            }}
          >
            <Icon name="Filter" size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Icon name="UserX" size={16} className="text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Not mine</div>
                  <div className="text-xs text-muted-foreground">Exclude pages you authored</div>
                </div>
              </div>
              <Switch
                checked={excludeOwnPages}
                onCheckedChange={(checked) => {
                  setExcludeOwnPages(checked);
                }}
                aria-label="Toggle exclude own pages"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Filter by username</div>
              <Input
                value={excludeUsername}
                onChange={(e) => setExcludeUsername(e.target.value)}
                placeholder="Search username to exclude"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyFilters();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Results will exclude this user’s pages. Leave blank to include all.
              </p>
            </div>

            <Button className="w-full" onClick={handleApplyFilters}>
              Apply filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RandomPageFilterMenu;
