"use client";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useContext,
  forwardRef,
} from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { navigateToPage } from "../../utils/pagePermissions";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";
import debounce from "lodash.debounce";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { ClearableInput } from "../ui/clearable-input";
import { PillLink } from "../utils/PillLink";
import searchPerformanceMonitor from '../../utils/searchPerformanceMonitor';
import { shouldAllowRequest } from "../../utils/requestThrottle";

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
}, ref) => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const { formatDateString } = useDateFormat();

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

  // Refs
  const searchInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastRequestRef = useRef(null); // Track last request to prevent duplicates

  // Determine if we're in link editor mode
  const isLinkEditor = !!setDisplayText;

  // Character count threshold for search
  const characterCount = isLinkEditor ? 0 : 2;

  // Reset search results
  const resetSearchResults = useCallback(() => {
    setPages([]);
    setUsers([]);
    setGroups([]);
    setIsSearching(false);
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

    // Skip if this exact request is already in progress
    if (lastRequestRef.current === requestSignature) {
      console.log('[FilteredSearchResults] Skipping duplicate request:', requestSignature);
      return;
    }

    // Cancel any ongoing request before starting new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    lastRequestRef.current = requestSignature;
    console.log('[FilteredSearchResults] Fetching results - filter:', filter, 'searchTerm:', searchTerm, 'searchMode:', searchMode, 'userId:', user.uid);

    setIsSearching(true);
    const searchStartTime = Date.now();

    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const encodedSearch = encodeURIComponent(searchTerm.trim());

      // Choose the appropriate API based on mode and filter
      let queryUrl;
      if (isLinkEditor) {
        // Use enhanced search API for link editor that includes pages, users, and groups
        queryUrl = `/api/search-link-editor-enhanced?searchTerm=${encodedSearch}&userId=${user.uid}&maxResults=25`;

        // Add current page ID to exclude it from results if available
        const currentPageId = new URLSearchParams(window.location.search).get('currentPageId');
        if (currentPageId) {
          queryUrl += `&currentPageId=${currentPageId}`;
        }
      } else {
        // Use optimized search API for general search
        queryUrl = `/api/search-optimized?searchTerm=${encodedSearch}&userId=${user.uid}&titleOnly=false&maxResults=50`;
      }

      console.log('[FilteredSearchResults] Making API request to:', queryUrl, 'for searchMode:', searchMode);

      const response = await fetch(queryUrl, {
        signal: abortControllerRef.current.signal
      });

      console.log('[FilteredSearchResults] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FilteredSearchResults] Response error:', errorText);
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[FilteredSearchResults] Response data:', data);

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

        setPages(filteredPages);
        setUsers(userResults);
        setGroups(groupResults);
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

        setPages(filteredPages);
        setUsers([]); // Clear users for regular search
        setGroups([]); // Clear groups for regular search
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

  // Debounced search function with standardized timing to prevent race conditions
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

      await fetchFilteredResults(searchTerm, activeFilter, searchMode);
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
    setSelectedId(item.id);

    if (onSelect) {
      onSelect(item);
    }

    // Navigate if not prevented and not in link editor mode
    if (!preventRedirect && !isLinkEditor) {
      try {
        // Check if we have cached page data
        let pageData = pageDataCache.get(item.id);

        if (!pageData) {
          // Fetch page data for permission checking
          const pageRef = doc(db, 'pages', item.id);
          const pageDoc = await getDoc(pageRef);
          if (pageDoc.exists()) {
            pageData = { id: item.id, ...pageDoc.data() };
            // Cache the page data
            setPageDataCache(prev => new Map(prev).set(item.id, pageData));
          }
        }

        // Use click-to-edit navigation
        navigateToPage(item.id, user, pageData, user?.groups, router);
      } catch (error) {
        console.error('Error fetching page data for navigation:', error);
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
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search Input */}
      <div className="relative flex-shrink-0 mb-3">
        {isLinkEditor ? (
          <ClearableInput
            ref={ref || searchInputRef}
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={handleSearchChange}
            onClear={handleClear}
            className="w-full"
            autoComplete="off"
          />
        ) : (
          <Input
            ref={ref || searchInputRef}
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={handleSearchChange}
            className="w-full pr-10"
            autoComplete="off"
          />
        )}

        {/* Search Icon - only show for non-link editor mode */}
        {!isLinkEditor && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Filter Chips - only show in link editor mode */}
      {isLinkEditor && (
        <div className="flex gap-2 mb-3 flex-shrink-0">
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
                   (activeFilter === 'recent' ? 'Recent Pages' : 'My Pages')}
                </h3>
                <div className="space-y-1">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => handleSelect(page)}
                      className={`w-full text-left p-2 hover:bg-muted rounded-md transition-colors ${
                        selectedId === page.id ? 'bg-muted' : ''
                      }`}
                    >
                      <PillLink
                        href={`/${page.id}`}
                        isPublic={page.isPublic}
                        isOwned={page.userId === user?.uid}
                        className="pointer-events-none"
                      >
                        {page.title && isExactDateFormat(page.title)
                          ? formatDateString(page.title)
                          : page.title}
                      </PillLink>
                      {isLinkEditor && page.category && (
                        <div className="text-xs text-muted-foreground mt-1 px-2">
                          {page.category}
                        </div>
                      )}
                    </button>
                  ))}
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

            {/* Groups Section - only show in link editor mode */}
            {isLinkEditor && groups.length > 0 && (
              <div className="space-y-1 mb-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  Groups
                </h3>
                <div className="space-y-1">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleSelect(group)}
                      className={`w-full text-left p-2 hover:bg-muted rounded-md transition-colors ${
                        selectedId === group.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {group.title}
                          </div>
                          {group.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {group.description}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No Results - Only show after search has completed and we have attempted a search */}
            {(search.length >= 2 || (isLinkEditor && lastRequestRef.current !== null)) &&
             pages.length === 0 && users.length === 0 && groups.length === 0 && !isSearching && (
              <div className="p-4 text-center">
                <div className="text-muted-foreground mb-4">
                  {search.length >= 2
                    ? `No results found for "${search}"`
                    : `No ${isSearchMode ? 'results' : (activeFilter === 'recent' ? 'recent pages' : 'pages')} found`
                  }
                </div>

                {/* Create new page option - only show in link editor mode with search term */}
                {isLinkEditor && search.length >= 2 && (
                  <button
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
                    className="w-full p-3 hover:bg-muted rounded-md transition-colors border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
                  >
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="text-muted-foreground">Create new page:</span>
                      <span className="font-medium text-foreground">"{search}"</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

FilteredSearchResults.displayName = 'FilteredSearchResults';

export default FilteredSearchResults;
