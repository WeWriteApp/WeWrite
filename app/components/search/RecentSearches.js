"use client";

import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { getRecentSearches, clearRecentSearches, removeRecentSearch } from "../../utils/recentSearches";
import { Button } from "../ui/button";
import PillLink from "../utils/PillLink";
import { UsernameBadge } from "../ui/UsernameBadge";
import { getBatchUserData } from '../../utils/apiDeduplication';

/**
 * RecentSearches Component
 * 
 * Displays a list of recent searches with the ability to clear them or select one
 * 
 * @param {Object} props
 * @param {Function} props.onSelect - Function to call when a search is selected
 * @param {string} props.userId - User ID for personalized recent searches
 */
export default function RecentSearches({ onSelect, userId = null }) {
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchResults, setSearchResults] = useState({}); // Will store { pages: [], users: [] }
  const [userSubscriptionData, setUserSubscriptionData] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Load recent searches and their results (simplified approach)
  useEffect(() => {
    const loadRecentSearchesWithResults = async () => {
      try {
        setIsLoading(true);

        // Get recent searches from localStorage directly
        const searches = await getRecentSearches(userId);
        const limitedSearches = searches.slice(0, 3); // Limit to 3 most recent for performance
        setRecentSearches(limitedSearches);

        // Fetch search results for each recent search (simplified)
        const resultsPromises = limitedSearches.map(async (search) => {
          try {
            const userIdParam = userId ? `&userId=${userId}` : '';
            const response = await fetch(`/api/search-unified?q=${encodeURIComponent(search.term)}&maxResults=6&context=autocomplete&includeUsers=true${userIdParam}`);

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
              searchTerm: search.term,
              results: {
                pages: data.pages?.slice(0, 4) || [],
                users: data.users?.slice(0, 2) || []
              }
            };
          } catch (error) {
            console.error(`Error fetching results for "${search.term}":`, error);
            return {
              searchTerm: search.term,
              results: { pages: [], users: [] }
            };
          }
        });

        // Wait for all results and update state
        const allResults = await Promise.all(resultsPromises);
        const resultsMap = {};
        allResults.forEach(({ searchTerm, results }) => {
          resultsMap[searchTerm] = results;
        });

        setSearchResults(resultsMap);

        // Fetch subscription data for page authors
        const allPages = Object.values(resultsMap).flatMap(results => results.pages || []);
        if (allPages.length > 0) {
          const userIds = [...new Set(allPages.map(page => page.userId).filter(Boolean))];
          if (userIds.length > 0) {
            try {
              const response = await getBatchUserData(userIds);
              if (response.success && response.data) {
                const newUserData = new Map();
                Object.entries(response.data).forEach(([userId, userData]) => {
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
          }
        }
      } catch (error) {
        console.error('Error loading recent searches:', error);
        setRecentSearches([]);
        setSearchResults({});
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentSearchesWithResults();
  }, [userId]);





  // Handle clearing all recent searches
  const handleClearAll = async () => {
    try {
      await clearRecentSearches(userId);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Searches
          </h3>
        </div>
        <div className="space-y-2">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-4 w-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  // If there are no recent searches, don't render anything
  if (!recentSearches.length) {
    return null;
  }

  return (
    <div className="mt-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center">
          <Clock className="h-4 w-4 mr-2" />
          Recent Searches
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
      </div>

      <div className="space-y-4">
        {recentSearches.map((search, index) => (
          <div key={`${search.term}-${index}`} className="space-y-2">
            {/* Search term row */}
            <div className="flex items-center justify-between group">
              <div
                className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors flex-1"
                onClick={() => onSelect(search.term)}
              >
                <span className="font-medium">"{search.term}"</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const updatedSearches = await removeRecentSearch(search.term, userId);
                    setRecentSearches(updatedSearches);
                  } catch (error) {
                    console.error('Error removing search:', error);
                    // Fallback to local removal
                    const newSearches = recentSearches.filter((_, i) => i !== index);
                    setRecentSearches(newSearches);
                  }
                }}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Horizontal carousel of results */}
            <div className="relative">
              {(searchResults[search.term]?.pages?.length > 0 || searchResults[search.term]?.users?.length > 0) ? (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {/* Display pages first */}
                  {searchResults[search.term]?.pages?.map((page) => (
                    <div key={`page-${page.id}`} className="flex-shrink-0 flex flex-col items-start gap-1">
                      <PillLink
                        href={`/${page.id}`}
                        isPublic={page.isPublic}
                        className="text-xs"
                      >
                        <span className="truncate max-w-[120px]">
                          {page.title || 'Untitled'}
                        </span>
                      </PillLink>
                      {page.username && page.userId && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[120px]">
                          <span>by</span>
                          <UsernameBadge
                            userId={page.userId}
                            username={page.username}
                            tier={userSubscriptionData.get(page.userId)?.tier}
                            subscriptionStatus={userSubscriptionData.get(page.userId)?.subscriptionStatus}
                            subscriptionAmount={userSubscriptionData.get(page.userId)?.subscriptionAmount}
                            size="sm"
                            variant="link"
                            className="text-xs truncate"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Display users */}
                  {searchResults[search.term]?.users?.map((user) => (
                    <div key={`user-${user.id}`} className="flex-shrink-0 flex flex-col items-start gap-1">
                      <UsernameBadge
                        userId={user.id}
                        username={user.username}
                        tier={user.tier}
                        subscriptionStatus={user.subscriptionStatus}
                        subscriptionAmount={user.subscriptionAmount}
                        size="sm"
                        variant="pill"
                        pillVariant="secondary"
                        className="text-xs"
                      />
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                        User
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No results found</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}