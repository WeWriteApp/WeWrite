'use client';

import React from 'react';
import { Activity, Filter } from 'lucide-react';
import { SectionTitle } from '../ui/section-title';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useActivityFilter, ActivityViewMode } from '../../contexts/ActivityFilterContext';

/**
 * RecentActivityHeader Component
 *
 * Header component for the Recent Activity section that includes:
 * - Section title with activity icon
 * - Filter dropdown menu with view mode options (All, Following, Mine)
 * - Integrated into the sticky section header
 */
const RecentActivityHeader = () => {
  const { viewMode, setViewMode } = useActivityFilter();

  // Handle view mode change
  const handleViewModeChange = (newMode: ActivityViewMode) => {
    console.log(`RecentActivityHeader: Changing view mode to ${newMode}`);
    setViewMode(newMode);
  };

  // Get display text for current view mode
  const getViewModeDisplayText = (mode: ActivityViewMode): string => {
    switch (mode) {
      case 'all':
        return 'All';
      case 'following':
        return 'Following';
      case 'mine':
        return 'Mine';
      default:
        return 'All';
    }
  };

  const renderFilterMenu = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors flex items-center gap-2"
            aria-label={`Filter activity: ${getViewModeDisplayText(viewMode)}`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{getViewModeDisplayText(viewMode)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => handleViewModeChange('all')}
            className={`cursor-pointer ${viewMode === 'all' ? 'bg-muted' : ''}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">All Activity</span>
              <span className="text-xs text-muted-foreground">
                Show all recent page activity
              </span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => handleViewModeChange('following')}
            className={`cursor-pointer ${viewMode === 'following' ? 'bg-muted' : ''}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">Following</span>
              <span className="text-xs text-muted-foreground">
                Only pages you follow
              </span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => handleViewModeChange('mine')}
            className={`cursor-pointer ${viewMode === 'mine' ? 'bg-muted' : ''}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">My Activity</span>
              <span className="text-xs text-muted-foreground">
                Only your page edits
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <SectionTitle
      icon={Activity}
      title="Recent Activity"
      rightContent={
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderFilterMenu()}
        </div>
      }
    />
  );
};

export default RecentActivityHeader;
