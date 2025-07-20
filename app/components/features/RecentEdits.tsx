'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Clock } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import ActivityCard from '../activity/ActivityCard';
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
import { getFollowedPages } from '../../firebase/follows';

interface RecentActivityProps {
  limit?: number;
  renderFilterInHeader?: boolean;
  isCarousel?: boolean;
  onFilterStateChange?: (state: {
    currentViewMode: 'all' | 'following';
    hideMyEdits: boolean;
    isLoadingFollows: boolean;
  }) => void;
  // External filter control props
  externalViewMode?: 'all' | 'following';
  externalHideMyEdits?: boolean;
  onExternalViewModeChange?: (mode: 'all' | 'following') => void;
  onExternalHideMyEditsChange?: (hide: boolean) => void;
}

interface ActivityData {
  pageId: string;
  pageName: string;
  userId: string;
  username: string;
  timestamp: Date;
  isPublic: boolean;
  isNewPage?: boolean;
  diff?: {
    added: number;
    removed: number;
    hasChanges: boolean;
  };
  diffPreview?: any;
  versionId?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
}

/**
 * RecentActivity Component (Recent EDITS)
 *
 * Displays recent page edits by fetching recently edited pages with their diff data.
 * This shows actual edits made to pages, not just recently visited pages.
 *
 * Features:
 * - Fetches recently edited pages from /api/home (recentlyVisitedPages with lastDiff data)
 * - Filters for pages that have meaningful changes (lastDiff.hasChanges)
 * - Supports filtering (All/Following) with "Hide my own edits" toggle
 * - Hides user's own edits by default
 * - Works in both carousel and grid layouts
 * - Shows actual diff data from page edits
 */
const RecentEdits = React.forwardRef<any, RecentActivityProps>(({
  limit = 8,
  renderFilterInHeader = false,
  isCarousel = true,
  onFilterStateChange,
  externalViewMode,
  externalHideMyEdits,
  onExternalViewModeChange,
  onExternalHideMyEditsChange
}, ref) => {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<'all' | 'following'>('all');
  const [internalHideMyEdits, setInternalHideMyEdits] = useState(true); // Hide own edits by default

  // Use external props if provided, otherwise use internal state
  const currentViewMode = externalViewMode ?? internalViewMode;
  const hideMyEdits = externalHideMyEdits ?? internalHideMyEdits;
  const setCurrentViewMode = onExternalViewModeChange ?? setInternalViewMode;
  const setHideMyEdits = onExternalHideMyEditsChange ?? setInternalHideMyEdits;

  // Load user preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !externalViewMode && !externalHideMyEdits) {
      try {
        const savedViewMode = localStorage.getItem('recentEdits_viewMode') as 'all' | 'following' | null;
        const savedHideMyEdits = localStorage.getItem('recentEdits_hideMyEdits');

        if (savedViewMode && (savedViewMode === 'all' || savedViewMode === 'following')) {
          setInternalViewMode(savedViewMode);
        }

        if (savedHideMyEdits !== null) {
          setInternalHideMyEdits(savedHideMyEdits === 'true');
        }
      } catch (error) {
        console.error('Error loading Recent Edits preferences from localStorage:', error);
      }
    }
  }, [externalViewMode, externalHideMyEdits]);

  // Save user preferences to localStorage when they change (only for internal state)
  useEffect(() => {
    if (typeof window !== 'undefined' && !externalViewMode) {
      try {
        localStorage.setItem('recentEdits_viewMode', internalViewMode);
      } catch (error) {
        console.error('Error saving Recent Edits view mode to localStorage:', error);
      }
    }
  }, [internalViewMode, externalViewMode]);

  useEffect(() => {
    if (typeof window !== 'undefined' && externalHideMyEdits === undefined) {
      try {
        localStorage.setItem('recentEdits_hideMyEdits', String(internalHideMyEdits));
      } catch (error) {
        console.error('Error saving Recent Edits hideMyEdits to localStorage:', error);
      }
    }
  }, [internalHideMyEdits, externalHideMyEdits]);
  const [followedPages, setFollowedPages] = useState<any[]>([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);

  // Fetch followed pages when view mode changes to 'following'
  useEffect(() => {
    if (currentViewMode === 'following' && currentAccount) {
      setIsLoadingFollows(true);
      getFollowedPages(currentAccount.uid)
        .then(pages => {
          setFollowedPages(pages);
        })
        .catch(err => {
          console.error('Error fetching followed pages:', err);
        })
        .finally(() => {
          setIsLoadingFollows(false);
        });
    }
  }, [currentViewMode, currentAccount]);

  // Fetch recent activity data (recent edits)
  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 Fetching recent edits data...');

        // Fetch recently edited pages from the home API
        const timestamp = Date.now();
        const response = await fetch(`/api/home?t=${timestamp}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch recent edits: ${response.status}`);
        }

        const data = await response.json();
        const recentlyVisitedPages = data.recentlyVisitedPages || [];
        console.log(`📊 Found ${recentlyVisitedPages.length} recently visited pages`);

        // Filter for pages that have meaningful edits (lastDiff data with changes)
        const pagesWithEdits = recentlyVisitedPages.filter((page: any) => {
          return page.lastDiff && page.lastDiff.hasChanges;
        });

        console.log(`📝 Found ${pagesWithEdits.length} pages with recent edits`);

        // Convert to the format expected by ActivityCard
        const formattedActivities: ActivityData[] = pagesWithEdits.map((page: any) => ({
          pageId: page.id,
          pageName: page.title || 'Untitled',
          userId: page.userId,
          username: page.username || 'Anonymous',
          timestamp: new Date(page.lastModified),
          isPublic: page.isPublic !== false, // Default to true
          isNewPage: false, // These are edits, not new pages
          diff: page.lastDiff ? {
            added: page.lastDiff.added || 0,
            removed: page.lastDiff.removed || 0,
            hasChanges: page.lastDiff.hasChanges
          } : {
            added: 0,
            removed: 0,
            hasChanges: true
          },
          diffPreview: page.lastDiff?.preview || null,
          versionId: page.currentVersion || null,
          tier: page.tier,
          subscriptionStatus: page.subscriptionStatus,
          subscriptionAmount: page.subscriptionAmount
        }));

        setActivities(formattedActivities);
        console.log(`✅ Successfully loaded ${formattedActivities.length} activities`);
        
      } catch (err) {
        console.error('Error fetching recent activity:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recent activity');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, [currentAccount, limit]);

  // Notify parent component of filter state changes
  useEffect(() => {
    if (onFilterStateChange) {
      onFilterStateChange({
        currentViewMode,
        hideMyEdits,
        isLoadingFollows
      });
    }
  }, [currentViewMode, hideMyEdits, isLoadingFollows, onFilterStateChange]);

  // Filter activities based on current view mode and hide my edits setting
  const filteredActivities = React.useMemo(() => {
    let filtered = activities;

    // First apply view mode filter
    if (currentViewMode === 'following' && currentAccount) {
      filtered = activities.filter(activity =>
        followedPages.some(followedPage => followedPage.id === activity.pageId)
      );
    }

    // Then apply "hide my edits" filter if enabled
    if (hideMyEdits && currentAccount) {
      filtered = filtered.filter(activity => activity.userId !== currentAccount.uid);
    }

    return filtered.slice(0, limit);
  }, [activities, currentViewMode, followedPages, currentAccount, limit, hideMyEdits]);

  // Function to render the filter dropdown button
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
                    className={`gap-2 h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors ${
                      currentViewMode === 'following' || hideMyEdits ? 'border-primary text-primary' : ''
                    }`}
                    aria-label={`Filter edits: ${currentViewMode === 'following' ? 'Following' : 'All Recent Edits'}`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {currentViewMode === 'following' ? 'Following' : 'All Recent Edits'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter edits by: {currentViewMode === 'following' ? 'Pages you follow' : 'All recent edits'}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setCurrentViewMode('all')}
                className={currentViewMode === 'all' ? 'bg-muted' : ''}
              >
                All Recent Edits
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCurrentViewMode('following')}
                className={currentViewMode === 'following' ? 'bg-muted' : ''}
                disabled={isLoadingFollows}
              >
                Following
              </DropdownMenuItem>
              <div className="border-t border-border my-1" />
              <DropdownMenuItem
                onClick={() => setHideMyEdits(!hideMyEdits)}
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

  // Expose the filter dropdown for external use
  React.useImperativeHandle(ref, () => ({
    FilterDropdown: renderFilterDropdown
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-muted rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">Failed to load recent edits</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
          {currentViewMode === 'following'
            ? "No recent edits from pages you follow"
            : hideMyEdits
            ? "No recent edits by others"
            : "No recent edits"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {currentViewMode === 'following'
            ? "Edits from pages you follow will appear here"
            : hideMyEdits
            ? "Edits by other users will appear here"
            : "Edits will appear here when users edit pages"}
        </p>
      </div>
    );
  }

  if (isCarousel) {
    return (
      <div className="space-y-4">
        <div 
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredActivities.map((activity, index) => (
            <div key={`${activity.pageId}-${activity.versionId || index}`} className="flex-shrink-0 w-80">
              <ActivityCard activity={activity} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredActivities.map((activity, index) => (
        <ActivityCard 
          key={`${activity.pageId}-${activity.versionId || index}`} 
          activity={activity} 
        />
      ))}
    </div>
  );
});

RecentEdits.displayName = 'RecentEdits';

export default RecentEdits;
