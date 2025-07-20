"use client";

import React, { useState, useEffect } from 'react';
import { Clock, Filter } from 'lucide-react';
import { SectionTitle } from '../ui/section-title';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface RecentEditsHeaderProps {
  currentViewMode: 'all' | 'following';
  hideMyEdits: boolean;
  onViewModeChange: (mode: 'all' | 'following') => void;
  onHideMyEditsChange: (hide: boolean) => void;
  isLoadingFollows?: boolean;
}

/**
 * RecentEditsHeader Component
 *
 * A header component specifically for the Recent Edits section that includes
 * the section title and filter dropdown with "Hide my own edits" functionality.
 */
export default function RecentEditsHeader({
  currentViewMode,
  hideMyEdits,
  onViewModeChange,
  onHideMyEditsChange,
  isLoadingFollows = false
}: RecentEditsHeaderProps) {
  const { currentAccount } = useCurrentAccount();

  const getFilterButtonText = () => {
    if (currentViewMode === 'following') {
      return hideMyEdits ? 'Following (Not Mine)' : 'Following';
    } else {
      return hideMyEdits ? 'All (Not Mine)' : 'All Recent Edits';
    }
  };

  const renderFilterDropdown = () => {
    if (!currentAccount) return null;

    return (
      <div>
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors"
                    aria-label={`Filter edits: ${getFilterButtonText()}`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {getFilterButtonText()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter edits: {getFilterButtonText()}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onViewModeChange('all')}
                className={currentViewMode === 'all' ? 'bg-muted' : ''}
              >
                All Recent Edits
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onViewModeChange('following')}
                className={currentViewMode === 'following' ? 'bg-muted' : ''}
                disabled={isLoadingFollows}
              >
                Following
              </DropdownMenuItem>
              <div className="border-t border-border my-1" />
              <DropdownMenuItem
                onClick={() => onHideMyEditsChange(!hideMyEdits)}
                className="flex items-center justify-between"
              >
                <span>Hide my own edits</span>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  hideMyEdits ? 'bg-primary border-primary' : 'border-muted-foreground'
                }`}>
                  {hideMyEdits && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <SectionTitle
      icon={Clock}
      title="Recent Edits"
    >
      {renderFilterDropdown()}
    </SectionTitle>
  );
}
