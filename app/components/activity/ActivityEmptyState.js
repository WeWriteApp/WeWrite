"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Search } from 'lucide-react';
import { wewriteCard } from '../../lib/utils';

/**
 * ActivityEmptyState Component
 *
 * Displays an empty state for the activity feed
 *
 * @param {Object} props
 * @param {string} props.mode - The current view mode ('all' or 'following')
 */
export default function ActivityEmptyState({ mode = 'all' }) {
  const router = useRouter();

  const handleSearchClick = () => {
    router.push('/search');
  };

  // Different messages based on the mode - add safety check
  const safeMode = mode || 'all';
  const isFollowingMode = safeMode === 'following';

  return (
    <div className={wewriteCard('default', 'flex flex-col items-center justify-center py-4 text-center')}>
      <h3 className="text-lg font-semibold mb-2">
        {isFollowingMode ? 'No followed activity' : 'No activity to display'}
      </h3>

      <p className="text-muted-foreground mb-4 max-w-md text-sm">
        {isFollowingMode
          ? 'You haven\'t followed any pages yet, or your followed pages don\'t have any recent activity. Follow pages to see their updates here.'
          : 'Activity will appear here as you and others create and edit pages. Discover content by searching for pages.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleSearchClick}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          Discover pages
        </Button>

        {isFollowingMode && (
          <Button
            onClick={() => {
              // Find the filter dropdown button and click it
              const filterButton = document.querySelector('[aria-label^="Filter activity"]');
              if (filterButton) {
                filterButton.click();

                // Find and click the "All" option
                setTimeout(() => {
                  const allOption = document.querySelector('[class*="dropdown-menu"] [class*="dropdown-menu-item"]:first-child');
                  if (allOption) {
                    allOption.click();
                  }
                }, 100);
              }
            }}
            variant="default"
            size="sm"
          >
            View all activity
          </Button>
        )}
      </div>
    </div>
  );
}