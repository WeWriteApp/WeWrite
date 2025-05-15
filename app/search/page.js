"use client";

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '../providers/AuthProvider';
import { PillLink } from '../components/PillLink';
import { Button } from '../components/ui/button';
import { ClearableInput } from '../components/ui/clearable-input';
import { Share2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import Link from 'next/link';
import SearchRecommendations from '../components/SearchRecommendations';
import { useFeatureFlag } from '../utils/feature-flags';
import { generateFallbackSearchResults, shouldUseFallbackForTerm } from '../utils/clientSideFallbackSearch';

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

  // Initialize query from URL parameters
  useEffect(() => {
    const q = searchParams.get('q');

    // Only set query and perform search if q parameter exists and is not empty after trimming
    if (q && q.trim()) {
      setQuery(q);
      performSearch(q.trim());
    } else if (q === '') {
      // If q parameter exists but is empty, remove it from URL
      const url = new URL(window.location);
      url.searchParams.delete('q');
      window.history.pushState({}, '', url);
    }
  }, [searchParams]);

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

  // Perform search when query changes
  const performSearch = async (searchTerm) => {
    if (!user) return;

    // Don't search if the search term is empty or just whitespace
    if (!searchTerm || !searchTerm.trim()) {
      setResults({ pages: [], users: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let groupIds = [];
      if (user.groups) {
        groupIds = Object.keys(user.groups);
      }

      // Trim and encode the search term
      const trimmedSearchTerm = searchTerm.trim();

      // Check if we should use fallback search immediately for certain terms
      if (shouldUseFallbackForTerm(trimmedSearchTerm)) {
        console.log(`Using immediate fallback search for important term: "${trimmedSearchTerm}"`);
        const fallbackResults = generateFallbackSearchResults(trimmedSearchTerm, user.uid);
        console.log(`Fallback search found ${fallbackResults.pages.length} pages and ${fallbackResults.users.length} users`);

        setResults({
          pages: fallbackResults.pages,
          users: fallbackResults.users
        });
        setIsLoading(false);
        return;
      }

      // Proceed with normal API search
      const queryUrl = `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(trimmedSearchTerm)}&groupIds=${groupIds}&useScoring=true`;
      console.log(`Making API request to search for "${trimmedSearchTerm}"`, queryUrl);

      const response = await fetch(queryUrl);

      if (!response.ok) {
        console.error('Search API returned error:', response.status);
        throw new Error(`Search API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Search results for "${trimmedSearchTerm}":`, data);
      console.log(`Found ${data.pages?.length || 0} pages and ${data.users?.length || 0} users`);

      // Log the titles of the pages found
      if (data.pages && data.pages.length > 0) {
        console.log('Page titles found:', data.pages.map(page => page.title).join(', '));
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
          setIsLoading(false);
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
    }
  };

  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();

    // Trim the query to handle whitespace
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      // Update URL with search query (trimmed)
      const url = new URL(window.location);
      url.searchParams.set('q', trimmedQuery);
      window.history.pushState({}, '', url);

      // Use the trimmed query for search
      performSearch(trimmedQuery);
    } else {
      // If query is empty or just whitespace, clear results and URL parameter
      setResults({ pages: [], users: [] });

      // Remove the q parameter from URL
      const url = new URL(window.location);
      url.searchParams.delete('q');
      window.history.pushState({}, '', url);
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
        toast.success("Search URL copied to clipboard");
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
        toast.error("Could not copy the URL to clipboard");
      });
  };

  // Combine all results into a single array for display
  const combineResults = () => {
    // Create a combined array of all results
    let combined = [
      ...results.users.map(user => ({
        ...user,
        type: 'user',
        displayName: user.username,
        url: `/user/${user.id}`
      })),
      ...results.pages.map(page => ({
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
  const totalResults = results.pages.length + results.users.length +
    (groupsEnabled && results.groups ? results.groups.length : 0);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
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
        <div className="flex gap-2">
          <ClearableInput
            type="text"
            placeholder="Search for pages, users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            ref={searchInputRef}
            autoFocus={true}
          />
          <Button type="submit">Search</Button>
        </div>
      </form>

      {/* Show recommendations when there's no query */}
      {!query && (
        <SearchRecommendations
          onSelect={(recommendation) => {
            setQuery(recommendation);
            performSearch(recommendation);
            // Update URL with search query
            const url = new URL(window.location);
            url.searchParams.set('q', recommendation);
            window.history.pushState({}, '', url);
          }}
        />
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

      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {combinedResults.length > 0 ? (
              <div className="space-y-2">
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
            ) : (
              <div className="text-center py-8">
                {query && query.trim() ? (
                  <>
                    <p className="text-muted-foreground mb-4">No results found for "{query}"</p>
                    <Button asChild>
                      <Link href={`/new?title=${encodeURIComponent(query.trim())}`}>
                        Create "{query.trim()}" page
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Enter a search term to find pages and users
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
