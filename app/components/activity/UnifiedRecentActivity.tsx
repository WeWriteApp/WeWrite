'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Clock, Eye, Edit, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import ActivityCard from './ActivityCard';
import { useUnifiedActivity, useRecentEdits, ActivityFilters } from '../../hooks/useUnifiedActivity';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
// import { getFollowedPages } from '../../firebase/follows'; // Not needed in this component

interface UnifiedRecentActivityProps {
  mode?: 'edits' | 'pages' | 'all';
  limit?: number;
  showFilters?: boolean;
  isCarousel?: boolean;
  followedPageIds?: string[];
  className?: string;
  title?: string;
  emptyMessage?: string;
}

/**
 * Unified Recent Activity Component
 * 
 * Replaces:
 * - RecentEdits.tsx
 * - RecentPagesActivity.tsx
 * - RecentEditsHeader.tsx
 * 
 * Features:
 * - Single data source via useUnifiedActivity
 * - Consistent filtering across all modes
 * - Unified caching and performance
 * - Flexible display modes
 */
export default function UnifiedRecentActivity({
  mode = 'all',
  limit = 20,
  showFilters = true,
  isCarousel = false,
  followedPageIds = [],
  className = '',
  title,
  emptyMessage
}: UnifiedRecentActivityProps) {
  const router = useRouter();
  const { currentAccount } = useCurrentAccount();
  
  // Use appropriate hook based on mode
  const activityHook = mode === 'edits' 
    ? useRecentEdits({ limit, followedPageIds })
    : useUnifiedActivity({ 
        limit, 
        followedPageIds,
        initialFilters: { 
          type: mode === 'pages' ? 'pages' : 'all',
          includeOwn: mode !== 'edits', // Hide own edits for edits mode
          followingOnly: false 
        }
      });

  const { activities, loading, error, filters, setFilters, refresh, metadata } = activityHook;

  // Get display title
  const getTitle = () => {
    if (title) return title;
    
    switch (mode) {
      case 'edits': return 'Recent Edits';
      case 'pages': return 'Recent Pages';
      default: return 'Recent Activity';
    }
  };

  // Get empty message
  const getEmptyMessage = () => {
    if (emptyMessage) return emptyMessage;
    
    if (filters.followingOnly) {
      return "No recent activity from pages you follow";
    }
    
    if (!filters.includeOwn) {
      return "No recent activity by others";
    }
    
    switch (mode) {
      case 'edits': return "No recent edits";
      case 'pages': return "No recent pages";
      default: return "No recent activity";
    }
  };

  // Filter button text
  const getFilterButtonText = () => {
    const parts = [];
    
    if (filters.followingOnly) {
      parts.push('Following');
    } else {
      parts.push('All');
    }
    
    if (!filters.includeOwn) {
      parts.push('(Not Mine)');
    }
    
    return parts.join(' ');
  };

  // Render filter dropdown
  const renderFilterDropdown = () => {
    if (!showFilters || !currentAccount) return null;

    return (
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors ${
                    filters.followingOnly || !filters.includeOwn ? 'border-primary text-primary' : ''
                  }`}
                  aria-label={`Filter: ${getFilterButtonText()}`}
                >
                  <Filter className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only md:inline-block">
                    {getFilterButtonText()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filter activity</p>
            </TooltipContent>
          </Tooltip>
          
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => setFilters({ followingOnly: false })}
              className={!filters.followingOnly ? 'bg-muted' : ''}
            >
              <Eye className="h-4 w-4 mr-2" />
              All Recent Activity
            </DropdownMenuItem>
            
            <DropdownMenuItem
              onClick={() => setFilters({ followingOnly: true })}
              className={filters.followingOnly ? 'bg-muted' : ''}
            >
              <Edit className="h-4 w-4 mr-2" />
              Following Only
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuCheckboxItem
              checked={!filters.includeOwn}
              onCheckedChange={(checked) => setFilters({ includeOwn: !checked })}
            >
              Hide my own activity
            </DropdownMenuCheckboxItem>
            
            {mode === 'all' && (
              <>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  onClick={() => setFilters({ type: 'all' })}
                  className={filters.type === 'all' ? 'bg-muted' : ''}
                >
                  All Activity
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => setFilters({ type: 'edits' })}
                  className={filters.type === 'edits' ? 'bg-muted' : ''}
                >
                  Edits Only
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => setFilters({ type: 'pages' })}
                  className={filters.type === 'pages' ? 'bg-muted' : ''}
                >
                  Pages Only
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );
  };

  // Render header
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{getTitle()}</h2>
        {metadata && (
          <span className="text-sm text-muted-foreground">
            ({metadata.total} items)
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {renderFilterDropdown()}
        
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="gap-2 h-8 px-3 rounded-2xl"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>
    </div>
  );

  // Loading state
  if (loading && activities.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showFilters && renderHeader()}
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
          <p className="text-muted-foreground">Loading activity...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showFilters && renderHeader()}
        <div className="text-center py-8">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Failed to load activity</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button onClick={refresh} variant="outline" className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {showFilters && renderHeader()}
        <div className="text-center py-8">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">{getEmptyMessage()}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Activity will appear here when users make changes
          </p>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className={`space-y-4 ${className}`}>
      {showFilters && renderHeader()}
      
      <div className={isCarousel ? 'flex gap-4 overflow-x-auto pb-4' : 'space-y-4'}>
        {activities.map((activity) => {
          // Transform API activity format to ActivityCard format
          const activityCardData = {
            pageId: activity.id,
            pageName: activity.title,
            userId: activity.userId,
            username: activity.username,
            displayName: activity.displayName,
            timestamp: activity.lastModified,
            lastModified: activity.lastModified,
            diff: activity.lastDiff,
            diffPreview: activity.lastDiff?.preview,
            isNewPage: !activity.lastDiff?.hasChanges,
            isPublic: activity.isPublic,
            totalPledged: activity.totalPledged,
            pledgeCount: activity.pledgeCount,
            activityType: activity.activityType === 'edit' ? 'page_edit' : 'page_creation'
          };

          return (
            <div key={activity.id} className={isCarousel ? 'flex-shrink-0 w-80' : ''}>
              <ActivityCard
                activity={activityCardData}
                isCarousel={isCarousel}
                compactLayout={isCarousel}
              />
            </div>
          );
        })}
      </div>
      
      {metadata?.hasMore && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => {/* TODO: Load more */}}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
