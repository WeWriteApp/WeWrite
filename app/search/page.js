"use client";

import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import { AuthContext } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Share2, Search, X, Pin } from 'lucide-react';
import { toast } from '../components/ui/use-toast';
import Link from 'next/link';
import { saveSearchQuery } from '../utils/savedSearches';
import { useSearchState } from '../hooks/useSearchState';

// Import the new separated components
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



// Completely isolated search input that doesn't cause parent re-renders
const IsolatedSearchInput = React.memo(({ onSearch, onClear, onSave, onSubmit, initialValue, autoFocus, placeholder }) => {
  const [inputValue, setInputValue] = useState(initialValue || '');
  const [currentQuery, setCurrentQuery] = useState('');
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastSearchValue = useRef('');
  const lastSyncedQuery = useRef('');

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // URL synchronization effect
  useEffect(() => {
    if (currentQuery !== lastSyncedQuery.current) {
      lastSyncedQuery.current = currentQuery;

      const url = new URL(window.location);
      if (currentQuery && currentQuery.trim()) {
        url.searchParams.set('q', currentQuery.trim());
      } else {
        url.searchParams.delete('q');
      }

      window.history.replaceState({}, '', url);
    }
  }, [currentQuery]);

  // Debounced search function
  const debouncedSearch = useCallback((value) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (value !== lastSearchValue.current && onSearch) {
        lastSearchValue.current = value;
        setCurrentQuery(value);
        onSearch(value);
      }
    }, 300);
  }, [onSearch]);

  // Handle input changes
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debouncedSearch(newValue);
  }, [debouncedSearch]);

  // Handle form submission
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (onSubmit) {
      setCurrentQuery(inputValue);
      onSubmit(inputValue);
    }
  }, [inputValue, onSubmit]);

  // Handle clear button
  const handleClear = useCallback(() => {
    setInputValue('');
    setCurrentQuery('');
    lastSearchValue.current = '';
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  // Handle save button
  const handleSave = useCallback(() => {
    if (onSave && inputValue.trim()) {
      onSave(inputValue.trim());
    }
  }, [inputValue, onSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="relative">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          className="w-full pl-10 pr-10 rounded-2xl"
          autoComplete="off"
        />

        {/* Search icon on the left */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Clear button - larger size */}
        {inputValue.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </form>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.initialValue === nextProps.initialValue &&
    prevProps.autoFocus === nextProps.autoFocus &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.onSearch === nextProps.onSearch &&
    prevProps.onClear === nextProps.onClear &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onSubmit === nextProps.onSubmit
  );
});

IsolatedSearchInput.displayName = 'IsolatedSearchInput';

// Memoize the entire SearchPage component to prevent unnecessary re-renders
const SearchPage = React.memo(() => {
  const { user, loading: authLoading } = useContext(AuthContext);

  // Memoize user data to prevent unnecessary re-renders
  const userId = useMemo(() => user?.uid || null, [user?.uid]);
  const userEmail = useMemo(() => user?.email || null, [user?.email]);
  const userGroups = useMemo(() => user?.groups ? Object.keys(user.groups) : [], [user?.groups]);

  // Use isolated search state to prevent re-renders
  const { currentQuery, results, isLoading, performSearch, clearSearch } = useSearchState(userId, userGroups);

  // Groups feature is always enabled (per memories) - no need for feature flag listener
  const groupsEnabled = true;

  // Get initial query from URL only once on mount
  const initialQuery = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get('q');
      return q && q.trim() ? q.trim() : '';
    }
    return '';
  }, []); // Empty dependency array - only run once






  // Perform initial search if there's a query in the URL
  // Use a ref to track if we've performed the initial search
  const hasPerformedInitialSearch = useRef(false);

  useEffect(() => {
    // Only perform initial search when:
    // 1. We have a query in the URL
    // 2. Authentication loading is complete
    // 3. We haven't already performed the initial search
    if (initialQuery && !authLoading && !hasPerformedInitialSearch.current) {
      console.log('Performing initial search for:', initialQuery, 'with userId:', userId || 'public');
      hasPerformedInitialSearch.current = true;
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch, userId, authLoading]);

  // Memoized callback functions for SearchInput component - NO URL UPDATES HERE
  const handleSearch = useCallback((searchTerm) => {
    performSearch(searchTerm);
    // URL updates are handled by URLSynchronizer component
  }, [performSearch]);

  // Stable clear function with no dependencies to prevent re-renders
  const handleClear = useCallback(() => {
    clearSearch();
    // URL updates are handled by URLSynchronizer component
  }, [clearSearch]);

  // Stable save function - memoized with userId dependency
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
  }, [userId]);

  // Stable submit function with performSearch dependency
  const handleSubmit = useCallback((searchTerm) => {
    performSearch(searchTerm);
    // URL updates are handled by URLSynchronizer component
  }, [performSearch]);

  // Stable helper function to copy to clipboard with toast notification
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

  // Stable share search URL function - no dependencies to prevent re-renders
  const shareSearchUrl = useCallback(() => {
    const url = new URL(window.location);
    // Get current query from URL instead of state to avoid dependency
    const searchTerm = url.searchParams.get('q') || '';
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
  }, [copyToClipboard]);

  // All search content is now isolated in SearchPageContent component

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Performance monitoring - only active in development */}
      <PerformanceMonitor
        name="SearchPage"
        data={{
          userId,
          userEmail,
          currentQuery,
          isLoading,
          groupsEnabled,
          initialQuery,
          hasResults: !!(results?.pages?.length || results?.users?.length)
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

      {/* Search Input Component - Completely Isolated */}
      <IsolatedSearchInput
        initialValue={initialQuery}
        onSearch={handleSearch}
        onClear={handleClear}
        onSave={handleSave}
        onSubmit={handleSubmit}
        autoFocus={true}
        placeholder="Search for pages, users..."
      />

      {/* Search Results Display Component */}
      <SearchResultsDisplay
        query={currentQuery}
        results={results}
        isLoading={isLoading}
        groupsEnabled={groupsEnabled}
        userId={userId}
        onSave={handleSave}
      />
    </div>
  );
});

SearchPage.displayName = 'SearchPage';

export default SearchPage;
