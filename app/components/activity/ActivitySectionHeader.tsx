"use client";

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '../ui/section-title';
import { useActivityFilter } from '../../contexts/ActivityFilterContext';
import { useAuth } from '../../providers/AuthProvider';
import { getFollowedPages } from '../../firebase/follows';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from '../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger} from '../ui/tooltip';

/**
 * ActivitySectionHeader Component
 *
 * A header component that includes the section title and filter dropdown
 * for the Recent Edits section. This is specifically designed to work
 * with sticky headers while preserving all interactive functionality.
 */
const ActivitySectionHeader = () => {
  const { user } = useAuth();
  const { viewMode, setViewMode } = useActivityFilter();
  const [followedPages, setFollowedPages] = useState([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);

  // Load followed pages when component mounts
  useEffect(() => {
    if (!user) return;

    const fetchFollowedPages = async () => {
      setIsLoadingFollows(true);
      try {
        const response = await fetch('/api/followed-pages');
        if (!response.ok) {
          throw new Error(`Failed to fetch followed pages: ${response.status}`);
        }
        const data = await response.json();
        const pages = data.followedPages || [];
        setFollowedPages(pages);
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
  }, [, user, viewMode, setViewMode]);

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
                    variant="secondary"
                    size="sm"
                    className={`gap-2 h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors ${
                      viewMode === 'following' || viewMode === 'mine' ? 'border-primary text-primary' : ''
                    }`}
                    aria-label={`Filter activity: ${viewMode === 'all' ? 'All' : viewMode === 'following' ? 'Following' : 'Mine'}`}
                  >
                    <Icon name="Filter" size={16} />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {viewMode === 'all' ? 'All' : viewMode === 'following' ? 'Following' : 'Mine'}
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
                {viewMode === 'all' && <Icon name="Check" size={16} className="ml-2" />}
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
                {viewMode === 'following' && !isLoadingFollows && <Icon name="Check" size={16} className="ml-2" />}
                {isLoadingFollows && (
                  <Icon name="Loader" size={16} className="ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Setting view mode to mine');
                  setViewMode('mine');
                }}
                className="flex items-center justify-between cursor-pointer"
              >
                <span>Mine</span>
                {viewMode === 'mine' && <Icon name="Check" size={16} className="ml-2" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <SectionTitle
      icon="Clock"
      title="Recent Edits"
      rightContent={renderFilterDropdown()}
    />
  );
};

export default ActivitySectionHeader;