"use client";
import React, { useEffect, useState, useContext, useCallback } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
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
        const combinedPages = [
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
    router.push(`/pages/${item.id}`);
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
    fetchResults(searchTerm);
  }

  return (
    <div className="py-4 w-full">
      {/* <h1 className="text-2xl font-semibold">Search</h1> */}
      <ReactSearchAutocomplete
        items={searchResults}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        autoFocus
        className="w-full bg-background text-text searchbar"
        placeholder="Search for a page"
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
                <span className="truncate">{item.name}</span>
                {item.section !== "Your Pages" && (
                  <span className="text-xs opacity-75 whitespace-nowrap">
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
