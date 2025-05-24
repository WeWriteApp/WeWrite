"use client";

import React, { useMemo } from 'react';
import { Button } from './ui/button';
import Link from 'next/link';
import { PillLink } from './PillLink';

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
 * @param {Object} user - Current user object
 */
const SearchResultsDisplay = React.memo(({
  query,
  results,
  isLoading,
  groupsEnabled,
  user
}) => {
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
        displayName: user.username,
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
      {/* Search Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Searching..."
            : `Found ${totalResults} results for "${query}"`}
        </p>
      </div>

      <div className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Users Results */}
        {!isLoading && results?.users && results.users.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold mb-4">Users</h3>
            {results.users.map(user => (
              <div key={`user-${user.id}`} className="flex items-center">
                <div className="flex-none max-w-[60%]">
                  <PillLink href={`/user/${user.id}`} className="max-w-full">
                    @{user.username}
                  </PillLink>
                </div>
                <span className="text-xs text-muted-foreground ml-2 truncate">
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
              <div key={`page-${page.id}`} className="flex items-center">
                <div className="flex-none max-w-[60%]">
                  <PillLink
                    href={`/${page.id}`}
                    isPublic={page.isPublic}
                    isOwned={page.userId === user?.uid}
                    className="max-w-full"
                  >
                    {page.title}
                  </PillLink>
                </div>
                <span className="text-xs text-muted-foreground ml-2 truncate">
                  by {page.username || "Missing username"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Groups Results */}
        {!isLoading && groupsEnabled && results?.groups && results.groups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold mb-4">Groups</h3>
            {results.groups.map(group => (
              <div key={`group-${group.id}`} className="flex items-center">
                <div className="flex-none max-w-[60%]">
                  <PillLink href={`/group/${group.id}`} className="max-w-full">
                    {group.name}
                  </PillLink>
                </div>
                <span className="text-xs text-muted-foreground ml-2 truncate">
                  Group
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoading && query && query.trim() &&
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
});

SearchResultsDisplay.displayName = 'SearchResultsDisplay';

export default SearchResultsDisplay;
