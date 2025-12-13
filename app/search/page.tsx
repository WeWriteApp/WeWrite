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
import { addRecentSearch, addRecentSearchDebounced } from "../utils/recentSearches";
import NavPageLayout from '../components/layout/NavPageLayout';
import { useUnifiedSearch, SEARCH_CONTEXTS } from "../hooks/useUnifiedSearch";
import RecentSearches from '../components/search/RecentSearches';
import { getAnalyticsService } from '../utils/analytics-service';
import { SHARE_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

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

// Real-time search input - searches as you type with debouncing
const RealtimeSearchInput = React.memo<IsolatedSearchInputProps & { isLoading?: boolean }>(({ onSearch, onClear, onSave, onSubmit, initialValue, autoFocus, placeholder, isLoading }) => {
  const [inputValue, setInputValue] = useState(initialValue || '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update input value when initialValue changes (for recent search selection)
  useEffect(() => {
    if (initialValue !== undefined) {
      setInputValue(initialValue);
    }
  }, [initialValue]);

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Real-time input change handler with debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the search - wait 200ms after user stops typing
    debounceTimeoutRef.current = setTimeout(() => {
      if (onSearch) {
        onSearch(newValue);
      }
    }, 200);
  }, [onSearch]);

  // Handle form submission (Enter key) - immediate search
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Clear debounce and search immediately
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (onSubmit) {
      onSubmit(inputValue);
    } else if (onSearch) {
      onSearch(inputValue);
    }
  }, [inputValue, onSearch, onSubmit]);

  // Handle clear button
  const handleClear = useCallback(() => {
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setInputValue("");
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="relative">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          leftIcon={<Search className="h-5 w-5" />}
          className="w-full pr-12"
          autoComplete="off"
        />

        {/* Right side - loading indicator or clear button */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1 z-20">
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          ) : inputValue.trim() ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
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
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.isLoading === nextProps.isLoading
  );
});

RealtimeSearchInput.displayName = 'RealtimeSearchInput';

// Memoize the entire SearchPage component to prevent unnecessary re-renders
const SearchPage = React.memo(() => {
  const { user, isAuthenticated } = useAuth();

  // Memoize user data to prevent unnecessary re-renders
  const userId = useMemo(() => user?.uid || null, [user?.uid]);
  const userEmail = useMemo(() => user?.email || null, [user?.email]);
  // Groups functionality removed

  // Use unified search system - single source of truth
  const { currentQuery, results, isLoading, performSearch, debouncedSearch, clearSearch, error, searchStats } = useUnifiedSearch(userId, {
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
        // Ignore AbortError - it's expected when a new search cancels this one
        if (error?.name === 'AbortError') {
          console.log('Initial search aborted (expected if user started typing)');
          return;
        }

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

  // Search handler - real-time search as user types
  const handleSearch = useCallback((searchTerm) => {
    // Perform search (already debounced by the input component)
    performSearch(searchTerm);

    // Handle side effects - save recent search after a delay (only for meaningful searches)
    if (searchTerm && searchTerm.trim() && searchTerm.trim().length >= 2) {
      // Use longer debounce for recent search saving since user is still typing
      addRecentSearchDebounced(searchTerm.trim(), userId, 3000);
    }

    // Update URL to reflect the search query (without triggering navigation)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      if (searchTerm && searchTerm.trim()) {
        url.searchParams.set('q', searchTerm.trim());
      } else {
        url.searchParams.delete('q');
      }
      window.history.replaceState({}, '', url);
    }
  }, [performSearch, userId]);

  // Handle recent search selection - this will update the input and perform search
  const handleRecentSearchSelect = useCallback(async (searchTerm) => {
    // Perform the search
    performSearch(searchTerm);

    // For recent search selection, always save immediately (intentional action)
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

  // Stable submit function - for intentional searches (Enter key)
  const handleSubmit = useCallback(async (searchTerm) => {
    performSearch(searchTerm);

    // For intentional searches (Enter key), always save immediately
    // This bypasses the smart filtering since the user explicitly searched
    if (searchTerm && searchTerm.trim()) {
      try {
        await addRecentSearch(searchTerm.trim(), userId);
      } catch (error) {
        console.error('Error saving recent search:', error);
      }
    }

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
  }, [performSearch, userId]);

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
    // Note: We intentionally don't include 'text' in the share payload
    // because many apps concatenate text+url, which pollutes the search query
    // when the link is opened

    // Get analytics service
    const analytics = getAnalyticsService();

    // Track share started
    analytics?.trackInteractionEvent(SHARE_EVENTS.SEARCH_SHARE_STARTED, {
      category: EVENT_CATEGORIES.SHARE,
      action: SHARE_EVENTS.SEARCH_SHARE_STARTED,
      search_query: searchTerm,
      has_query: Boolean(searchTerm)
    });

    // Try to use the Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: url.toString()
      })
      .then(() => {
        // Track successful share
        analytics?.trackInteractionEvent(SHARE_EVENTS.SEARCH_SHARE_SUCCEEDED, {
          category: EVENT_CATEGORIES.SHARE,
          action: SHARE_EVENTS.SEARCH_SHARE_SUCCEEDED,
          search_query: searchTerm,
          share_method: 'native_share',
          has_query: Boolean(searchTerm)
        });
        console.log("Content shared successfully");
      })
      .catch(err => {
        console.error('Error sharing:', err);
        // Track cancelled or failed share
        if (err.name === 'AbortError') {
          analytics?.trackInteractionEvent(SHARE_EVENTS.SEARCH_SHARE_CANCELLED, {
            category: EVENT_CATEGORIES.SHARE,
            action: SHARE_EVENTS.SEARCH_SHARE_CANCELLED,
            search_query: searchTerm,
            share_method: 'native_share',
            has_query: Boolean(searchTerm)
          });
        } else {
          analytics?.trackInteractionEvent(SHARE_EVENTS.SEARCH_SHARE_FAILED, {
            category: EVENT_CATEGORIES.SHARE,
            action: SHARE_EVENTS.SEARCH_SHARE_FAILED,
            search_query: searchTerm,
            share_method: 'native_share',
            error_message: err.message,
            has_query: Boolean(searchTerm)
          });
          // Fallback to clipboard if sharing was cancelled or failed
          copyToClipboard(url.toString());
        }
      });
    } else {
      // Fallback for browsers that don't support the Web Share API
      copyToClipboard(url.toString());
      // Track successful clipboard copy
      analytics?.trackInteractionEvent(SHARE_EVENTS.SEARCH_SHARE_SUCCEEDED, {
        category: EVENT_CATEGORIES.SHARE,
        action: SHARE_EVENTS.SEARCH_SHARE_SUCCEEDED,
        search_query: searchTerm,
        share_method: 'copy_link',
        has_query: Boolean(searchTerm)
      });
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

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Search</h1>
        <p className="text-muted-foreground">Find pages, users, and content across WeWrite</p>
      </div>

      {/* Search Input Component - Real-time search as you type */}
      <RealtimeSearchInput
        initialValue={initialQuery || currentQuery}
        onSearch={handleSearch}
        onClear={handleClear}
        onSave={handleSave}
        onSubmit={handleSubmit}
        autoFocus={true}
        placeholder="Search for pages, users..."
        isLoading={isLoading}
      />

      {/* Recent Searches - only show when no active search */}
      {!currentQuery && (
        <RecentSearches
          onSelect={handleRecentSearchSelect}
          userId={userId}
        />
      )}

      {/* Search Results Header with Share and Save Buttons */}
      {currentQuery && currentQuery.trim() && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Search Results</h2>
            <p className="text-sm text-muted-foreground">
              Results for "{currentQuery}"
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave(currentQuery)}
              className="flex items-center gap-2"
              aria-label="Save search"
            >
              <Pin className="h-4 w-4" />
              <span className="hidden sm:inline">Save search</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={shareSearchUrl}
              className="flex items-center gap-2"
              aria-label="Share search results"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      )}

      {/* Search Results Display Component */}
      <SearchResultsDisplay
        query={currentQuery}
        results={results}
        isLoading={isLoading}
        groupsEnabled={groupsEnabled}
        userId={userId}
        error={error}
        searchStats={searchStats}
      />
    </NavPageLayout>
  );
});

SearchPage.displayName = 'SearchPage';

export default SearchPage;