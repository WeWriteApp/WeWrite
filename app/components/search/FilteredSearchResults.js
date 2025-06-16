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
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [pageDataCache, setPageDataCache] = useState(new Map());
  const [activeFilter, setActiveFilter] = useState('recent');
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Refs
  const searchInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Determine if we're in link editor mode
  const isLinkEditor = !!setDisplayText;

  // Character count threshold for search
  const characterCount = isLinkEditor ? 0 : 2;

  // Reset search results
  const resetSearchResults = useCallback(() => {
    setPages([]);
    setIsSearching(false);
  }, []);

  // Fetch filtered results based on active filter
  const fetchFilteredResults = useCallback(async (searchTerm, filter, searchMode = false) => {
    if (!user) {
      console.log('[FilteredSearchResults] No user, skipping fetch');
      return;
    }

    console.log('[FilteredSearchResults] Fetching results for filter:', filter, 'searchTerm:', searchTerm, 'searchMode:', searchMode, 'userId:', user.uid);

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsSearching(true);

    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const encodedSearch = encodeURIComponent(searchTerm.trim());
      let queryUrl;

      // In search mode, use general search API instead of filtered APIs
      if (searchMode && searchTerm.trim()) {
        queryUrl = `/api/search?searchTerm=${encodedSearch}&userId=${user.uid}`;
      } else if (filter === 'recent') {
        queryUrl = `/api/recent-pages?userId=${user.uid}&searchTerm=${encodedSearch}&limit=20`;
      } else {
        queryUrl = `/api/my-pages?userId=${user.uid}&searchTerm=${encodedSearch}&limit=20`;
      }

      console.log('[FilteredSearchResults] Making request to:', queryUrl);

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

      // Handle different response formats - general search API returns {pages, users}, filtered APIs return {pages}
      const pages = data.pages || [];
      setPages(pages);
      console.log('[FilteredSearchResults] Set pages:', pages.length, 'pages');

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[FilteredSearchResults] Search request was aborted');
        return;
      }
      console.error("[FilteredSearchResults] Error fetching results", error);
      resetSearchResults();
    } finally {
      setIsSearching(false);
    }
  }, [user, resetSearchResults]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm, searchMode = false) => {
      if (!searchTerm && !isLinkEditor) {
        resetSearchResults();
        return;
      }

      if (!user) {
        return;
      }

      await fetchFilteredResults(searchTerm, activeFilter, searchMode);
    }, 500),
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
    // Re-run search with new filter
    if (search.trim().length >= characterCount || isLinkEditor) {
      fetchFilteredResults(search, filter, false);
    } else if (isLinkEditor) {
      // In link editor mode, always show results even without search
      fetchFilteredResults('', filter, false);
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
    if (!user) return; // Wait for user to be available

    if (initialSearch) {
      debouncedSearch(initialSearch);
    } else if (isLinkEditor) {
      // In link editor mode, show initial results even without search
      fetchFilteredResults('', activeFilter);
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
    <div className={`flex flex-col ${className}`}>
      {/* Search Input */}
      <div className="relative">
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
        <div className="flex gap-2 mt-3 mb-2">
          <button
            onClick={() => handleFilterChange('recent')}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              activeFilter === 'recent' && !isSearchMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => handleFilterChange('my-pages')}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              activeFilter === 'my-pages' && !isSearchMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            My Pages
          </button>
        </div>
      )}

      {/* Search Results - fixed height for link editor to prevent layout shift */}
      <div className={`space-y-1 transition-all ${isLinkEditor ? 'h-[280px]' : 'max-h-[40vh]'} overflow-y-auto ${
        (search.length >= characterCount || isLinkEditor) ? "opacity-100" : "opacity-0"
      }`}>
        {isSearching && (search.length >= characterCount || isLinkEditor) ? (
          <Loader />
        ) : (
          <>
            {/* Pages Section */}
            {pages.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1 px-2">
                  {isSearchMode ? 'Search Results' : (activeFilter === 'recent' ? 'Recent Pages' : 'My Pages')}
                </h3>
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
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {(search.length >= 2 || isLinkEditor) && pages.length === 0 && !isSearching && (
              <div className="p-3 text-center text-muted-foreground">
                {search.length >= 2
                  ? `No results found for "${search}"`
                  : `No ${isSearchMode ? 'results' : (activeFilter === 'recent' ? 'recent pages' : 'pages')} found`
                }
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
