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

      console.log('Fetching results for search term:', searchTerm);
      setIsSearching(true);
      try {
        let groupIds = [];
        if (user.groups) {
          groupIds = Object.keys(user.groups);
        }

        const response = await fetch(
          `/api/search?userId=${user.uid}&searchTerm=${encodeURIComponent(searchTerm)}&groupIds=${groupIds}`
        );
        const data = await response.json();
        console.log('Search results:', data);
        
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

        console.log('Combined pages:', combinedPages);
        setSearchResults(combinedPages);
      } catch (error) {
        console.error("Error fetching search results", error);
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
    console.log('Search triggered with term:', searchTerm);
    if (!searchTerm) {
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
            >
              {item.name}
              {item.section !== "Your Pages" && (
                <span className="text-xs opacity-75 ml-2">
                  ({item.section})
                  {item.section === "Public Pages" && ` by ${item.userId}`}
                </span>
              )}
            </PillLink>
          );
        }}
      />
    </div>
  );
};

export default Search;
