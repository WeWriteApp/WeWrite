"use client";
import React, { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { AuthContext } from "../providers/AuthProvider";
import CustomSearchAutocomplete from "./CustomSearchAutocomplete";
import { useRouter } from "next/navigation";
import { PillLink } from "./PillLink";

// Improved debounce function with immediate option
function debounce(func, delay, options = {}) {
  let timeout;
  return (...args) => {
    const { immediate = false } = options;
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, delay);
    if (callNow) func(...args);
  };
}

// Simple LRU cache implementation for search results
class SearchCache {
  constructor(maxSize = 20) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // Get the value and refresh its position in the cache
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // If key already exists, delete it first
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // If cache is full, delete the oldest entry (first item in the Map)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Add the new entry
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

const Search = () => {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Create a memoized search cache that persists between renders
  const searchCache = useMemo(() => new SearchCache(30), []);

  // Clear the cache when the user changes
  useEffect(() => {
    if (user) {
      console.log('User changed, clearing search cache');
      searchCache.clear();
    }
  }, [user?.uid, searchCache]);

  const fetchResults = useCallback(
    debounce(async (searchTerm) => {
      if (!user) return;

      console.log('Search component - Fetching results for:', {
        searchTerm,
        userId: user.uid,
        groups: user.groups
      });

      // Create a cache key based on the search term and user ID
      const cacheKey = `${searchTerm}:${user.uid}`;

      // Check if we have cached results
      const cachedResults = searchCache.get(cacheKey);
      if (cachedResults) {
        console.log('Using cached search results for:', searchTerm);
        setSearchResults(cachedResults);
        return;
      }

      setIsSearching(true);
      try {
        // Get the user ID to use for the search
        let groupIds = [];
        if (user.groups) {
          groupIds = Object.keys(user.groups);
        }

        // Fetch both pages and users in parallel
        const pagesUrl = `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(searchTerm)}&groupIds=${groupIds}&useScoring=true`;
        const usersUrl = `/api/search-users?searchTerm=${encodeURIComponent(searchTerm)}`;

        console.log('Making API requests to:', { pagesUrl, usersUrl });

        // Use Promise.allSettled to handle partial failures
        const [pagesResponse, usersResponse] = await Promise.allSettled([
          fetch(pagesUrl),
          fetch(usersUrl)
        ]);

        // Initialize empty arrays for results
        let pages = [];
        let users = [];

        // Process pages results if successful
        if (pagesResponse.status === 'fulfilled' && pagesResponse.value.ok) {
          const data = await pagesResponse.value.json();
          console.log('Pages API response:', data);

          if (data.pages && Array.isArray(data.pages)) {
            pages = data.pages;
          }

          // Also get users from the pages API if available
          if (data.users && Array.isArray(data.users)) {
            users = [...users, ...data.users];
          }
        } else {
          console.error('Pages API request failed:',
            pagesResponse.status === 'rejected' ? pagesResponse.reason :
            `HTTP ${pagesResponse.value.status}`);
        }

        // Process users results if successful
        if (usersResponse.status === 'fulfilled' && usersResponse.value.ok) {
          const data = await usersResponse.value.json();
          console.log('Users API response:', data);

          if (data.users && Array.isArray(data.users)) {
            // Combine with any users we already have, avoiding duplicates
            const existingUserIds = new Set(users.map(u => u.id));
            const newUsers = data.users.filter(u => !existingUserIds.has(u.id));
            users = [...users, ...newUsers];
            console.log('Combined users after API call:', users);
          }
        } else {
          console.error('Users API request failed:',
            usersResponse.status === 'rejected' ? usersResponse.reason :
            `HTTP ${usersResponse.value.status}`);
        }

        // Combine all pages and format them for ReactSearchAutocomplete
        let combinedPages = [];

        // Format pages
        combinedPages = pages.map(page => ({
          ...page,
          name: page.title,
          username: page.username || ''
        }));

        // Add users to search results
        const formattedUsers = users.map(user => ({
          ...user,
          name: user.username,
          type: 'user',
          url: `/user/${user.id}`
        }));

        console.log('Formatted users for search results:', formattedUsers);

        combinedPages = [
          ...combinedPages,
          ...formattedUsers
        ];

        console.log('Final combined search results:', combinedPages);

        // If no results were found and we have a search term, add a fallback user result
        if (combinedPages.length === 0 && searchTerm && searchTerm.length >= 1) {
          console.log(`No results found for search term: ${searchTerm}, adding fallback`);

          // Add a fallback user result that matches the search term
          combinedPages.push({
            id: 'fallback-user',
            name: searchTerm,
            username: searchTerm,
            type: 'user',
            url: `/search?q=${encodeURIComponent(searchTerm)}`,
            isFallback: true
          });

          console.log('Added fallback result:', combinedPages);
        }

        console.log('Processed search results:', {
          total: combinedPages.length,
          users: users.length,
          pages: pages.length,
          results: combinedPages
        });

        // Cache the results
        searchCache.set(cacheKey, combinedPages);

        setSearchResults(combinedPages);
      } catch (error) {
        console.error("Error fetching search results", error);
        console.error("Error details:", error.message, error.stack);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350), // Slightly longer debounce for better performance
    [user, searchCache]
  );

  const handleOnSelect = (item) => {
    console.log('Selected item:', item);
    if (item.type === 'user') {
      router.push(`/user/${item.id}`);
    } else {
      router.push(`/${item.id}`);
    }
  }

  const handleOnSearch = (searchTerm) => {
    console.log('Search triggered:', {
      searchTerm,
      length: searchTerm?.length,
      trimmed: searchTerm?.trim()?.length
    });

    if (!searchTerm?.trim()) {
      console.log('Empty search term, clearing results');
      setSearchResults([]);
      return;
    }

    // Fetch results for typeahead
    fetchResults(searchTerm);
  }

  // Handle Enter key press or search icon click to navigate to search page
  const handleKeyDown = (e) => {
    // Always navigate to search page when Enter is pressed or search icon is clicked
    const searchTerm = e.target.value.trim();

    // Navigate to search page regardless of whether there's a search term
    e.preventDefault();
    console.log('Navigating to search page with query:', searchTerm);

    // If there's a search term, include it in the URL
    if (searchTerm) {
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`, undefined, { scroll: true });
    } else {
      // Navigate to search page without a query
      router.push('/search', undefined, { scroll: true });
    }
  }

  // Function to directly navigate to search page
  const navigateToSearchPage = () => {
    console.log('Directly navigating to search page');
    // Use router.push with options to ensure proper navigation
    router.push('/search', undefined, { scroll: true });
  };

  return (
    <div className="py-4 w-full relative">
      {/* <h1 className="text-2xl font-semibold">Search</h1> */}
      <CustomSearchAutocomplete
        items={searchResults}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full searchbar"
        placeholder="Search for pages, users..."
        styling={{
          height: "44px",
          border: "1px solid var(--input)",
          borderRadius: "0.5rem",
          backgroundColor: "var(--background)",
          boxShadow: "none",
          hoverBackgroundColor: "var(--muted)",
          color: "var(--foreground)",
          fontSize: "1rem",
          iconColor: "var(--muted-foreground)",
          lineColor: "var(--border)",
          placeholderColor: "var(--muted-foreground)",
          clearIconMargin: "3px 14px 0 0",
          searchIconMargin: "0 0 0 12px",
          // Add focus styles to use accent color
          focusBorderColor: "hsl(var(--primary))",
          focusBoxShadow: "0 0 0 2px hsl(var(--primary) / 0.2)"
        }}
        fuseOptions={{
          minMatchCharLength: 1,
        }}
        formatResult={(item) => {
          return (
            <PillLink
              href={`/pages/${item.id}`}
              isPublic={item.isPublic}
              key={item.id}
              isOwned={item.section === "Your Pages"}
              className="max-w-full"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="truncate text-foreground">{item.name}</span>
                {item.section !== "Your Pages" && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    by {item.username || "NULL"}
                  </span>
                )}
              </div>
            </PillLink>
          );
        }}
      />

      {/* Add a direct search button that's always visible and clickable */}
      <button
        onClick={navigateToSearchPage}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
        aria-label="Go to search page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
    </div>
  );
};

export default Search;
