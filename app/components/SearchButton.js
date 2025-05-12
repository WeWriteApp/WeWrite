"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { searchPages, searchUsers } from "../firebase/search";
import debounce from "lodash.debounce";
import { useClickOutside } from "../hooks/useClickOutside";
import { Button } from "./ui/button";

/**
 * SearchButton component that provides an interactive search input with type-ahead results
 * and navigates to the search page when the magnifying glass icon is clicked.
 */
const SearchButton = ({ placeholder = "Search all pages..." }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  const navigateToSearchPage = () => {
    console.log('Navigating to search page');
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/search');
    }
  };

  // Reference for the container element to detect clicks outside
  const containerRef = useRef(null);

  // Use the useClickOutside hook to handle clicks outside the search component
  useClickOutside(containerRef, () => {
    setShowResults(false);
  });

  // Fetch search results as the user types
  const fetchResults = debounce(async () => {
    if (!query.trim() || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search for pages
      const pageResults = await searchPages(query.trim(), user.uid);

      // Search for users
      const userResults = await searchUsers(query.trim());

      // Combine results
      const combinedResults = [
        ...pageResults.map((page) => ({
          ...page,
          type: 'page',
          url: `/pages/${page.id}`
        })),
        ...userResults.map((user) => ({
          ...user,
          type: 'user',
          url: `/user/${user.username || user.id}`
        }))
      ];

      setResults(combinedResults);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  }, 300);

  useEffect(() => {
    if (query.trim()) {
      fetchResults();
    } else {
      setResults([]);
    }
    // Reset selected index when query changes
    setSelectedIndex(-1);
  }, [query]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setShowResults(true);
  };

  const handleSelect = (item) => {
    setShowResults(false);
    router.push(item.url);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prevIndex) =>
          prevIndex < results.length - 1 ? prevIndex + 1 : prevIndex
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim()) {
        navigateToSearchPage();
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div ref={inputRef} className="relative">
        {/* Search input */}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-2 pl-10 border border-input rounded-xl bg-background text-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none"
          autoComplete="off"
        />

        {/* Search icon (left) */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Clear button (shows when there's input) */}
        {query && (
          <Button
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-10 h-full"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}

        {/* Search button (right) - navigates to search page */}
        <Button
          onClick={navigateToSearchPage}
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-0 h-full"
          aria-label="Go to search page"
        >
          <Search className="h-5 w-5 text-foreground" />
        </Button>
      </div>

      {/* Search results dropdown */}
      {showResults && (query.trim() || results.length > 0) && (
        <div
          ref={resultsRef}
          className="absolute z-10 mt-1 w-full bg-background border border-input rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  className={`px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                    selectedIndex === index ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <div className="flex items-center">
                    <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm">{item.title || item.name || item.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.type === 'user' ? 'User' : 'Page'}
                        {item.type === 'page' && item.username && ` by ${item.username}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No results found. Press Enter to search all content.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SearchButton;
