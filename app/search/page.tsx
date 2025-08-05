"use client";

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Share2, Search, X, Pin } from 'lucide-react';
import { toast } from '../components/ui/use-toast';
import Link from 'next/link';
import { saveSearchQuery } from "../utils/savedSearches";
import { addRecentSearch } from "../utils/recentSearches";
import NavPageLayout from '../components/layout/NavPageLayout';
import { useUnifiedSearch, SEARCH_CONTEXTS } from "../hooks/useUnifiedSearch";
import RecentSearches from '../components/search/RecentSearches';

// Import the new separated components
import SearchResultsDisplay from '../components/search/SearchResultsDisplay.js';
import PerformanceMonitor from '../components/utils/PerformanceMonitor.js';

// TypeScript interfaces
interface IsolatedSearchInputProps {
  onSearch?: (value: string) => void;
  onClear?: () => void;
  onSave?: (value: string) => void;
  onSubmit?: (value: string) => void;
  initialValue?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

// Debounce utility function
function debounce(func: (...args: any[]) => void, wait: number, immediate = false) {
  let timeout: NodeJS.Timeout | null;

  const debounced = function(...args: any[]) {
    const context = this;

    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };

  debounced.cancel = function() {
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
}

// Completely isolated search input that doesn't cause parent re-renders
const IsolatedSearchInput = React.memo<IsolatedSearchInputProps>(({ onSearch, onClear, onSave, onSubmit, initialValue, autoFocus, placeholder }) => {
  const [inputValue, setInputValue] = useState(initialValue || '');
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastSearchValue = useRef('');

  // Update input value when initialValue changes (for recent search selection)
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== inputValue) {
      setInputValue(initialValue);
    }
  }, [initialValue]);

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

  // Note: URL synchronization is handled by the parent component

  // Debounced search function
  const debouncedSearch = useCallback((value) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (value !== lastSearchValue.current && onSearch) {
        lastSearchValue.current = value;
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
      onSubmit(inputValue);
    }
  }, [inputValue, onSubmit]);

  // Handle clear button
  const handleClear = useCallback(() => {
    setInputValue("");
    lastSearchValue.current = "";
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
  const { user, isAuthenticated } = useAuth();

  // Memoize user data to prevent unnecessary re-renders
  const userId = useMemo(() => user?.uid || null, [user?.uid]);
  const userEmail = useMemo(() => user?.email || null, [user?.email]);
  // Groups functionality removed

  // Use unified search system - single source of truth
  const { currentQuery, results, isLoading, performSearch, clearSearch, error, searchStats } = useUnifiedSearch(userId, {
    context: SEARCH_CONTEXTS.MAIN,
    includeContent: true,
    includeUsers: true,
    maxResults: 200
  });

  // Groups functionality removed
  const groupsEnabled = false;

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
  const initialSearchAttempts = useRef(0);
  const maxInitialSearchAttempts = 3;

  useEffect(() => {
    // CRITICAL FIX: Perform initial search immediately if there's a query
    // Don't wait for authentication - the search API handles unauthenticated users
    if (initialQuery && !hasPerformedInitialSearch.current && initialSearchAttempts.current < maxInitialSearchAttempts) {
      console.log('Performing initial search for:', initialQuery, 'attempt:', initialSearchAttempts.current + 1, 'with userId:', userId || 'public');

      initialSearchAttempts.current += 1;

      // Perform the search with retry logic
      performSearch(initialQuery).then(() => {
        console.log('Initial search completed successfully');
        hasPerformedInitialSearch.current = true;
      }).catch((error) => {
        console.error('Initial search failed, attempt', initialSearchAttempts.current, ':', error);

        // If we haven't reached max attempts, try again after a short delay
        if (initialSearchAttempts.current < maxInitialSearchAttempts) {
          setTimeout(() => {
            // Reset the flag to allow retry
            hasPerformedInitialSearch.current = false;
          }, 1000 * initialSearchAttempts.current); // Exponential backoff
        } else {
          console.error('Max initial search attempts reached, giving up');
          hasPerformedInitialSearch.current = true;
        }
      });
    }
  }, [initialQuery, performSearch, userId]); // Removed authLoading dependency

  // Memoized callback functions for SearchInput component
  const handleSearch = useCallback(async (searchTerm) => {
    performSearch(searchTerm);

    // Save to recent searches if it's a valid search term
    if (searchTerm && searchTerm.trim()) {
      try {
        await addRecentSearch(searchTerm.trim(), userId);
      } catch (error) {
        console.error('Error saving recent search:', error);
      }
    }

    // Update URL to reflect the search query
    const url = new URL(window.location);
    if (searchTerm && searchTerm.trim()) {
      url.searchParams.set('q', searchTerm.trim());
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url);
  }, [performSearch, userId]);

  // Handle recent search selection - this will update the input and perform search
  const handleRecentSearchSelect = useCallback((searchTerm) => {
    // This will trigger both the input update and the search
    handleSearch(searchTerm);
  }, [handleSearch]);

  // Stable clear function
  const handleClear = useCallback(() => {
    clearSearch();

    // Clear URL query parameter
    const url = new URL(window.location);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }, [clearSearch]);

  // Stable save function - memoized with userId dependency
  const handleSave = useCallback((searchTerm) => {
    if (!userId || !searchTerm) return;

    const saved = saveSearchQuery(searchTerm, userId);
    if (saved) {
      // Force refresh the saved searches component
      const savedSearchesEvent = new Event('savedSearchesUpdated');
      window.dispatchEvent(savedSearchesEvent);
    }
  }, [userId]);

  // Stable submit function
  const handleSubmit = useCallback((searchTerm) => {
    performSearch(searchTerm);

    // Update URL to reflect the search query (client-side only)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      if (searchTerm && searchTerm.trim()) {
        url.searchParams.set('q', searchTerm.trim());
      } else {
        url.searchParams.delete('q');
      }
      window.history.replaceState({}, '', url);
    }
  }, [performSearch]);

  // Stable helper function to copy to clipboard with toast notification
  const copyToClipboard = useCallback((textToCopy) => {
    // Guard against server-side rendering
    if (typeof window === 'undefined' || !navigator.clipboard) return;

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        console.log("Link copied to clipboard");
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
        toast({
          title: "Copy failed",
          description: "Could not copy the URL to clipboard",
          variant: "destructive"});
      });
  }, []);

  // Stable share search URL function - no dependencies to prevent re-renders
  const shareSearchUrl = useCallback(() => {
    // Guard against server-side rendering
    if (typeof window === 'undefined') return;

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
    <NavPageLayout>
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

      {/* Search Input Component - Completely Isolated */}
      <IsolatedSearchInput
        initialValue={currentQuery || initialQuery}
        onSearch={handleSearch}
        onClear={handleClear}
        onSave={handleSave}
        onSubmit={handleSubmit}
        autoFocus={true}
        placeholder="Search for pages, users..."
      />

      {/* Recent Searches - only show when no active search */}
      {!currentQuery && (
        <RecentSearches
          onSelect={handleRecentSearchSelect}
          userId={userId}
        />
      )}

      {/* Search Results Header with Share Button */}
      {currentQuery && currentQuery.trim() && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Search Results</h2>
            <p className="text-sm text-muted-foreground">
              Results for "{currentQuery}"
            </p>
          </div>
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
      )}

      {/* Search Results Display Component */}
      <SearchResultsDisplay
        query={currentQuery}
        results={results}
        isLoading={isLoading}
        groupsEnabled={groupsEnabled}
        userId={userId}
        onSave={handleSave}
        error={error}
        searchStats={searchStats}
      />
    </NavPageLayout>
  );
});

SearchPage.displayName = 'SearchPage';

export default SearchPage;