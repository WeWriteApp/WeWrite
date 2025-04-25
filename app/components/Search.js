"use client";
import React, { useEffect, useState, useContext, useCallback } from "react";
import { AuthContext } from "../providers/AuthProvider";
import CustomSearchAutocomplete from "./CustomSearchAutocomplete";
import { useRouter } from "next/navigation";
import { PillLink } from "./PillLink";

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

const Search = () => {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchResults = useCallback(
    debounce(async (searchTerm) => {
      if (!user) return;

      console.log('Search component - Fetching results for:', {
        searchTerm,
        userId: user.uid,
        groups: user.groups
      });

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

        setSearchResults(combinedPages);
      } catch (error) {
        console.error("Error fetching search results", error);
        console.error("Error details:", error.message, error.stack);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [user]
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

  // Handle Enter key press to navigate to search page
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      router.push(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
    }
  }

  return (
    <div className="py-4 w-full">
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
          backgroundColor: "var(--card)",
          boxShadow: "none",
          hoverBackgroundColor: "var(--muted)",
          color: "var(--foreground)",
          fontSize: "1rem",
          iconColor: "var(--muted-foreground)",
          lineColor: "var(--border)",
          placeholderColor: "var(--muted-foreground)",
          clearIconMargin: "3px 14px 0 0",
          searchIconMargin: "0 0 0 12px"
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
    </div>
  );
};

export default Search;
