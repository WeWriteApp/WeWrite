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
import { Search, Filter, Plus, Check } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ClearableInput } from "../ui/clearable-input";
import { PillLink } from "../utils/PillLink";
import { UsernameBadge } from "../ui/UsernameBadge";

// Generate a Firestore-compatible document ID
const generatePageId = (): string => {
  // Use crypto.randomUUID for a proper unique ID, or fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 20);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
};
import { getBatchUserData } from '../../utils/apiClient';
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
  onFilterToggle = null,
  maxResults = undefined}, ref) => {
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
  const [isCreatingPage, setIsCreatingPage] = useState(false);

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
      return;
    }

    // Check request throttling to prevent excessive API calls
    const requestType = `search:${filter}:${searchMode ? 'search' : 'filter'}`;
    if (!shouldAllowRequest(requestType)) {
      return;
    }

    // Create request signature for deduplication
    const requestSignature = `${searchTerm}-${filter}-${searchMode}-${user.uid}`;

    // IMPROVED: Only skip if the exact same request is in progress AND we haven't cleared it
    if (lastRequestRef.current === requestSignature && abortControllerRef.current) {
      return;
    }

    // Cancel any ongoing request before starting new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    lastRequestRef.current = requestSignature;

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
        // Use unified search API for link editor context (now includes users)
        queryUrl = `/api/search-unified?searchTerm=${encodedSearch}&userId=${user.uid}&context=link_editor&maxResults=25&titleOnly=true&includeUsers=true`;

        // Add current page ID to exclude it from results if available
        const currentPageId = new URLSearchParams(window.location.search).get('currentPageId');
        if (currentPageId) {
          queryUrl += `&currentPageId=${currentPageId}`;
        }
      } else {
        // Use unified search API for general search
        queryUrl = `/api/search-unified?searchTerm=${encodedSearch}&userId=${user.uid}&context=main&titleOnly=false&maxResults=50&includeContent=true&includeUsers=true`;
      }

      const response = await fetch(queryUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      // Check if request was aborted after fetch
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // CRITICAL FIX: Validate response data structure to prevent null results
      if (!data || typeof data !== 'object') {
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

      } else {
        // Handle regular search results (unified API format: { pages: [], users: [] })
        let allPages = data.pages || [];
        let allUsers = data.users || [];

        // Ensure allPages is an array before filtering
        const safeAllPages = Array.isArray(allPages) ? allPages : [];

        // For regular search mode, apply client-side filtering if needed
        let filteredPages = safeAllPages;

        if (!searchMode && filter === 'my-pages') {
          // Filter to only show user's own pages (only for non-link editor mode)
          filteredPages = safeAllPages.filter(page => page.userId === user.uid);
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
        }

        // Filter out current page if specified
        if (currentPageId) {
          filteredPages = filteredPages.filter(page => page.id !== currentPageId);
        }

        const limitedPages = maxResults ? filteredPages.slice(0, maxResults) : filteredPages;
        setPages(limitedPages);

        // FIXED: Include users from API response instead of clearing them
        setUsers(Array.isArray(allUsers) ? allUsers : []);
        setGroups([]); // Clear groups for regular search

        // Fetch subscription data for page authors
        fetchUserSubscriptionData(limitedPages);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
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
        return;
      }

      // In link editor mode, always show results (even with empty search)
      // In regular mode, only search if there's a search term
      if (!searchTerm && !isLinkEditor) {
        resetSearchResults();
        return;
      }

      try {
        await fetchFilteredResults(searchTerm, activeFilter, searchMode);
      } catch (error) {
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
    setActiveFilter(filter);
    setIsSearchMode(false); // Exit search mode when selecting a filter

    // Always re-run comprehensive search with new filter
    // This ensures we get all available pages and apply filtering client-side
    if (isLinkEditor) {
      // In link editor mode, always show comprehensive results
      fetchFilteredResults(search, filter, false);
    } else if (search.trim().length >= characterCount) {
      // In regular mode, only search if we have enough characters
      fetchFilteredResults(search, filter, false);
    }
  }, [search, characterCount, isLinkEditor, fetchFilteredResults]);

  // Handle item selection
  const handleSelect = useCallback(async (item) => {
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
    if (!user) return; // Wait for user to be available

    if (initialSearch) {
      debouncedSearch(initialSearch);
    } else if (isLinkEditor) {
      // In link editor mode, delay the initial search to prevent excessive API requests
      // This prevents the search from firing immediately when the modal opens
      const timer = setTimeout(() => {
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
          } catch (error) {
            // Silent fail for auto-focus
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
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ClearableInput
                  ref={ref || searchInputRef}
                  type="text"
                  placeholder={placeholder}
                  value={search}
                  onChange={handleSearchChange}
                  onClear={handleClear}
                  leftIcon={<Search className="h-4 w-4" />}
                  className="w-full"
                  autoComplete="off"
                />
              </div>
              {/* Filter button outside the input container */}
              {onFilterToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-9 w-9 p-0 flex-shrink-0 ${showFilters ? 'bg-muted' : ''}`}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              )}
              {/* Additional right buttons outside the input container */}
              {rightButtons && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {rightButtons}
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
              <div className="space-y-2 mb-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  {isLinkEditor && isSearchMode ? 'Pages' :
                   isSearchMode ? 'Search Results' :
                   (activeFilter === 'recent' ? 'Recently Viewed' : 'My Pages')}
                </h3>
                <div className="space-y-2">
                  {pages.map((page) => {
                    const isAlreadyLinked = Array.isArray(linkedPageIds) && linkedPageIds.includes(page.id);
                    return (
                      <button
                        key={page.id}
                        onClick={() => handleSelect(page)}
                        className={`w-full text-left p-3 wewrite-card hover:bg-muted/50 transition-colors ${
                          selectedId === page.id ? 'bg-muted/50 ring-2 ring-primary/50' : ''
                        } ${isAlreadyLinked ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0 min-w-0 max-w-[calc(100%-80px)] flex-1">
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
                          {/* Checkmark for selected state */}
                          {selectedId === page.id && (
                            <div className="flex-shrink-0 ml-auto">
                              <Check className="h-5 w-5 text-primary" />
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
              <div className="space-y-2 mb-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  User Profiles
                </h3>
                <div className="space-y-2">
                  {users.map((userItem) => (
                    <button
                      key={userItem.id}
                      onClick={() => handleSelect(userItem)}
                      className={`w-full text-left p-3 wewrite-card hover:bg-muted/50 transition-colors ${
                        selectedId === userItem.id ? 'bg-muted/50 ring-2 ring-primary/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <UsernameBadge
                            userId={userItem.id}
                            username={userItem.username}
                            tier={userItem.tier}
                            subscriptionStatus={userItem.subscriptionStatus}
                            subscriptionAmount={userItem.subscriptionAmount}
                            size="sm"
                            variant="pill"
                            isLinkEditor={isLinkEditor}
                            onLinkEditorSelect={() => handleSelect(userItem)}
                          />
                        </div>
                        {/* Checkmark for selected state */}
                        {selectedId === userItem.id && (
                          <div className="flex-shrink-0">
                            <Check className="h-5 w-5 text-primary" />
                          </div>
                        )}
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
          <div className="mt-auto pt-4">
            <Button
              variant="secondary"
              disabled={isCreatingPage}
              onClick={async () => {
                if (!user?.uid) {
                  console.error('Cannot create page: user not authenticated');
                  return;
                }

                setIsCreatingPage(true);

                // Generate a page ID upfront so we can use it even if the API call fails
                const generatedPageId = generatePageId();

                // Create the page immediately in the database
                try {
                  const pageData = {
                    id: generatedPageId, // Use the pre-generated ID
                    title: search,
                    content: JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }]), // Empty content
                    userId: user.uid,
                    username: user.username || 'Anonymous',
                    lastModified: new Date().toISOString(),
                    isReply: false,
                    groupId: null,
                    customDate: null
                  };

                  const response = await fetch('/api/pages', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(pageData),
                    credentials: 'include'
                  });

                  if (response.ok) {
                    const result = await response.json();
                    // API returns { success: true, data: { id: pageId } }
                    const pageId = result.data?.id || result.id || generatedPageId;
                    console.log('✅ Created new page from link editor:', { title: search, id: pageId });

                    // Return the real page data with actual ID
                    const newPageData = {
                      id: pageId, // Use the real page ID from the database
                      title: search,
                      isNew: false, // Page already exists now
                      isPublic: false,
                      userId: user.uid,
                      username: user.username || 'Anonymous'
                    };

                    if (onSelect) {
                      onSelect(newPageData);
                    }
                  } else {
                    // If creation fails, use the pre-generated ID with isNew flag
                    // The page will be created when the parent page is saved
                    console.error('Failed to create page immediately, will create on save:', await response.text());
                    const fallbackPageData = {
                      id: generatedPageId, // Use the pre-generated ID, not new:title
                      title: search,
                      isNew: true, // Mark for creation when parent page is saved
                      isPublic: false,
                      userId: user?.uid
                    };
                    if (onSelect) {
                      onSelect(fallbackPageData);
                    }
                  }
                } catch (error) {
                  console.error('Error creating page:', error);
                  // Fall back to using the pre-generated ID
                  const fallbackPageData = {
                    id: generatedPageId, // Use pre-generated ID, not new:title
                    title: search,
                    isNew: true,
                    isPublic: false,
                    userId: user?.uid
                  };
                  if (onSelect) {
                    onSelect(fallbackPageData);
                  }
                } finally {
                  setIsCreatingPage(false);
                }
              }}
              className="w-full justify-center"
            >
              {isCreatingPage ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create new page: "{search}"
                </>
              )}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
});

FilteredSearchResults.displayName = 'FilteredSearchResults';

export default FilteredSearchResults;
