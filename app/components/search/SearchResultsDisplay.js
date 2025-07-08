"use client";

import React, { useMemo } from 'react';
import { Button } from "../ui/button";
import Link from 'next/link';
import { PillLink } from "../utils/PillLink";
import PerformanceMonitor from '../utils/PerformanceMonitor';
import { Pin } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import { useDateFormat } from '../../contexts/DateFormatContext';

/**
 * SearchResultsDisplay Component
 *
 * A memoized component that displays search results without causing
 * re-renders of the parent search page.
 *
 * @param {string} query - Current search query
 * @param {Object} results - Search results object with pages, users, groups
 * @param {boolean} isLoading - Loading state
 * @param {boolean} groupsEnabled - Whether groups feature is enabled
 * @param {string} userId - Current user ID (extracted from user object)
 * @param {Function} onSave - Function to save the current search query
 */
const SearchResultsDisplay = React.memo(({
  query,
  results,
  isLoading,
  groupsEnabled,
  userId,
  onSave,
  error = null,
  searchStats = {}
}) => {
  const { formatDate: formatDateString } = useDateFormat();
  const { session } = useCurrentAccount();

  // Check if user is admin for debug features
  const isAdmin = session?.email === 'jamiegray2234@gmail.com';
  // Memoize the combined results to prevent unnecessary recalculations
  const combinedResults = useMemo(() => {
    if (!results) {
      return [];
    }

    // Create a combined array of all results
    let combined = [
      ...(results.users || []).map(user => ({
        ...user,
        type: 'user',
        displayName: session.username,
        url: `/user/${user.id}`
      })),
      ...(results.pages || []).map(page => ({
        ...page,
        type: 'page',
        displayName: page.title,
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
          displayName: group.name,
          url: `/group/${group.id}`
        }))
      ];
    }

    // Sort by relevance (could be enhanced with actual relevance scoring)
    // For now, we'll just sort alphabetically by display name
    return combined.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [results, groupsEnabled]);

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
      {/* Search Results Summary with Performance Metrics */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Searching..."
              : `${totalResults} results`}
          </p>
          {!isLoading && searchStats.searchTimeMs && isAdmin && (
            <p className="text-xs text-muted-foreground">
              Found in {searchStats.searchTimeMs}ms
              {searchStats.source && ` • ${searchStats.source}`}
            </p>
          )}
        </div>
        {!isLoading && query && onSave && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave(query)}
            className="flex items-center gap-2"
          >
            <Pin className="h-4 w-4" />
            Save search
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Error State */}
        {!isLoading && error && (
          <div className="text-center py-8">
            <p className="text-destructive mb-2">Search error occurred</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Searching for "{query}"...</p>
          </div>
        )}

        {/* Users Results */}
        {!isLoading && results?.users && results.users.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold mb-4">Users</h3>
            {results.users.map(user => (
              <div key={`user-${user.id}`} className="flex items-start gap-2 min-w-0">
                <div className="flex-shrink-0 min-w-0 max-w-[calc(100%-60px)]">
                  <PillLink href={`/user/${user.id}`} className="max-w-full truncate">
                    {session.username}
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
              <div key={`page-${page.id}`} className="flex items-start gap-2 min-w-0">
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
                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                  by {page.username || "Missing username"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Groups functionality removed */}

        {/* No Results - Only show after search has completed and we have a query */}
        {!isLoading && query && query.trim() && results &&
         (!results?.pages || results.pages.length === 0) &&
         (!results?.users || results.users.length === 0) &&
         (!groupsEnabled || !results?.groups || results.groups.length === 0) && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No results found for "{query}"</p>
            <Button asChild>
              <Link href={`/new?title=${encodeURIComponent(query.trim())}`}>
                Create "{query.trim()}" page
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
  if (prevProps.onSave !== nextProps.onSave) return false;

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