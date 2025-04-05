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
        let groupIds = [];
        if (user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const queryUrl = `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(searchTerm)}&groupIds=${groupIds}`;
        console.log('Making API request to:', queryUrl);

        const response = await fetch(queryUrl);

        if (!response.ok) {
          console.error('Search API returned error:', response.status);
          const errorText = await response.text();
          console.error('Error details:', errorText);
          throw new Error(`Search API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Search API response:', data);

        // Check if we received an error message
        if (data.error) {
          console.error('Search API returned error object:', data.error);
        }

        // Even if we have an error, continue with the empty arrays

        // Combine all pages and format them for ReactSearchAutocomplete
        let combinedPages = [];

        // Check if we have the new format (pages array) or old format (categorized pages)
        if (data.pages) {
          // New format - pages array
          combinedPages = data.pages.map(page => {
            let section = "Public Pages";
            if (page.isOwned) {
              section = "Your Pages";
            } else if (page.type === 'group') {
              section = "Group Pages";
            }

            return {
              ...page,
              name: page.title,
              section: section
            };
          });
        } else {
          // Old format - categorized pages
          combinedPages = [
            ...(data.userPages || []).map(page => ({
              ...page,
              name: page.title,
              section: "Your Pages"
            })),
            ...(data.groupPages || []).map(page => ({
              ...page,
              name: page.title,
              section: "Group Pages"
            })),
            ...(data.publicPages || []).map(page => ({
              ...page,
              name: page.title,
              section: "Public Pages"
            }))
          ];
        }

        // Add users to search results if available
        if (data.users) {
          combinedPages = [
            ...combinedPages,
            ...(data.users || []).map(user => ({
              ...user,
              id: user.id,
              name: user.username,
              section: "Users",
              type: 'user',
              url: `/u/${user.id}`
            }))
          ];
        }

        // For testing purposes, add some mock data if no results were found
        if (combinedPages.length === 0) {
          // Add mock pages
          combinedPages = [
            { id: 'mock1', title: 'Mock Page 1', name: 'Mock Page 1', type: 'public', section: "Public Pages", username: 'testuser' },
            { id: 'mock2', title: 'Mock Page 2', name: 'Mock Page 2', type: 'user', section: "Your Pages", isOwned: true, username: 'testuser' },
            // Add mock users
            { id: 'user1', username: 'TestUser1', name: 'TestUser1', section: "Users", type: 'user', url: `/u/user1` },
            { id: 'user2', username: 'TestUser2', name: 'TestUser2', section: "Users", type: 'user', url: `/u/user2` }
          ];
        }

        console.log('Processed search results:', {
          total: combinedPages.length,
          bySection: {
            userPages: data.userPages?.length || 0,
            groupPages: data.groupPages?.length || 0,
            publicPages: data.publicPages?.length || 0
          },
          combinedPages
        });

        setSearchResults(combinedPages);
      } catch (error) {
        console.error("Error fetching search results", error);
        console.error("Error details:", error.message, error.stack);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [user]
  );

  const handleOnSelect = (item) => {
    console.log('Selected item:', item);
    if (item.type === 'user') {
      router.push(`/u/${item.id}`);
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
          minMatchCharLength: 2,
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
