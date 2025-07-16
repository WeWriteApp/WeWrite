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
 * - Supports filtering (All/Following/Mine)
 * - Works in both carousel and grid layouts
 * - Shows actual diff data from page edits
 */
const RecentEdits = React.forwardRef<any, RecentActivityProps>(({
  limit = 8,
  renderFilterInHeader = false,
  isCarousel = true
}, ref) => {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentViewMode, setCurrentViewMode] = useState<'all' | 'following' | 'mine'>('all');
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

  // Filter activities based on current view mode
  const filteredActivities = React.useMemo(() => {
    let filtered = activities;

    if (currentViewMode === 'following' && currentAccount) {
      filtered = activities.filter(activity =>
        followedPages.some(followedPage => followedPage.id === activity.pageId)
      );
    } else if (currentViewMode === 'mine' && currentAccount) {
      filtered = activities.filter(activity => activity.userId === currentAccount.uid);
    }

    return filtered.slice(0, limit);
  }, [activities, currentViewMode, followedPages, currentAccount, limit]);

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
                      currentViewMode === 'following' || currentViewMode === 'mine' ? 'border-primary text-primary' : ''
                    }`}
                    aria-label={`Filter edits: ${currentViewMode === 'all' ? 'All' : currentViewMode === 'following' ? 'Following' : 'Mine'}`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {currentViewMode === 'all' ? 'All' : currentViewMode === 'following' ? 'Following' : 'Mine'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter edits by: {currentViewMode === 'all' ? 'All pages' : currentViewMode === 'following' ? 'Pages you follow' : 'Your pages'}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => setCurrentViewMode('all')}
                className={currentViewMode === 'all' ? 'bg-muted' : ''}
              >
                All Edits
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCurrentViewMode('following')}
                className={currentViewMode === 'following' ? 'bg-muted' : ''}
                disabled={isLoadingFollows}
              >
                Following
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCurrentViewMode('mine')}
                className={currentViewMode === 'mine' ? 'bg-muted' : ''}
              >
                My Edits
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
          {currentViewMode === 'mine'
            ? "You haven't made any edits recently"
            : currentViewMode === 'following'
            ? "No recent edits from pages you follow"
            : "No recent edits"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {currentViewMode === 'mine'
            ? "Edit a page to see your edits here"
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
