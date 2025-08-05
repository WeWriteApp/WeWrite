"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Clock, X, ChevronRight } from 'lucide-react';
import { getRecentSearches, clearRecentSearches, removeRecentSearch } from "../../utils/recentSearches";
import { Button } from "../ui/button";
import PillLink from "../utils/PillLink";

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
  const [searchResults, setSearchResults] = useState({});
  const [loadingResults, setLoadingResults] = useState({});
  const [overflowStates, setOverflowStates] = useState({});
  const scrollRefs = useRef({});

  // Load recent searches on mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const searches = await getRecentSearches(userId);
        setRecentSearches(searches);

        // Fetch search results for each recent search
        searches.forEach(search => {
          fetchSearchResults(search.term);
        });
      } catch (error) {
        console.error('Error loading recent searches:', error);
        setRecentSearches([]);
      }
    };

    loadRecentSearches();
  }, [userId]);

  // Check overflow when search results change
  useEffect(() => {
    Object.keys(searchResults).forEach(searchTerm => {
      if (searchResults[searchTerm]?.length > 0) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => checkOverflow(searchTerm), 100);
      }
    });
  }, [searchResults]);

  // Function to fetch search results for a given search term
  const fetchSearchResults = async (searchTerm) => {
    if (loadingResults[searchTerm] || searchResults[searchTerm]) return;

    setLoadingResults(prev => ({ ...prev, [searchTerm]: true }));

    try {
      const response = await fetch(`/api/search-unified?q=${encodeURIComponent(searchTerm)}&maxResults=6&context=autocomplete&includeUsers=false`);
      const data = await response.json();

      setSearchResults(prev => ({
        ...prev,
        [searchTerm]: data.pages || []
      }));
    } catch (error) {
      console.error('Error fetching search results for', searchTerm, error);
      setSearchResults(prev => ({
        ...prev,
        [searchTerm]: []
      }));
    } finally {
      setLoadingResults(prev => ({ ...prev, [searchTerm]: false }));
    }
  };

  // Check if carousel has overflow
  const checkOverflow = (searchTerm) => {
    const scrollContainer = scrollRefs.current[searchTerm];
    if (scrollContainer) {
      const hasOverflow = scrollContainer.scrollWidth > scrollContainer.clientWidth;
      setOverflowStates(prev => ({
        ...prev,
        [searchTerm]: hasOverflow
      }));
    }
  };

  // Handle clearing all recent searches
  const handleClearAll = async () => {
    try {
      await clearRecentSearches(userId);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

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
              {loadingResults[search.term] ? (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded-full flex-shrink-0" />
                  ))}
                </div>
              ) : searchResults[search.term]?.length > 0 ? (
                <>
                  <div
                    ref={el => scrollRefs.current[search.term] = el}
                    className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
                  >
                    {searchResults[search.term].slice(0, 6).map((page) => (
                      <div key={page.id} className="flex-shrink-0 flex flex-col items-start gap-1">
                        <PillLink
                          href={`/${page.id}`}
                          isPublic={page.isPublic}
                          className="text-xs"
                        >
                          <span className="truncate max-w-[120px]">
                            {page.title || 'Untitled'}
                          </span>
                        </PillLink>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          by {page.username || 'Unknown'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Floating chevron indicator for overflow */}
                  {overflowStates[search.term] && (
                    <div className="absolute right-0 top-0 bottom-2 flex items-center pointer-events-none">
                      <div className="bg-gradient-to-l from-background via-background/80 to-transparent w-8 h-full flex items-center justify-end pr-1">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </>
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