"use client";

import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from '../components/ui/use-toast';
import Link from 'next/link';
import SearchRecommendations from '../components/SearchRecommendations';
import SavedSearches from '../components/SavedSearches';
import RecentPages from '../components/RecentPages';
import { useFeatureFlag } from '../utils/feature-flags.ts';
import { saveSearchQuery } from '../utils/savedSearches';

// Import the new separated components
import OptimizedSearchInput from '../components/OptimizedSearchInput';
import SearchResultsDisplay from '../components/SearchResultsDisplay';
import PerformanceMonitor from '../components/PerformanceMonitor';


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

  // Simplified state management
  const [currentQuery, setCurrentQuery] = useState('');
  const [results, setResults] = useState({ pages: [], users: [], groups: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Memoize user data to prevent unnecessary re-renders
  const userId = useMemo(() => user?.uid || null, [user?.uid]);
  const userEmail = useMemo(() => user?.email || null, [user?.email]);
  const userGroups = useMemo(() => user?.groups ? Object.keys(user.groups) : [], [user?.groups]);

  // Check if Groups feature is enabled
  const groupsEnabled = useFeatureFlag('groups', userEmail);

  // Initialize query from URL parameters - memoized to prevent SearchInput re-renders
  const initialQuery = useMemo(() => {
    const q = searchParams.get('q');
    return q && q.trim() ? q.trim() : '';
  }, [searchParams]);



  // Memoized search function to prevent callback recreation
  const performSearch = useCallback(async (searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) {
      setResults({ pages: [], users: [], groups: [] });
      setIsLoading(false);
      setCurrentQuery('');
      return;
    }

    const trimmedSearchTerm = searchTerm.trim();
    setIsLoading(true);
    setCurrentQuery(trimmedSearchTerm);

    try {
      if (!userId) {
        console.log(`User not authenticated, showing empty results for: "${trimmedSearchTerm}"`);
        setResults({ pages: [], users: [], groups: [] });
        setIsLoading(false);
        return;
      }

      const queryUrl = `/api/search?userId=${userId}&searchTerm=${encodeURIComponent(trimmedSearchTerm)}&groupIds=${userGroups}&useScoring=true`;
      console.log(`Making API request to search for "${trimmedSearchTerm}"`, queryUrl);

      const response = await fetch(queryUrl);

      if (!response.ok) {
        console.error('Search API returned error:', response.status, response.statusText);
        throw new Error(`Search API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Search results for "${trimmedSearchTerm}":`, data);

      if (data.error) {
        console.warn('Search API returned error:', data.error);
      }

      // Process the results to ensure usernames are properly set
      const processedPages = await Promise.all((data.pages || []).map(async (page) => {
        if (!page.username || page.username === "Anonymous" || page.username === "NULL") {
          try {
            const { getUsernameById } = await import('../utils/userUtils');
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

      // Deduplicate results
      const uniquePages = Array.from(
        new Map(processedPages.map(page => [page.id, page])).values()
      );
      const uniqueUsers = Array.from(
        new Map((data.users || []).map(user => [user.id, user])).values()
      );

      setResults({
        pages: uniquePages,
        users: uniqueUsers,
        groups: []
      });

    } catch (error) {
      console.error('Error searching:', error);
      setResults({ pages: [], users: [], groups: [] });
    } finally {
      setIsLoading(false);
    }
  }, [userId, userGroups]); // Use memoized userGroups instead of user?.groups





  // Perform initial search if there's a query in the URL
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]); // Add performSearch dependency

  // Memoized callback functions for SearchInput component with proper dependencies
  const handleSearch = useCallback((searchTerm) => {
    performSearch(searchTerm);

    // Update URL
    if (searchTerm && searchTerm.trim()) {
      const url = new URL(window.location);
      url.searchParams.set('q', searchTerm.trim());
      window.history.replaceState({}, '', url);
    }
  }, [performSearch]); // Add performSearch dependency

  const handleClear = useCallback(() => {
    setResults({ pages: [], users: [], groups: [] });
    setCurrentQuery('');

    // Remove the q parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }, []); // No dependencies needed for this function

  const handleSave = useCallback((searchTerm) => {
    if (!userId || !searchTerm) return;

    const saved = saveSearchQuery(searchTerm, userId);
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
  }, [userId]); // Keep userId dependency

  const handleSubmit = useCallback((searchTerm) => {
    performSearch(searchTerm);

    // Update URL
    if (searchTerm && searchTerm.trim()) {
      const url = new URL(window.location);
      url.searchParams.set('q', searchTerm.trim());
      window.history.replaceState({}, '', url);
    } else {
      const url = new URL(window.location);
      url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    }
  }, [performSearch]); // Add performSearch dependency

  // Memoized helper function to copy to clipboard with toast notification
  const copyToClipboard = useCallback((textToCopy) => {
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
  }, []);

  // Memoized share search URL function using Web Share API or fallback to clipboard
  const shareSearchUrl = useCallback(() => {
    const url = new URL(window.location);
    const searchTerm = currentQuery ? currentQuery.trim() : '';
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
  }, [currentQuery, copyToClipboard]);

  // Memoized empty search state component to prevent unnecessary re-renders
  const EmptySearchState = useMemo(() => {
    if (currentQuery) return null;

    return (
      <div className="empty-search-state">
        {/* Saved Searches */}
        <SavedSearches
          userId={userId}
          onSelect={handleSearch}
        />

        {/* Recent Pages */}
        <RecentPages />

        {/* Search Recommendations */}
        <SearchRecommendations
          onSelect={handleSearch}
        />
      </div>
    );
  }, [currentQuery, userId, handleSearch]);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Performance monitoring - only active in development */}
      <PerformanceMonitor
        name="SearchPage"
        data={{
          currentQuery,
          isLoading,
          resultsCount: (results?.pages?.length || 0) + (results?.users?.length || 0),
          userId,
          groupsEnabled
        }}
      />

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

      {/* Search Input Component - Optimized for Performance */}
      <OptimizedSearchInput
        initialValue={initialQuery}
        onSearch={handleSearch}
        onClear={handleClear}
        onSave={handleSave}
        onSubmit={handleSubmit}
        autoFocus={true}
        placeholder="Search for pages, users..."
      />

      {/* Empty search state */}
      {EmptySearchState}

      {/* Search Results Display Component */}
      <SearchResultsDisplay
        query={currentQuery}
        results={results}
        isLoading={isLoading}
        groupsEnabled={groupsEnabled}
        userId={userId}
      />
    </div>
  );
}
