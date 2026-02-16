"use client";

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from '../components/ui/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveSearchQuery } from "../utils/savedSearches";
import { addRecentSearch, addRecentSearchDebounced } from "../utils/recentSearches";
import NavPageLayout from '../components/layout/NavPageLayout';
import { useUnifiedSearch, SEARCH_CONTEXTS } from "../hooks/useUnifiedSearch";
import RecentSearches from '../components/search/RecentSearches';
import SavedSearches from '../components/search/SavedSearches';
import { getAnalyticsService } from '../utils/analytics-service';
import { SHARE_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { useHasKeyboard } from '../hooks/useHasKeyboard';

// Import the new separated components
import SearchResultsDisplay from '../components/search/SearchResultsDisplay';
import PerformanceMonitor from '../components/utils/PerformanceMonitor';

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
  // Track whether the user is actively typing (to prevent external state from overwriting input)
  const isUserTypingRef = useRef(false);
  const lastUserInputRef = useRef(initialValue || '');

  // Update input value when initialValue changes ONLY if:
  // 1. User is not actively typing
  // 2. The change is significant (not just trimming whitespace from user's current input)
  // This handles cases like selecting a recent search, but won't interfere with typing
  useEffect(() => {
    if (initialValue !== undefined && !isUserTypingRef.current) {
      // Only update if the trimmed values are different (meaning it's a new search selection, not a trim)
      const currentTrimmed = lastUserInputRef.current.trim();
      const newTrimmed = initialValue.trim();
      if (currentTrimmed !== newTrimmed) {
        setInputValue(initialValue);
        lastUserInputRef.current = initialValue;
      }
    }
  }, [initialValue]);

  // Auto-focus effect - focus immediately for iOS keyboard activation
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      // Focus immediately on mount - this helps iOS PWA open the keyboard
      searchInputRef.current.focus();

      // Also try again after a brief delay as a fallback for slower renders
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
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

    // Mark that user is actively typing - prevents external state from overwriting input
    isUserTypingRef.current = true;
    lastUserInputRef.current = newValue;

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the search - wait 200ms after user stops typing
    debounceTimeoutRef.current = setTimeout(() => {
      if (onSearch) {
        onSearch(newValue);
      }
      // After the debounced search fires, allow external updates again
      // Use a small delay to let the search results propagate
      setTimeout(() => {
        isUserTypingRef.current = false;
      }, 100);
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
    // Reset typing tracking
    isUserTypingRef.current = false;
    lastUserInputRef.current = "";
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
          leftIcon={<Icon name="Search" size={20} />}
          className="w-full pr-12"
          autoComplete="off"
          autoFocus={autoFocus}
        />

        {/* Right side - loading indicator or clear button */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1 z-20">
          {isLoading ? (
            <Icon name="Loader" size={16} />
          ) : inputValue.trim() ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <Icon name="X" size={16} />
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
  const router = useRouter();

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

  const hasKeyboard = useHasKeyboard();

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedIndexRef = useRef(-1); // Keep ref in sync for event handlers
  const resultsCountRef = useRef(0);
  const [recentSearchesCount, setRecentSearchesCount] = useState(0);

  // Keep selectedIndexRef in sync with selectedIndex state
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Build flat results list for navigation (same order as SearchResultsDisplay)
  const flatResultsUrls = useMemo(() => {
    const urls: string[] = [];
    if (results?.users) {
      results.users.forEach(user => urls.push(`/user/${user.id}`));
    }
    if (results?.pages) {
      results.pages.forEach(page => urls.push(`/${page.id}`));
    }
    return urls;
  }, [results]);

  // Update results count when results change
  useEffect(() => {
    resultsCountRef.current = flatResultsUrls.length;
    // Reset selection when results change
    setSelectedIndex(-1);
  }, [flatResultsUrls]);

  // Reset selection when switching between search results and recent searches
  useEffect(() => {
    setSelectedIndex(-1);
  }, [!!currentQuery]);

  // Callback for RecentSearches to report count
  const handleRecentSearchesChange = useCallback((count: number) => {
    setRecentSearchesCount(count);
  }, []);

  // Store flatResultsUrls in a ref for the event handler
  const flatResultsUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    flatResultsUrlsRef.current = flatResultsUrls;
  }, [flatResultsUrls]);

  // Store currentQuery in a ref for the event handler
  const currentQueryRef = useRef<string>('');
  useEffect(() => {
    currentQueryRef.current = currentQuery;
  }, [currentQuery]);

  // Store recentSearchesCount in a ref for the event handler
  const recentSearchesCountRef = useRef(0);
  useEffect(() => {
    recentSearchesCountRef.current = recentSearchesCount;
  }, [recentSearchesCount]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use refs to get the latest values (avoids stale closure issues)
      const currentSelectedIndex = selectedIndexRef.current;
      const hasQuery = !!currentQueryRef.current?.trim();
      const itemCount = hasQuery ? resultsCountRef.current : recentSearchesCountRef.current;
      const urls = flatResultsUrlsRef.current;

      // Only handle keyboard navigation when there are items
      if (itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = prev + 1;
            return next >= itemCount ? 0 : next;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = prev - 1;
            return next < 0 ? itemCount - 1 : next;
          });
          break;

        case 'Enter':
          // Navigate/select if an item is selected
          // This takes priority over the input's form submit when an item is highlighted
          if (currentSelectedIndex >= 0) {
            e.preventDefault();
            e.stopPropagation();
            if (hasQuery) {
              // Navigate to search result
              const url = urls[currentSelectedIndex];
              if (url) {
                router.push(url);
              }
            } else {
              // Select recent search - trigger the onSelect callback
              const recentSearchEvent = new CustomEvent('selectRecentSearch', {
                detail: { index: currentSelectedIndex }
              });
              window.dispatchEvent(recentSearchEvent);
            }
          }
          // If no item is selected, let the input's form submit handler handle it
          break;

        case 'Escape':
          // Clear selection
          setSelectedIndex(-1);
          break;
      }
    };

    // Use capture phase to intercept Enter before form submission
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [router]); // Minimal dependencies since we use refs for everything else

  // Callback for SearchResultsDisplay to report count
  const handleResultsChange = useCallback((count: number) => {
    resultsCountRef.current = count;
  }, []);

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

      initialSearchAttempts.current += 1;

      // Perform the search with retry logic
      performSearch(initialQuery).then(() => {
        hasPerformedInitialSearch.current = true;
      }).catch((error) => {
        // Ignore AbortError - it's expected when a new search cancels this one
        if (error?.name === 'AbortError') {
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

      {/* Saved and Recent Searches - only show when no active search */}
      {!currentQuery && (
        <>
          <SavedSearches
            onSelect={handleRecentSearchSelect}
            userId={userId}
          />
          <RecentSearches
            onSelect={handleRecentSearchSelect}
            userId={userId}
            selectedIndex={selectedIndex}
            onItemsChange={handleRecentSearchesChange}
          />
          {/* Keyboard navigation hint for recent searches */}
          {hasKeyboard && recentSearchesCount > 0 && selectedIndex === -1 && (
            <p className="text-xs text-muted-foreground/60 mt-2">
              Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↓</kbd> to navigate recent searches, <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to search
            </p>
          )}
        </>
      )}

      {/* Search Results Header with Share and Save Buttons */}
      {currentQuery && currentQuery.trim() && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  {((results?.pages?.length || 0) + (results?.users?.length || 0))} results for "{currentQuery}"
                  {searchStats?.searchTimeMs && (
                    <span className="ml-1">({searchStats.searchTimeMs}ms)</span>
                  )}
                </>
              )}
            </p>
            {/* Keyboard navigation hint - only show when there are results and nothing selected */}
            {hasKeyboard && !isLoading && flatResultsUrls.length > 0 && selectedIndex === -1 && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↓</kbd> to navigate, <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to open
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave(currentQuery)}
              className="flex items-center gap-2"
              aria-label="Save search"
            >
              <Icon name="Pin" size={16} />
              <span className="hidden sm:inline">Save search</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={shareSearchUrl}
              className="flex items-center gap-2"
              aria-label="Share search results"
            >
              <Icon name="Share2" size={16} />
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
        selectedIndex={selectedIndex}
        onResultsChange={handleResultsChange}
      />
    </NavPageLayout>
  );
});

SearchPage.displayName = 'SearchPage';

export default SearchPage;