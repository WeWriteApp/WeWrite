"use client";

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '../providers/AuthProvider';
import { PillLink } from '../components/PillLink';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Share2, Search, Pin, X } from 'lucide-react';
import { toast } from '../components/ui/use-toast';
import { Skeleton } from '../components/ui/skeleton';
import Link from 'next/link';
import SearchRecommendations from '../components/SearchRecommendations';
import SavedSearches from '../components/SavedSearches';
import RecentPages from '../components/RecentPages';
import { useFeatureFlag } from '../utils/feature-flags';

import { saveSearchQuery } from '../utils/savedSearches';

// Debounce utility function
function debounce(func, wait, immediate = false) {
  let timeout;

  const debounced = function(...args) {
    const context = this;

    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };

  debounced.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
}



export default function SearchPage() {
  const searchParams = useSearchParams();
  const { user } = useContext(AuthContext);
  // const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ pages: [], users: [], groups: [] });
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Check if Groups feature is enabled
  const groupsEnabled = useFeatureFlag('groups', user?.email);

  // Track if we've initialized from URL to prevent refresh loops
  const [hasInitializedFromURL, setHasInitializedFromURL] = useState(false);
  const initializedRef = useRef(false);

  // Initialize query from URL parameters and perform initial search
  useEffect(() => {
    // Only run this effect once on initial load to prevent refresh loops
    if (initializedRef.current) return;

    const q = searchParams.get('q');

    // Only set query and perform search if q parameter exists and is not empty after trimming
    if (q && q.trim()) {
      setQuery(q);
      // Don't call performSearch here - let the debounced search handle it
    } else if (q === '') {
      // If q parameter exists but is empty, remove it from URL
      const url = new URL(window.location);
      url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    }

    initializedRef.current = true;
    setHasInitializedFromURL(true);
  }, []); // Remove searchParams dependency to prevent re-initialization

  // Focus the search input when the page loads
  useEffect(() => {
    // Short delay to ensure the input is rendered and DOM is ready
    const focusTimer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();

        // For mobile devices, try to open the keyboard
        if (typeof window !== 'undefined' && 'ontouchstart' in window) {
          searchInputRef.current.click();
        }
      }
    }, 100);

    return () => clearTimeout(focusTimer);
  }, []);



  // Internal search function that doesn't depend on external state
  const performSearchInternal = async (searchTerm) => {
    // Don't search if the search term is empty or just whitespace
    if (!searchTerm || !searchTerm.trim()) {
      setResults({ pages: [], users: [], groups: [] });
      setIsLoading(false);
      return;
    }

    const trimmedSearchTerm = searchTerm.trim();
    setIsLoading(true);

    try {
      // For unauthenticated users, show empty results
      if (!user) {
        console.log(`User not authenticated, showing empty results for: "${trimmedSearchTerm}"`);
        setResults({ pages: [], users: [], groups: [] });
        setIsLoading(false);
        return;
      }

      // For authenticated users, proceed with API search
      let groupIds = [];
      if (user.groups) {
        groupIds = Object.keys(user.groups);
      }

      const queryUrl = `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(trimmedSearchTerm)}&groupIds=${groupIds}&useScoring=true`;
      console.log(`Making API request to search for "${trimmedSearchTerm}"`, queryUrl);

      const response = await fetch(queryUrl);

      if (!response.ok) {
        console.error('Search API returned error:', response.status, response.statusText);
        throw new Error(`Search API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Search results for "${trimmedSearchTerm}":`, data);
      console.log(`Found ${data.pages?.length || 0} pages and ${data.users?.length || 0} users`);

      if (data.error) {
        console.warn('Search API returned error:', data.error);
      }

      // Process the results to ensure usernames are properly set
      const processedPages = await Promise.all((data.pages || []).map(async (page) => {
        // If page doesn't have a username or has "Anonymous", try to fetch it
        if (!page.username || page.username === "Anonymous" || page.username === "NULL") {
          try {
            // Import the getUsernameById function
            const { getUsernameById } = await import('../utils/userUtils');

            // Get the username for this page's userId
            if (page.userId) {
              const username = await getUsernameById(page.userId);
              return {
                ...page,
                username: username || "Missing username"
              };
            }
          } catch (error) {
            console.error('Error fetching username:', error);
          }
        }
        return page;
      }));

      // Deduplicate pages by ID
      const uniquePages = Array.from(
        new Map(processedPages.map(page => [page.id, page])).values()
      );

      // Deduplicate users by ID
      const uniqueUsers = Array.from(
        new Map((data.users || []).map(user => [user.id, user])).values()
      );

      console.log(`Found ${uniquePages.length} unique pages and ${uniqueUsers.length} unique users`);

      setResults({
        pages: uniquePages,
        users: uniqueUsers,
        groups: [] // Groups will be added when groups feature is fully implemented
      });

      // Save to recent searches when a search is completed successfully
      saveSearchTerm(trimmedSearchTerm);
    } catch (error) {
      console.error('Error searching:', error);
      setResults({ pages: [], users: [], groups: [] });
    } finally {
      setIsLoading(false);
    }
  };





  // Function to save search term (simplified)
  const saveSearchTerm = (searchTerm) => {
    // Save to recent searches when a search is completed
    if (searchTerm && searchTerm.trim()) {
      console.log(`Saving search term: "${searchTerm}"`);
      // This could be expanded to save to localStorage or user preferences
    }
  };

  // Create a debounced search function with 400ms delay
  const debouncedSearch = useRef(null);

  // Initialize the debounced search function once
  useEffect(() => {
    debouncedSearch.current = debounce((searchTerm) => {
      if (searchTerm.trim()) {
        performSearchInternal(searchTerm.trim());

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('q', searchTerm.trim());
        window.history.replaceState({}, '', url);
      } else {
        setResults({ pages: [], users: [], groups: [] });
        setIsLoading(false);

        // Remove the q parameter from URL
        const url = new URL(window.location);
        url.searchParams.delete('q');
        window.history.replaceState({}, '', url);
      }
    }, 400);

    return () => {
      if (debouncedSearch.current && debouncedSearch.current.cancel) {
        debouncedSearch.current.cancel();
      }
    };
  }, []);

  // Track if this is an initial load or a user-initiated search
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Handle query changes
  const handleQueryChange = useCallback((e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Cancel any pending debounced search
    if (debouncedSearch.current && debouncedSearch.current.cancel) {
      debouncedSearch.current.cancel();
    }

    // Trigger debounced search
    if (hasInitializedFromURL && debouncedSearch.current) {
      debouncedSearch.current(newQuery);
    }
  }, [hasInitializedFromURL]);

  // Effect to handle initial search from URL
  useEffect(() => {
    if (hasInitializedFromURL && query && isInitialLoad) {
      performSearchInternal(query.trim());
      setIsInitialLoad(false);
    }
  }, [hasInitializedFromURL, query, isInitialLoad]);

  // Handle search form submission (for Enter key)
  const handleSearch = (e) => {
    e.preventDefault();

    // Cancel any pending debounced search
    if (debouncedSearch.current && debouncedSearch.current.cancel) {
      debouncedSearch.current.cancel();
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      // Update URL
      const url = new URL(window.location);
      url.searchParams.set('q', trimmedQuery);
      window.history.replaceState({}, '', url);

      // Perform search immediately
      performSearchInternal(trimmedQuery);
    } else {
      // Clear results and URL parameter
      setResults({ pages: [], users: [], groups: [] });
      const url = new URL(window.location);
      url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    }

    setIsInitialLoad(false);
  };

  // Share search URL using Web Share API or fallback to clipboard
  const shareSearchUrl = () => {
    const url = new URL(window.location);
    const searchTerm = query.trim();
    const shareTitle = searchTerm
      ? `WeWrite Search: "${searchTerm}"`
      : "WeWrite Search";
    const shareText = searchTerm
      ? `Check out these search results for "${searchTerm}" on WeWrite`
      : "Check out WeWrite search";

    // Try to use the Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: shareText,
        url: url.toString()
      })
      .then(() => {
        console.log("Content shared successfully");
      })
      .catch(err => {
        console.error('Error sharing:', err);
        // Fallback to clipboard if sharing was cancelled or failed
        if (err.name !== 'AbortError') {
          copyToClipboard(url.toString());
        }
      });
    } else {
      // Fallback for browsers that don't support the Web Share API
      copyToClipboard(url.toString());
    }
  };

  // Helper function to copy to clipboard with toast notification
  const copyToClipboard = (textToCopy) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        console.log("Link copied to clipboard");
        toast({
          title: "Link copied",
          description: "Search URL copied to clipboard",
        });
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
        toast({
          title: "Copy failed",
          description: "Could not copy the URL to clipboard",
          variant: "destructive",
        });
      });
  };

  // Combine all results into a single array for display
  const combineResults = () => {
    // Add null/undefined checks for results
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
  };

  const combinedResults = combineResults();
  const totalResults = (results.pages?.length || 0) + (results.users?.length || 0) +
    (groupsEnabled && results.groups ? (results.groups.length || 0) : 0);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex items-center gap-2"
            aria-label="Go home"
          >
            <Link href="/">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="text-2xl font-bold">Search</h1>
        </div>
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={shareSearchUrl}
            className="flex items-center gap-2 rounded-2xl"
            aria-label="Share search results"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search for pages, users..."
            value={query}
            onChange={handleQueryChange}
            className="w-full pr-20"
            autoComplete="off"
            autoFocus={true}
          />

          {/* Search icon */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Clear button - only show when there's text in the search field */}
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults({ pages: [], users: [], groups: [] });
                // Remove the q parameter from URL
                const url = new URL(window.location);
                url.searchParams.delete('q');
                window.history.replaceState({ searchQuery: '' }, '', url);

                // Set isInitialLoad to false since this is a user-initiated action
                setIsInitialLoad(false);

                // Focus the input after clearing
                if (searchInputRef.current) {
                  searchInputRef.current.focus();
                }
              }}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Pin button - only show when there's text in the search field */}
          {query.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-16 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => {
                const trimmedQuery = query.trim();
                if (trimmedQuery) {
                  const saved = saveSearchQuery(trimmedQuery, user?.uid);
                  if (saved) {
                    toast({
                      title: "Search saved",
                      description: "Your search has been saved to pinned searches.",
                    });
                    // Force refresh the saved searches component
                    const savedSearchesEvent = new Event('savedSearchesUpdated');
                    window.dispatchEvent(savedSearchesEvent);
                  } else {
                    toast({
                      title: "Already saved",
                      description: "This search is already in your pinned searches.",
                    });
                  }
                }
              }}
              title="Save this search"
            >
              <Pin className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Show empty search state when there's no query */}
      {!query && (
        <div className="empty-search-state">
          {/* Saved Searches */}
          <SavedSearches
            userId={user?.uid}
            onSelect={(searchTerm) => {
              setQuery(searchTerm);

              // Update URL with search query
              const url = new URL(window.location);
              url.searchParams.set('q', searchTerm);
              window.history.replaceState({}, '', url);

              performSearchInternal(searchTerm);
              setIsInitialLoad(false);
            }}
          />

          {/* Recent Pages */}
          <RecentPages />

          {/* Search Recommendations */}
          <SearchRecommendations
            onSelect={(recommendation) => {
              setQuery(recommendation);

              // Update URL with search query
              const url = new URL(window.location);
              url.searchParams.set('q', recommendation);
              window.history.replaceState({}, '', url);

              performSearchInternal(recommendation);
              setIsInitialLoad(false);
            }}
          />
        </div>
      )}

      {/* Search Results */}
      {query && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Searching..."
              : `Found ${(results.pages?.length || 0) + (results.users?.length || 0)} results for "${query}"`}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Users Results */}
        {!isLoading && results.users && results.users.length > 0 && (
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
        {!isLoading && results.pages && results.pages.length > 0 && (
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

        {/* No Results */}
        {!isLoading && query && query.trim() &&
         (!results.pages || results.pages.length === 0) &&
         (!results.users || results.users.length === 0) && (
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
    </div>
  );
}
