"use client";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '../../providers/AuthProvider';
// Removed unused Firebase imports - component already uses API endpoints
import { navigateToPage } from "../../utils/pagePermissions";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import { useDateFormat } from "../../contexts/DateFormatContext";
import debounce from "lodash.debounce";
import { Search, Filter, Plus } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ClearableInput } from "../ui/clearable-input";
import { PillLink } from "../utils/PillLink";
import { UsernameBadge } from "../ui/UsernameBadge";
import { getBatchUserData } from '../../utils/apiDeduplication';
import searchPerformanceMonitor from '../../utils/searchPerformanceMonitor';
import { shouldAllowRequest } from "../../utils/requestThrottle";
import { cn, wewriteCard } from '../../lib/utils';

// Simple Loader component
const Loader = () => {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>
  );
};

/**
 * FilteredSearchResults Component
 *
 * Enhanced search component with filter chips for Recent and My Pages.
 * Supports both link editor mode and general search functionality.
 */
const FilteredSearchResults = forwardRef(({
  onSelect = null,
  userId = null,
  placeholder = "Search...",
  initialSelectedId = null,
  editableOnly = false,
  initialSearch = "",
  displayText = "",
  setDisplayText = null,
  onInputChange = null,
  preventRedirect = false,
  className = "",
  autoFocus = false,
  onFocus = null,
  linkedPageIds = [],
  currentPageId = null,
  hideCreateButton = false,
  rightButtons = null,
  onFilterToggle = null}, ref) => {
  const { user } = useAuth();
  const router = useRouter();
  const { formatDate: formatDateString } = useDateFormat();

  // State management
  const [search, setSearch] = useState(initialSearch);
  const [pages, setPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [pageDataCache, setPageDataCache] = useState(new Map());
  const [activeFilter, setActiveFilter] = useState('recent');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [userSubscriptionData, setUserSubscriptionData] = useState(new Map());
  const [showFilters, setShowFilters] = useState(false);

  // Refs
  const searchInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastRequestRef = useRef(null); // Track last request to prevent duplicates

  // Determine if we're in link editor mode
  const isLinkEditor = !!setDisplayText || preventRedirect;

  // Character count threshold for search
  const characterCount = isLinkEditor ? 0 : 2;

  // Fetch user subscription data for pages
  const fetchUserSubscriptionData = useCallback(async (pages) => {
    if (!pages || pages.length === 0) return;

    // Extract unique user IDs from pages
    const userIds = [...new Set(pages.map(page => page.userId).filter(Boolean))];
    if (userIds.length === 0) return;

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
  }, []);

  // Reset search results
  const resetSearchResults = useCallback(() => {
    setPages([]);
    setUsers([]);
    setGroups([]);
    setIsSearching(false);
    // Clear any pending request signature
    lastRequestRef.current = null;
  }, []);

  // Fetch comprehensive search results and apply filtering client-side
  const fetchFilteredResults = useCallback(async (searchTerm, filter, searchMode = false) => {
    if (!user) {
      console.log('[FilteredSearchResults] No user, skipping fetch');
      return;
    }

    // Check request throttling to prevent excessive API calls
    const requestType = `search:${filter}:${searchMode ? 'search' : 'filter'}`;
    if (!shouldAllowRequest(requestType)) {
      console.warn('[FilteredSearchResults] Request throttled:', requestType);
      return;
    }

    // Create request signature for deduplication
    const requestSignature = `${searchTerm}-${filter}-${searchMode}-${user.uid}`;

    // IMPROVED: Only skip if the exact same request is in progress AND we haven't cleared it
    if (lastRequestRef.current === requestSignature && abortControllerRef.current) {
      console.log('[FilteredSearchResults] Skipping duplicate request:', requestSignature);
      return;
    }

    // Cancel any ongoing request before starting new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    lastRequestRef.current = requestSignature;

    console.log('[FilteredSearchResults] Fetching results - filter:', filter, 'searchTerm:', searchTerm, 'searchMode:', searchMode, 'userId:', user.uid);

    // CRITICAL FIX: Always set loading state immediately
    setIsSearching(true);
    const searchStartTime = Date.now();

    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const encodedSearch = encodeURIComponent(searchTerm.trim());

      // Choose the appropriate API based on mode and filter
      let queryUrl;
      if (isLinkEditor) {
        // Use unified search API for link editor context
        queryUrl = `/api/search-unified?searchTerm=${encodedSearch}&userId=${user.uid}&context=link_editor&maxResults=25&titleOnly=true&includeUsers=false`;

        // Add current page ID to exclude it from results if available
        const currentPageId = new URLSearchParams(window.location.search).get('currentPageId');
        if (currentPageId) {
          queryUrl += `&currentPageId=${currentPageId}`;
        }
      } else {
        // Use unified search API for general search
        queryUrl = `/api/search-unified?searchTerm=${encodedSearch}&userId=${user.uid}&context=main&titleOnly=false&maxResults=50&includeContent=true&includeUsers=true`;
      }

      console.log('[FilteredSearchResults] Making API request to:', queryUrl, 'for searchMode:', searchMode);

      const response = await fetch(queryUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      // Check if request was aborted after fetch
      if (abortControllerRef.current.signal.aborted) {
        console.log('[FilteredSearchResults] Request was aborted after fetch');
        return;
      }

      console.log('[FilteredSearchResults] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FilteredSearchResults] Response error:', errorText);
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[FilteredSearchResults] Response data:', data);

      // CRITICAL FIX: Validate response data structure to prevent null results
      if (!data || typeof data !== 'object') {
        console.error('[FilteredSearchResults] Invalid response data structure:', data);
        throw new Error('Invalid response data structure');
      }

      // Record search performance
      const searchDuration = Date.now() - searchStartTime;
      const searchType = isLinkEditor ? 'linkEditorEnhanced' : 'optimized';

      let resultCount = 0;
      if (isLinkEditor && data.results) {
        resultCount = data.results.length;
      } else if (data.pages) {
        resultCount = data.pages.length;
      }

      const cacheHit = data.source && data.source.includes('cache');
      searchPerformanceMonitor.recordSearch(searchType, searchTerm, searchDuration, resultCount, cacheHit, data.source);

      // Handle enhanced search results for link editor
      if (isLinkEditor && data.results) {
        // Process enhanced search results with different types
        const allResults = Array.isArray(data.results) ? data.results : [];
        const pageResults = allResults.filter(r => r.type === 'page');
        const userResults = allResults.filter(r => r.type === 'user');
        const groupResults = allResults.filter(r => r.type === 'group');

        console.log('[FilteredSearchResults] Enhanced results:', {
          total: allResults.length,
          pages: pageResults.length,
          users: userResults.length,
          groups: groupResults.length
        });

        // Apply client-side filtering for enhanced results
        let filteredPages = pageResults;
        if (!searchMode && filter === 'my-pages') {
          filteredPages = pageResults.filter(page => page.userId === user.uid);
        } else if (!searchMode && filter === 'recent') {
          filteredPages = pageResults.sort((a, b) => {
            if (a.userId === user.uid && b.userId !== user.uid) return -1;
            if (b.userId === user.uid && a.userId !== user.uid) return 1;
            const aTime = new Date(a.lastModified || 0).getTime();
            const bTime = new Date(b.lastModified || 0).getTime();
            return bTime - aTime;
          });
        }

        // Filter out current page if specified
        if (currentPageId) {
          filteredPages = filteredPages.filter(page => page.id !== currentPageId);
        }

        setPages(filteredPages);
        setUsers(userResults);
        setGroups(groupResults);

        // Fetch subscription data for page authors
        fetchUserSubscriptionData(filteredPages);

        console.log('[FilteredSearchResults] Set enhanced results:', {
          pages: filteredPages.length,
          users: userResults.length,
          groups: groupResults.length
        });

      } else {
        // Handle regular search results
        let allPages = data.pages || [];
        console.log('[FilteredSearchResults] Total pages from search:', allPages.length);

        // Ensure allPages is an array before filtering
        const safeAllPages = Array.isArray(allPages) ? allPages : [];

        // For regular search mode, apply client-side filtering if needed
        let filteredPages = safeAllPages;

        if (!searchMode && filter === 'my-pages') {
          // Filter to only show user's own pages (only for non-link editor mode)
          filteredPages = safeAllPages.filter(page => page.userId === user.uid);
          console.log('[FilteredSearchResults] Filtered to my pages:', filteredPages.length);
        } else if (!searchMode && filter === 'recent') {
          // For recent filter in non-link editor mode, sort by recency
          filteredPages = safeAllPages.sort((a, b) => {
            // Prioritize user's own pages
            if (a.userId === user.uid && b.userId !== user.uid) return -1;
            if (b.userId === user.uid && a.userId !== user.uid) return 1;

            // Then sort by last modified
            const aTime = new Date(a.lastModified || 0).getTime();
            const bTime = new Date(b.lastModified || 0).getTime();
            return bTime - aTime;
          });
          console.log('[FilteredSearchResults] Sorted for recent filter:', filteredPages.length);
        } else {
          // Use pages as-is (already filtered server-side)
          console.log('[FilteredSearchResults] Using server-filtered pages:', filteredPages.length);
        }

        // Filter out current page if specified
        if (currentPageId) {
          filteredPages = filteredPages.filter(page => page.id !== currentPageId);
          console.log('[FilteredSearchResults] Filtered out current page:', currentPageId, 'remaining:', filteredPages.length);
        }

        setPages(filteredPages);
        setUsers([]); // Clear users for regular search
        setGroups([]); // Clear groups for regular search

        // Fetch subscription data for page authors
        fetchUserSubscriptionData(filteredPages);

        console.log('[FilteredSearchResults] Set filtered pages:', filteredPages.length, 'pages');
        console.log('[FilteredSearchResults] Pages state updated:', filteredPages);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[FilteredSearchResults] Search request was aborted');
        return;
      }
      console.error("[FilteredSearchResults] Error fetching results", error);
      resetSearchResults();
    } finally {
      setIsSearching(false);
      // Clear the request signature when request completes
      if (lastRequestRef.current === requestSignature) {
        lastRequestRef.current = null;
      }
    }
  }, [user, resetSearchResults]);

  // Debounced search function with improved reliability to prevent race conditions
  const debouncedSearch = useCallback(
    debounce(async (searchTerm, searchMode = false) => {
      if (!user) {
        console.log('[FilteredSearchResults] No user available for search');
        return;
      }

      // In link editor mode, always show results (even with empty search)
      // In regular mode, only search if there's a search term
      if (!searchTerm && !isLinkEditor) {
        console.log('[FilteredSearchResults] Empty search term, resetting results');
        resetSearchResults();
        return;
      }

      console.log('[FilteredSearchResults] Debounced search triggered:', { searchTerm, searchMode, activeFilter });

      try {
        await fetchFilteredResults(searchTerm, activeFilter, searchMode);
      } catch (error) {
        console.error('[FilteredSearchResults] Error in debounced search:', error);
        // Don't reset results on error - let the user retry
      }
    }, 500), // Standardized to 500ms for better responsiveness while preventing excessive requests
    [user, isLinkEditor, resetSearchResults, fetchFilteredResults, activeFilter]
  );

  // Handle search input changes
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearch(value);

    if (onInputChange) {
      onInputChange(value);
    }

    // When user types text, enter search mode and deselect filter chips
    if (value.trim().length > 0) {
      setIsSearchMode(true);
    } else {
      setIsSearchMode(false);
    }

    // Only search if we have minimum characters or in link editor mode
    if (value.trim().length >= characterCount || isLinkEditor) {
      debouncedSearch(value, value.trim().length > 0);
    } else {
      resetSearchResults();
    }
  }, [debouncedSearch, onInputChange, characterCount, isLinkEditor, resetSearchResults]);

  // Handle clearing the search input
  const handleClear = useCallback(() => {
    setSearch("");
    setSelectedId(null);
    setIsSearchMode(false); // Exit search mode when clearing
    resetSearchResults();

    if (onInputChange) {
      onInputChange("");
    }

    // Focus the input after clearing
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [onInputChange, resetSearchResults]);

  // Handle filter change
  const handleFilterChange = useCallback((filter) => {
    console.log('[FilteredSearchResults] Filter changed to:', filter, 'isLinkEditor:', isLinkEditor, 'search:', search);
    setActiveFilter(filter);
    setIsSearchMode(false); // Exit search mode when selecting a filter

    // Always re-run comprehensive search with new filter
    // This ensures we get all available pages and apply filtering client-side
    if (isLinkEditor) {
      // In link editor mode, always show comprehensive results
      console.log('[FilteredSearchResults] Calling fetchFilteredResults for link editor mode');
      fetchFilteredResults(search, filter, false);
    } else if (search.trim().length >= characterCount) {
      // In regular mode, only search if we have enough characters
      console.log('[FilteredSearchResults] Calling fetchFilteredResults for regular mode');
      fetchFilteredResults(search, filter, false);
    }
  }, [search, characterCount, isLinkEditor, fetchFilteredResults]);

  // Handle item selection
  const handleSelect = useCallback(async (item) => {
    console.log('[FilteredSearchResults] handleSelect called:', {
      itemId: item.id,
      itemTitle: item.title,
      preventRedirect,
      isLinkEditor,
      willNavigate: !preventRedirect && !isLinkEditor
    });

    console.log('🔍 [FILTERED_SEARCH] Full item data:', {
      id: item.id,
      title: item.title,
      username: item.username,
      userId: item.userId,
      hasUsername: !!item.username,
      hasUserId: !!item.userId,
      allKeys: Object.keys(item),
      fullItem: item
    });

    setSelectedId(item.id);

    if (onSelect) {
      onSelect(item);
    }

    // Navigate if not prevented and not in link editor mode
    if (!preventRedirect && !isLinkEditor) {
      try {
        // Use the search result data directly instead of fetching again
        const pageData = {
          id: item.id,
          userId: item.userId,
          isPublic: item.isPublic,
          title: item.title,
          username: item.username
        };

        // Use click-to-edit navigation with search result data
        navigateToPage(item.id, user, pageData, user?.groups, router);
      } catch (error) {
        console.error('Error with page navigation:', error);
        // Fallback to regular navigation
        router.push(`/${item.id}`);
      }
    }
  }, [onSelect, isLinkEditor, preventRedirect, router, user, pageDataCache]);

  // Initialize search on mount and when filter changes
  useEffect(() => {
    console.log('[FilteredSearchResults] useEffect triggered - user:', !!user, 'isLinkEditor:', isLinkEditor, 'activeFilter:', activeFilter, 'initialSearch:', initialSearch);
    if (!user) return; // Wait for user to be available

    if (initialSearch) {
      console.log('[FilteredSearchResults] Running initial search:', initialSearch);
      debouncedSearch(initialSearch);
    } else if (isLinkEditor) {
      // In link editor mode, delay the initial search to prevent excessive API requests
      // This prevents the search from firing immediately when the modal opens
      console.log('[FilteredSearchResults] Setting up delayed search for link editor mode');
      const timer = setTimeout(() => {
        console.log('[FilteredSearchResults] Executing delayed search for filter:', activeFilter);
        fetchFilteredResults('', activeFilter, false);
      }, 500); // Standardized delay to match debounce timing

      return () => clearTimeout(timer);
    }
  }, [initialSearch, debouncedSearch, isLinkEditor, fetchFilteredResults, activeFilter, user]);

  // Auto-focus effect for link editor mode
  useEffect(() => {
    if (autoFocus && (ref?.current || searchInputRef.current)) {
      const inputElement = ref?.current || searchInputRef.current;
      // Wait for component to be fully mounted and any parent animations to complete
      const focusTimer = setTimeout(() => {
        if (inputElement) {
          try {
            inputElement.focus();

            // Select all text if there's initial content
            if (inputElement.value && typeof inputElement.select === 'function') {
              inputElement.select();
            }

            // Trigger virtual keyboard on mobile devices
            if (typeof window !== 'undefined' && 'ontouchstart' in window) {
              inputElement.click();
            }

            // Call onFocus callback if provided
            if (onFocus) {
              onFocus();
            }

            console.log('[FilteredSearchResults] Auto-focused input field');
          } catch (error) {
            console.error('[FilteredSearchResults] Error during auto-focus:', error);
          }
        }
      }, 100); // Small delay to ensure component is ready

      return () => clearTimeout(focusTimer);
    }
  }, [autoFocus, onFocus, ref]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!user) return null;

  return (
    <div className={`flex flex-col h-full min-w-0 ${className}`}>
      {/* Search Input */}
      <div className="relative flex-shrink-0 mb-3 min-w-0">
        <div className="relative">
          {isLinkEditor ? (
            <div className="relative">
              <ClearableInput
                ref={ref || searchInputRef}
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={handleSearchChange}
                onClear={handleClear}
                className={cn("w-full", (rightButtons || onFilterToggle) ? "pr-20" : "")}
                autoComplete="off"
              />
              {/* Right buttons inside input */}
              {(rightButtons || onFilterToggle) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {rightButtons}
                  {onFilterToggle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className={`h-6 w-6 p-0 ${showFilters ? 'bg-muted' : ''}`}
                    >
                      <Filter className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <Input
                ref={ref || searchInputRef}
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={handleSearchChange}
                className="w-full pr-10"
                autoComplete="off"
              />
              {/* Search Icon - only show for non-link editor mode */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Filter Chips - collapsible in link editor mode */}
      {isLinkEditor && (
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showFilters ? 'max-h-20 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
        }`}>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleFilterChange('recent')}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                activeFilter === 'recent' && !isSearchMode
                  ? 'bg-primary text-white'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => handleFilterChange('my-pages')}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                activeFilter === 'my-pages' && !isSearchMode
                  ? 'bg-primary text-white'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              My Pages
            </button>
          </div>
        </div>
      )}

      {/* Search Results - flexible height with proper overflow handling */}
      <div className={`flex-1 min-h-0 space-y-1 transition-all overflow-y-auto overflow-x-hidden ${
        (search.length >= characterCount || isLinkEditor) ? "opacity-100" : "opacity-0"
      }`}>
        {isSearching && (search.length >= characterCount || isLinkEditor) ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <p className="text-xs text-muted-foreground">
              {search.length >= 2 ? `Searching for "${search}"...` : 'Loading pages...'}
            </p>
          </div>
        ) : (
          <>
            {/* Pages Section */}
            {pages.length > 0 && (
              <div className="space-y-1 mb-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  {isLinkEditor && isSearchMode ? 'Pages' :
                   isSearchMode ? 'Search Results' :
                   (activeFilter === 'recent' ? 'Recently Viewed' : 'My Pages')}
                </h3>
                <div className="space-y-1">
                  {pages.map((page) => {
                    const isAlreadyLinked = Array.isArray(linkedPageIds) && linkedPageIds.includes(page.id);
                    return (
                      <button
                        key={page.id}
                        onClick={() => handleSelect(page)}
                        className={`w-full text-left p-2 hover:bg-muted rounded-md transition-colors ${
                          selectedId === page.id ? 'bg-muted' : ''
                        } ${isAlreadyLinked ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0 min-w-0 max-w-[calc(100%-80px)]">
                            <PillLink
                              href={`/${page.id}`}
                              isPublic={page.isPublic}
                              isOwned={page.userId === user?.uid}
                              clickable={false}
                              isLinkEditor={isLinkEditor}
                              onLinkEditorSelect={() => handleSelect(page)}
                            >
                              {page.title && isExactDateFormat(page.title)
                                ? formatDateString(page.title)
                                : page.title}
                            </PillLink>
                          </div>
                          {page.username && page.userId && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                              <span>by</span>
                              <UsernameBadge
                                userId={page.userId}
                                username={page.username}
                                tier={userSubscriptionData.get(page.userId)?.tier}
                                subscriptionStatus={userSubscriptionData.get(page.userId)?.subscriptionStatus}
                                subscriptionAmount={userSubscriptionData.get(page.userId)?.subscriptionAmount}
                                size="sm"
                                variant="link"
                                className="text-xs"
                                isLinkEditor={isLinkEditor}
                                onLinkEditorSelect={() => handleSelect(page)}
                              />
                              {isAlreadyLinked && (
                                <span className="ml-1 text-xs text-muted-foreground/70">
                                  • already linked
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {isLinkEditor && page.category && (
                          <div className="text-xs text-muted-foreground mt-1 px-2">
                            {page.category}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Users Section - only show in link editor mode */}
            {isLinkEditor && users.length > 0 && (
              <div className="space-y-1 mb-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  User Profiles
                </h3>
                <div className="space-y-1">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelect(user)}
                      className={`w-full text-left p-2 hover:bg-muted rounded-md transition-colors ${
                        selectedId === user.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {user.photoURL && (
                          <img
                            src={user.photoURL}
                            alt={user.title}
                            className="w-5 h-5 rounded-full"
                          />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          @{user.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (User Profile)
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Groups functionality removed */}

            {/* No Results - Only show after search has completed and we have attempted a search */}
            {(search.length >= 2 || (isLinkEditor && lastRequestRef.current !== null)) &&
             pages.length === 0 && users.length === 0 && groups.length === 0 && !isSearching && (
              <div className={wewriteCard('default', 'text-center')}>
                <div className="text-muted-foreground">
                  {search.length >= 2
                    ? `No results found for "${search}"`
                    : `No ${isSearchMode ? 'results' : (activeFilter === 'recent' ? 'recent pages' : 'pages')} found`
                  }
                </div>
              </div>
            )}
          </>
        )}

        {/* Create New Page Button - Full-width secondary button at bottom */}
        {isLinkEditor && search.length >= 2 && !hideCreateButton && (
          <div className="mt-auto pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                // Create a placeholder page object for the link
                const newPageData = {
                  id: `new:${search}`, // Special ID to indicate this is a new page
                  title: search,
                  isNew: true, // Flag to indicate this is a new page
                  isPublic: false, // Default to private
                  userId: user?.uid
                };

                if (onSelect) {
                  onSelect(newPageData);
                }
              }}
              className="w-full justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new page: "{search}"
            </Button>
          </div>
        )}

      </div>
    </div>
  );
});

FilteredSearchResults.displayName = 'FilteredSearchResults';

export default FilteredSearchResults;