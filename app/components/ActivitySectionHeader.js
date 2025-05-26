"use client";

import React, { useContext, useEffect, useState } from 'react';
import { Clock, Filter, Check } from 'lucide-react';
import { SectionTitle } from './ui/section-title';
import { useActivityFilter } from '../contexts/ActivityFilterContext';
import { AuthContext } from '../providers/AuthProvider';
import { getFollowedPages } from '../firebase/follows';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

/**
 * ActivitySectionHeader Component
 *
 * A header component that includes the section title and filter dropdown
 * for the Recent Activity section. This is specifically designed to work
 * with sticky headers while preserving all interactive functionality.
 */
const ActivitySectionHeader = () => {
  const { user } = useContext(AuthContext);
  const { viewMode, setViewMode } = useActivityFilter();
  const [followedPages, setFollowedPages] = useState([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);

  // Load followed pages when component mounts
  useEffect(() => {
    if (!user) return;

    const fetchFollowedPages = async () => {
      setIsLoadingFollows(true);
      try {
        const pages = await getFollowedPages(user.uid);
        setFollowedPages(pages || []);
      } catch (error) {
        console.error('Error fetching followed pages:', error);
        // If there's an error fetching followed pages and we're in following mode, switch to all
        if (viewMode === 'following') {
          console.log('Error fetching followed pages, switching to "all" view mode');
          setViewMode('all');
        }
      } finally {
        setIsLoadingFollows(false);
      }
    };

    fetchFollowedPages();
  }, [user, viewMode, setViewMode]);

  // Function to render the filter dropdown button
  const renderFilterDropdown = () => {
    if (!user) return null;

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
                    className={`gap-2 h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors ${
                      viewMode === 'following' ? 'border-primary text-primary' : ''
                    }`}
                    aria-label={`Filter activity: ${viewMode === 'all' ? 'All' : 'Following'}`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {viewMode === 'all' ? 'All' : 'Following'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Filter activity feed</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Setting view mode to all');
                  setViewMode('all');
                }}
                className="flex items-center justify-between cursor-pointer"
              >
                <span>All</span>
                {viewMode === 'all' && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isLoadingFollows && followedPages.length > 0) {
                    console.log('Setting view mode to following');
                    setViewMode('following');
                  } else if (isLoadingFollows) {
                    console.log('Cannot switch to following mode while loading follows');
                  } else {
                    console.log('Cannot switch to following mode with no followed pages');
                  }
                }}
                className="flex items-center justify-between cursor-pointer"
                disabled={isLoadingFollows || followedPages.length === 0}
              >
                <div className="flex items-center">
                  <span className={isLoadingFollows || followedPages.length === 0 ? 'text-muted-foreground' : ''}>
                    Following
                  </span>
                  {followedPages.length === 0 && !isLoadingFollows && (
                    <span className="text-xs text-muted-foreground ml-1">(0)</span>
                  )}
                </div>
                {viewMode === 'following' && !isLoadingFollows && <Check className="h-4 w-4 ml-2" />}
                {isLoadingFollows && (
                  <div className="h-4 w-4 ml-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                )}
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
      title="Recent Activity"
      rightContent={renderFilterDropdown()}
    />
  );
};

export default ActivitySectionHeader;
