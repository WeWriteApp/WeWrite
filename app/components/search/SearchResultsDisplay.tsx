"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from "../ui/button";
import Link from 'next/link';
import { PillLink } from "../utils/PillLink";
import { UsernameBadge } from "../ui/UsernameBadge";
import { ErrorCard } from "../ui/ErrorCard";
import { getBatchUserData } from '../../utils/apiClient';
import { sanitizeUsername } from '../../utils/usernameSecurity';
import PerformanceMonitor from '../utils/PerformanceMonitor';

import { useAuth } from '../../providers/AuthProvider';
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import { useDateFormat } from '../../contexts/DateFormatContext';
import { wewriteCard } from '../../lib/utils';

interface Page {
  id: string;
  title?: string;
  userId?: string;
  username?: string;
  isPublic?: boolean;
}

interface User {
  id: string;
  username?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
}

interface Group {
  id: string;
  name?: string;
}

interface SearchResults {
  pages?: Page[];
  users?: User[];
  groups?: Group[];
}

interface SearchStats {
  [key: string]: unknown;
}

interface UserSubscriptionData {
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
}

interface SearchResultsDisplayProps {
  query: string;
  results: SearchResults | null;
  isLoading: boolean;
  groupsEnabled: boolean;
  userId: string | null;
  error?: string | null;
  searchStats?: SearchStats;
}

/**
 * SearchResultsDisplay Component
 *
 * A memoized component that displays search results without causing
 * re-renders of the parent search page.
 */
const SearchResultsDisplay = React.memo(({
  query,
  results,
  isLoading,
  groupsEnabled,
  userId,
  error = null,
  searchStats = {}
}: SearchResultsDisplayProps) => {
  const { formatDate: formatDateString } = useDateFormat();
  const { user } = useAuth();

  // State for user subscription data
  const [userSubscriptionData, setUserSubscriptionData] = useState<Map<string, UserSubscriptionData>>(new Map());

  // Memoize the combined results to prevent unnecessary recalculations
  const combinedResults = useMemo(() => {
    if (!results) {
      return [];
    }

    // Create a combined array of all results
    let combined: Array<{
      type: string;
      username?: string;
      url: string;
      id: string;
      title?: string;
      name?: string;
      [key: string]: unknown;
    }> = [
      ...(results.users || []).map(user => {
        const username = sanitizeUsername(user?.username || `user_${user?.id?.slice(0, 8)}`);
        return {
          ...user,
          type: 'user',
          username,
          url: `/user/${user.id}`
        };
      }),
      ...(results.pages || []).map(page => ({
        ...page,
        type: 'page',
        url: `/${page.id}`
      }))
    ];

    // Add groups if the feature flag is enabled
    if (groupsEnabled && results.groups && results.groups.length > 0) {
      combined = [
        ...combined,
        ...results.groups.map(group => ({
          ...group,
          type: 'group',
          url: `/group/${group.id}`
        }))
      ];
    }

    // Sort alphabetically by username (for users) or title (for pages) or name (for groups)
    return combined.sort((a, b) => {
      const aName = a.username || a.title || a.name || '';
      const bName = b.username || b.title || b.name || '';
      return aName.localeCompare(bName);
    });
  }, [results, groupsEnabled]);

  // Fetch user subscription data when results change
  useEffect(() => {
    const fetchUserSubscriptionData = async () => {
      if (!results?.pages || results.pages.length === 0) return;

      // Extract unique user IDs from pages
      const userIds = [...new Set(results.pages.map(page => page.userId).filter(Boolean) as string[])];
      if (userIds.length === 0) return;

      try {
        const response = await getBatchUserData(userIds);
        if (response.success && response.data) {
          const newUserData = new Map<string, UserSubscriptionData>();
          Object.entries(response.data).forEach(([userId, userData]: [string, any]) => {
            newUserData.set(userId, {
              tier: userData.tier,
              subscriptionStatus: userData.subscriptionStatus,
              subscriptionAmount: userData.subscriptionAmount
            });
          });
          setUserSubscriptionData(newUserData);
        }
      } catch (error) {
        console.warn('Failed to fetch user subscription data:', error);
      }
    };

    fetchUserSubscriptionData();
  }, [results]);

  // Memoize total results count
  const totalResults = useMemo(() => {
    return (results?.pages?.length || 0) +
           (results?.users?.length || 0) +
           (groupsEnabled && results?.groups ? (results.groups.length || 0) : 0);
  }, [results, groupsEnabled]);

  // Don't render anything if there's no query
  if (!query) {
    return null;
  }

  return (
    <>
      {/* Performance monitoring - only active in development */}
      <PerformanceMonitor
        name="SearchResultsDisplay"
        data={{
          query,
          isLoading,
          groupsEnabled,
          userId,
          resultsCount: totalResults
        }}
      />
      {/* Search Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Searching..."
            : `${totalResults} results`}
        </p>
      </div>

      <div className="space-y-6">
        {/* Error State - ignore AbortError as it's expected behavior during typing */}
        {!isLoading && error && !error.toLowerCase().includes('abort') && (
          <ErrorCard
            title="Search failed"
            message="We couldn't complete your search. Please try again."
            error={error}
            onRetry={() => {
              // Trigger a retry by clearing and re-searching
              if (typeof window !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                const q = urlParams.get('q');
                if (q) {
                  window.location.reload();
                }
              }
            }}
            retryLabel="Retry Search"
            className="max-w-md mx-auto"
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Icon name="Loader" size={32} />
            <p className="text-sm text-muted-foreground">Searching for "{query}"...</p>
          </div>
        )}

        {/* Users Results */}
        {!isLoading && results?.users && results.users.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold mb-4">Users</h3>
            {results.users.map(user => (
              <div key={`user-${user.id}`} className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 min-w-0 max-w-[calc(100%-60px)]">
                  <PillLink href={`/user/${user.id}`} className="max-w-full truncate">
                    {user?.username}
                  </PillLink>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                  User
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pages Results */}
        {!isLoading && results?.pages && results.pages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold mb-4">Pages</h3>
            {results.pages.map(page => (
              <div key={`page-${page.id}`} className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 min-w-0 max-w-[calc(100%-80px)]">
                  <PillLink
                    href={`/${page.id}`}
                    isPublic={page.isPublic}
                    isOwned={page.userId === userId}
                    className="hover:scale-105 transition-transform"
                  >
                      {page.title && isExactDateFormat(page.title)
                        ? formatDateString(page.title)
                        : page.title}
                    </PillLink>
                  </div>
                  {page.username && page.userId && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      <span>by</span>
                      <UsernameBadge
                        userId={page.userId}
                        username={page.username}
                        tier={userSubscriptionData.get(page.userId)?.tier}
                        subscriptionStatus={userSubscriptionData.get(page.userId)?.subscriptionStatus}
                        subscriptionAmount={userSubscriptionData.get(page.userId)?.subscriptionAmount}
                        size="sm"
                        variant="link"
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* No Results Message - Only show after search has completed and we have a query with no results */}
        {!isLoading && query && query.trim() && results &&
         (!results?.pages || results.pages.length === 0) &&
         (!results?.users || results.users.length === 0) &&
         (!groupsEnabled || !results?.groups || results.groups.length === 0) && (
          <div className={wewriteCard('default', 'text-center py-4')}>
            <p className="text-muted-foreground">No results found for "{query}"</p>
          </div>
        )}

        {/* Create Page Button - Always show when there's a valid query, regardless of results */}
        {!isLoading && query && query.trim().length >= 2 && (
          <div className="mt-6">
            <Button asChild variant="secondary" className="w-full justify-center">
              <Link href={`/new?title=${encodeURIComponent(query.trim())}`}>
                Create new page: "{query.trim()}"
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if essential props change
  if (prevProps.query !== nextProps.query) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.groupsEnabled !== nextProps.groupsEnabled) return false;
  if (prevProps.userId !== nextProps.userId) return false;

  // Shallow comparison for results object to improve performance
  if (!prevProps.results && !nextProps.results) return true;
  if (!prevProps.results || !nextProps.results) return false;

  // Compare array lengths first (fast check)
  if ((prevProps.results.pages?.length || 0) !== (nextProps.results.pages?.length || 0)) return false;
  if ((prevProps.results.users?.length || 0) !== (nextProps.results.users?.length || 0)) return false;
  if ((prevProps.results.groups?.length || 0) !== (nextProps.results.groups?.length || 0)) return false;

  // If lengths are the same, do a deeper comparison only if needed
  return JSON.stringify(prevProps.results) === JSON.stringify(nextProps.results);
});

SearchResultsDisplay.displayName = 'SearchResultsDisplay';

export default SearchResultsDisplay;
