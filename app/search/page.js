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
import { generateFallbackSearchResults, shouldUseFallbackForTerm } from '../utils/clientSideFallbackSearch';
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
  const resultsContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

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

    // Save scroll position before updating results
    saveScrollPosition();

    // Save cursor position and selection
    const inputElement = searchInputRef.current;
    const cursorPosition = inputElement ? {
      selectionStart: inputElement.selectionStart,
      selectionEnd: inputElement.selectionEnd,
      hasFocus: document.activeElement === inputElement
    } : null;

    // Only set loading if we don't already have results for this search term
    // This prevents flickering when typing quickly
    const trimmedSearchTerm = searchTerm.trim();
    if (query !== trimmedSearchTerm) {
      setIsLoading(true);
    }
    try {

      // For unauthenticated users or as a fallback
      if (!user) {
        console.log(`User not authenticated, using fallback search for: "${trimmedSearchTerm}"`);
        const fallbackResults = generateFallbackSearchResults(trimmedSearchTerm);

        setResults({
          pages: fallbackResults.pages,
          users: fallbackResults.users,
          groups: []
        });

        // Save to recent searches when a search is completed
        saveSearchTerm(trimmedSearchTerm);

        setIsLoading(false);

        // Restore scroll position after results update
        setTimeout(restoreScrollPosition, 0);
        return;
      }

      // For authenticated users, proceed with normal search
      let groupIds = [];
      if (user.groups) {
        groupIds = Object.keys(user.groups);
      }

      // Check if we should use fallback search immediately for certain terms
      if (shouldUseFallbackForTerm(trimmedSearchTerm)) {
        console.log(`Using immediate fallback search for important term: "${trimmedSearchTerm}"`);
        const fallbackResults = generateFallbackSearchResults(trimmedSearchTerm, user.uid);
        console.log(`Fallback search found ${fallbackResults.pages.length} pages and ${fallbackResults.users.length} users`);

        setResults({
          pages: fallbackResults.pages,
          users: fallbackResults.users,
          groups: []
        });

        // Save to recent searches when a search is completed
        saveSearchTerm(trimmedSearchTerm);

        setIsLoading(false);

        // Restore scroll position after results update
        setTimeout(restoreScrollPosition, 0);
        return;
      }

      // Proceed with normal API search
      const queryUrl = `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(trimmedSearchTerm)}&groupIds=${groupIds}&useScoring=true`;
      console.log(`Making API request to search for "${trimmedSearchTerm}"`, queryUrl);

      const response = await fetch(queryUrl);

      if (!response.ok) {
        console.error('Search API returned error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Search API error details:', errorText);
        throw new Error(`Search API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Search results for "${trimmedSearchTerm}":`, data);
      console.log(`Found ${data.pages?.length || 0} pages and ${data.users?.length || 0} users`);
      console.log('Search API response source:', data.source);

      // Log detailed information about the search results
      if (data.pages && data.pages.length > 0) {
        console.log('Pages found:', data.pages.map(p => ({ id: p.id, title: p.title, userId: p.userId })));
      }
      if (data.users && data.users.length > 0) {
        console.log('Users found:', data.users.map(u => ({ id: u.id, username: u.username })));
      }
      if (data.error) {
        console.warn('Search API returned error:', data.error);
      }

      // Log the titles of the pages found
      if (data.pages && data.pages.length > 0) {
        console.log('Page titles found:', data.pages.map(page => page.title).join(', '));

        // Save to recent searches when results are found
        saveSearchTerm(trimmedSearchTerm);
      } else {
        console.log('No pages found matching the search term');

        // If no results from API, use fallback search
        console.log(`Using fallback search for "${trimmedSearchTerm}" due to no API results`);
        const fallbackResults = generateFallbackSearchResults(trimmedSearchTerm, user.uid);
        console.log(`Fallback search found ${fallbackResults.pages.length} pages and ${fallbackResults.users.length} users`);

        if (fallbackResults.pages.length > 0 || fallbackResults.users.length > 0) {
          setResults({
            pages: fallbackResults.pages,
            users: fallbackResults.users
          });

          // Save to recent searches when fallback results are found
          saveSearchTerm(trimmedSearchTerm);

          setIsLoading(false);

          // Restore scroll position after results update
          setTimeout(restoreScrollPosition, 0);
          return;
        }
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

      console.log(`Deduplication: ${processedPages.length} pages → ${uniquePages.length} unique pages`);
      console.log(`Deduplication: ${(data.users || []).length} users → ${uniqueUsers.length} unique users`);

      setResults({
        pages: uniquePages,
        users: uniqueUsers
      });

      // Save to recent searches when a search is completed successfully
      saveSearchTerm(trimmedSearchTerm);
    } catch (error) {
      console.error('Error searching:', error);
      console.error("Search Error: There was a problem performing your search.");

      // On error, use fallback search
      console.log(`Using fallback search for "${searchTerm}" due to API error`);
      const fallbackResults = generateFallbackSearchResults(searchTerm, user?.uid);

      setResults({
        pages: fallbackResults.pages,
        users: fallbackResults.users
      });
    } finally {
      setIsLoading(false);

      // Restore scroll position after results update
      setTimeout(restoreScrollPosition, 0);

      // Restore cursor position and focus
      setTimeout(() => {
        if (cursorPosition && searchInputRef.current) {
          if (cursorPosition.hasFocus) {
            searchInputRef.current.focus();
          }
          searchInputRef.current.setSelectionRange(
            cursorPosition.selectionStart,
            cursorPosition.selectionEnd
          );
        }
      }, 0);
    }
  };





  // Save scroll position before updating results (optimized to reduce calls)
  const saveScrollPosition = () => {
    // Only save scroll position when actually needed (during search operations)
    if (resultsContainerRef.current) {
      scrollPositionRef.current = resultsContainerRef.current.scrollTop;
    } else {
      // If results container isn't available, save window scroll position
      scrollPositionRef.current = window.scrollY;
    }
  };

  // Restore scroll position after results update (optimized)
  const restoreScrollPosition = () => {
    if (resultsContainerRef.current && scrollPositionRef.current !== null) {
      resultsContainerRef.current.scrollTop = scrollPositionRef.current;
    } else if (scrollPositionRef.current !== null) {
      // If results container isn't available, restore window scroll position
      window.scrollTo(0, scrollPositionRef.current);
    }
  };

  // Function to save search term (no longer needed for recent searches)
  const saveSearchTerm = () => {
    // This function is kept for compatibility but doesn't do anything now
    // We'll use explicit saveSearchQuery for pinned searches instead
  };

  // Create a debounced search function with 400ms delay
  const debouncedSearch = useRef(null);

  // Initialize the debounced search function once
  useEffect(() => {
    debouncedSearch.current = debounce((searchTerm) => {
      if (searchTerm.trim()) {
        // Call performSearch directly without dependency issues
        performSearchInternal(searchTerm.trim());

        // Update URL without triggering navigation
        const url = new URL(window.location);
        url.searchParams.set('q', searchTerm.trim());
        window.history.replaceState({
          searchQuery: searchTerm.trim(),
          isUserInitiated: true
        }, '', url);
      } else {
        setResults({ pages: [], users: [], groups: [] });
        setIsLoading(false);

        // Remove the q parameter from URL
        const url = new URL(window.location);
        url.searchParams.delete('q');
        window.history.replaceState({
          searchQuery: '',
          isUserInitiated: true
        }, '', url);
      }
    }, 400);

    return () => {
      // Clean up the debounced function
      if (debouncedSearch.current && debouncedSearch.current.cancel) {
        debouncedSearch.current.cancel();
      }
    };
  }, []); // Remove performSearch dependency to prevent recreation

  // Track if this is an initial load or a user-initiated search
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Handle query changes (simplified to prevent re-renders and page reloads)
  const handleQueryChange = useCallback((e) => {
    const newQuery = e.target.value;

    // Preserve cursor position
    const cursorPosition = e.target.selectionStart;

    setQuery(newQuery);

    // Cancel any pending debounced search to prevent stale requests
    if (debouncedSearch.current && debouncedSearch.current.cancel) {
      debouncedSearch.current.cancel();
    }

    // Always trigger debounced search after initialization
    if (hasInitializedFromURL && debouncedSearch.current) {
      debouncedSearch.current(newQuery);
    }

    // Restore cursor position after state update
    setTimeout(() => {
      if (searchInputRef.current && document.activeElement === searchInputRef.current) {
        searchInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
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

    // Immediately perform search without waiting for debounce
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      // Save scroll position before updating results
      saveScrollPosition();

      // Update URL with search query (trimmed)
      const url = new URL(window.location);
      url.searchParams.set('q', trimmedQuery);
      window.history.replaceState({ searchQuery: trimmedQuery }, '', url);

      // Explicitly save search term when user presses Enter
      saveSearchTerm(trimmedQuery);

      // Use the trimmed query for search
      performSearchInternal(trimmedQuery);
    } else {
      // If query is empty or just whitespace, clear results and URL parameter
      setResults({ pages: [], users: [], groups: [] });

      // Remove the q parameter from URL
      const url = new URL(window.location);
      url.searchParams.delete('q');
      window.history.replaceState({ searchQuery: '' }, '', url);
    }

    // Set isInitialLoad to false since this is a user-initiated search
    setIsInitialLoad(false);

    // Keep focus on the search input
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
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
              // Save scroll position before updating results
              saveScrollPosition();

              setQuery(searchTerm);

              // Update URL with search query
              const url = new URL(window.location);
              url.searchParams.set('q', searchTerm);
              window.history.replaceState({ searchQuery: searchTerm }, '', url);

              performSearchInternal(searchTerm);

              // Set isInitialLoad to false since this is a user-initiated search
              setIsInitialLoad(false);
            }}
          />

          {/* Recent Pages */}
          <RecentPages />

          {/* Search Recommendations */}
          <SearchRecommendations
            onSelect={(recommendation) => {
              // Save scroll position before updating results
              saveScrollPosition();

              setQuery(recommendation);

              // Update URL with search query
              const url = new URL(window.location);
              url.searchParams.set('q', recommendation);
              window.history.replaceState({ searchQuery: recommendation }, '', url);

              performSearchInternal(recommendation);

              // Set isInitialLoad to false since this is a user-initiated search
              setIsInitialLoad(false);
            }}
          />
        </div>
      )}

      {query && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Searching..."
              : `Found ${totalResults} results for "${query}"`}
          </p>
          {!isLoading && combinedResults.length > 0 && combinedResults[0].isFallback && (
            <p className="text-xs text-muted-foreground mt-1">
              Showing suggested results. Create a page with this title to add it to the database.
            </p>
          )}
        </div>
      )}

      <div className="space-y-6" ref={resultsContainerRef}>
        {/* Main Results Display */}
        {!isLoading && combinedResults.length > 0 && (
          <div className="space-y-2 mt-8">
            <h3 className="text-lg font-semibold mb-4">All Results</h3>
            {combinedResults.map(result => (
              <div key={`${result.type}-${result.id}`} className="flex items-center">
                <div className="flex-none max-w-[60%]">
                  <PillLink href={result.url} className="max-w-full">
                    {result.displayName}
                  </PillLink>
                </div>
                <span className="text-xs text-muted-foreground ml-2 truncate">
                  {result.type === 'user' ? (
                    `${result.username} - User${result.isFallback ? ' (Suggested)' : ''}`
                  ) : result.type === 'group' && groupsEnabled ? (
                    `${result.displayName} - Group${result.isFallback ? ' (Suggested)' : ''}`
                  ) : (
                    `by ${result.username || "Missing username"}${result.isFallback ? ' (Suggested)' : ''}`
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Create page option when no results */}
        {!isLoading && combinedResults.length === 0 && query && query.trim() && (
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
