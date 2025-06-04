"use client";
import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useRef,
} from "react";
import { AuthContext } from "../../providers/AuthProvider";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PillLink } from "../utils/PillLink";
import debounce from "lodash.debounce";
import { Input } from "../ui/input";
import { ClearableInput } from "../ui/clearable-input";
import { navigateToPage } from "../../utils/pagePermissions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat } from "../../utils/dailyNoteNavigation";

// Simple Loader component
const Loader = () => {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>
  );
};

/**
 * SearchResults Component
 *
 * A clean search component that displays search results in a list format.
 * Supports both link editor mode and general search functionality.
 *
 * @param {Function} onSelect - Callback when a result is selected
 * @param {string} userId - Optional user ID to filter results
 * @param {string} placeholder - Input placeholder text
 * @param {string} initialSelectedId - Initially selected item ID
 * @param {boolean} editableOnly - Filter for editable pages only
 * @param {string} initialSearch - Initial search value
 * @param {string} displayText - Display text for link editor (legacy prop, no longer used for input)
 * @param {Function} setDisplayText - Function to update display text (used to detect link editor mode)
 * @param {Function} onInputChange - Callback for input changes
 * @param {boolean} preventRedirect - Prevent redirect to search page
 * @param {string} className - Additional CSS classes
 * @param {boolean} autoFocus - Whether to auto-focus the input field
 * @param {Function} onFocus - Callback when input receives focus
 */
const SearchResults = ({
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
}) => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const { formatDateString } = useDateFormat();

  // State management
  const [search, setSearch] = useState(initialSearch);
  const [pages, setPages] = useState({
    userPages: [],
    groupPages: [],
    publicPages: [],
    users: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [pageDataCache, setPageDataCache] = useState(new Map());

  // Refs
  const searchInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Determine if we're in link editor mode
  const isLinkEditor = !!setDisplayText;

  // Character count threshold for search
  const characterCount = isLinkEditor ? 0 : 2;

  // Reset search results
  const resetSearchResults = useCallback(() => {
    setPages({
      userPages: [],
      groupPages: [],
      publicPages: [],
      users: []
    });
    setIsSearching(false);
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!searchTerm && !isLinkEditor) {
        resetSearchResults();
        return;
      }

      if (!user && !userId) {
        return;
      }

      setIsSearching(true);

      try {
        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        let selectedUserId = userId ? userId : user.uid;
        let groupIds = [];
        if (user && user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const isFilteringByUser = !!userId;
        const encodedSearch = encodeURIComponent(searchTerm.trim());

        // Construct API URL
        let queryUrl;
        if (isFilteringByUser) {
          queryUrl = `/api/search?userId=${selectedUserId}&searchTerm=${encodedSearch}&filterByUserId=${userId}&groupIds=${groupIds}`;
        } else {
          queryUrl = `/api/search?userId=${selectedUserId}&searchTerm=${encodedSearch}&groupIds=${groupIds}`;
        }

        const userSearchUrl = isFilteringByUser ? null : `/api/search-users?searchTerm=${encodedSearch}`;

        // Fetch search results
        const [pagesResponse, usersResponse] = await Promise.all([
          fetch(queryUrl, { signal: abortControllerRef.current.signal }),
          userSearchUrl ? fetch(userSearchUrl, { signal: abortControllerRef.current.signal }) : Promise.resolve(null)
        ]);

        if (!pagesResponse.ok) {
          throw new Error(`Pages search failed: ${pagesResponse.status}`);
        }

        const pagesData = await pagesResponse.json();
        let usersData = { users: [] };

        if (usersResponse && usersResponse.ok) {
          usersData = await usersResponse.json();
        }

        // Update results
        setPages({
          userPages: pagesData.userPages || [],
          groupPages: pagesData.groupPages || [],
          publicPages: pagesData.publicPages || pagesData.pages || [],
          users: usersData.users || []
        });

      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Search request was aborted');
          return;
        }
        console.error("SearchResults - Error fetching search results", error);
        resetSearchResults();
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [userId, user, isLinkEditor, resetSearchResults]
  );

  // Handle search input changes
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearch(value);

    if (onInputChange) {
      onInputChange(value);
    }

    // Only search if we have minimum characters or in link editor mode
    if (value.trim().length >= characterCount || isLinkEditor) {
      debouncedSearch(value);
    } else {
      resetSearchResults();
    }
  }, [debouncedSearch, onInputChange, characterCount, isLinkEditor, resetSearchResults]);

  // Handle clearing the search input
  const handleClear = useCallback(() => {
    setSearch("");
    setSelectedId(null);
    resetSearchResults();

    if (onInputChange) {
      onInputChange("");
    }

    // Focus the input after clearing
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [onInputChange, resetSearchResults]);

  // Handle item selection
  const handleSelect = useCallback(async (item) => {
    setSelectedId(item.id);

    if (onSelect) {
      onSelect(item);
    }

    // Navigate if not prevented and not in link editor mode
    if (!preventRedirect && !isLinkEditor) {
      if (item.type === 'user') {
        router.push(`/user/${item.id}`);
      } else {
        // For page items, use click-to-edit functionality
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
    }
  }, [onSelect, isLinkEditor, preventRedirect, router, user, pageDataCache]);

  // Get all unique pages for display
  const getAllUniquePages = useCallback(() => {
    const allPages = [
      ...(pages.userPages || []),
      ...(pages.groupPages || []),
      ...(pages.publicPages || [])
    ];

    // Remove duplicates based on ID
    const uniquePages = allPages.filter((page, index, self) =>
      index === self.findIndex(p => p.id === page.id)
    );

    return uniquePages;
  }, [pages]);

  // Initialize search on mount
  useEffect(() => {
    if (initialSearch) {
      debouncedSearch(initialSearch);
    }
  }, [initialSearch, debouncedSearch]);

  // Auto-focus effect for link editor mode
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      // Wait for component to be fully mounted and any parent animations to complete
      const focusTimer = setTimeout(() => {
        if (searchInputRef.current) {
          try {
            searchInputRef.current.focus();

            // Select all text if there's initial content
            if (searchInputRef.current.value && typeof searchInputRef.current.select === 'function') {
              searchInputRef.current.select();
            }

            // Trigger virtual keyboard on mobile devices
            if (typeof window !== 'undefined' && 'ontouchstart' in window) {
              searchInputRef.current.click();
            }

            // Call onFocus callback if provided
            if (onFocus) {
              onFocus();
            }

            console.log('[SearchResults] Auto-focused input field');
          } catch (error) {
            console.error('[SearchResults] Error during auto-focus:', error);
          }
        }
      }, 100); // Small delay to ensure component is ready

      return () => clearTimeout(focusTimer);
    }
  }, [autoFocus, onFocus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!user && !userId) return null;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Search Input */}
      <div className="relative">
        {isLinkEditor ? (
          <ClearableInput
            ref={searchInputRef}
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
            ref={searchInputRef}
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

      {/* Search Results */}
      <div className={`mt-2 space-y-1 transition-all max-h-[40vh] overflow-y-auto ${
        (search.length >= characterCount || isLinkEditor) ? "opacity-100" : "opacity-0"
      }`}>
        {isSearching && (search.length >= characterCount || isLinkEditor) ? (
          <Loader />
        ) : (
          <>
            {/* Users Section */}
            {pages.users && pages.users.length > 0 && (
              <div className="mb-2">
                <h3 className="text-xs font-medium text-muted-foreground mb-1 px-2">Users</h3>
                {pages.users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className="w-full text-left p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {user.photoURL && (
                        <img
                          src={user.photoURL}
                          alt={user.username}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="font-medium">{user.username}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Pages Section */}
            {getAllUniquePages().length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1 px-2">Pages</h3>
                {getAllUniquePages().map((page) => (
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
            {search.length >= 2 && getAllUniquePages().length === 0 && pages.users.length === 0 && !isSearching && (
              <div className="p-3 text-center text-muted-foreground">
                No results found for "{search}"
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
