"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "./ui/command";
import { DialogTitle } from "./ui/dialog";
import { searchPages, searchUsers } from "../firebase/search";
import { useAuth } from "../providers/AuthProvider";
import { cn } from "../lib/utils";

// Helper function to highlight matching text in search results
const highlightMatch = (text: string, query: string) => {
  if (!query || !text) return text;

  try {
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    // If the query isn't found in the text, just return the text
    if (!normalizedText.includes(normalizedQuery)) {
      return text;
    }

    const startIndex = normalizedText.indexOf(normalizedQuery);
    const endIndex = startIndex + normalizedQuery.length;

    return (
      <>
        {text.substring(0, startIndex)}
        <span className="bg-primary/20 text-primary-foreground font-medium">
          {text.substring(startIndex, endIndex)}
        </span>
        {text.substring(endIndex)}
      </>
    );
  } catch (error) {
    // If there's any error in highlighting, just return the original text
    console.error("Error highlighting match:", error);
    return text;
  }
};

export function CommandKSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { user } = useAuth();

  // Toggle the command palette when pressing Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle search with type-ahead
  useEffect(() => {
    const fetchResults = async () => {
      // Show empty results if query is empty or user is not logged in
      if (!user) {
        setResults([]);
        return;
      }

      // For type-ahead, we'll show results even with a single character
      // But we'll still trim the query to remove whitespace
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // Search for pages - pass minimum length of 1 for type-ahead
        const pageResults = await searchPages(trimmedQuery, user.uid, 5, 1);

        // Search for users - pass minimum length of 1 for type-ahead
        const userResults = await searchUsers(trimmedQuery, 5, 1);

        // Combine results
        const combinedResults = [
          ...pageResults.map((page: any) => ({
            ...page,
            type: 'page',
            url: `/pages/${page.id}`
          })),
          ...userResults.map((user: any) => ({
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
    };

    // Reduce debounce time to 150ms for faster type-ahead response
    const timeoutId = setTimeout(fetchResults, 150);
    return () => clearTimeout(timeoutId);
  }, [query, user]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex < results.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim()) {
        // If no result is selected but there's a query, go to search page
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
    }
  };

  const handleSelect = (item: any) => {
    setOpen(false);
    router.push(item.url);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* Add DialogTitle for accessibility */}
      <DialogTitle className="sr-only">Search</DialogTitle>
      <div onKeyDown={handleKeyDown}>
        <CommandInput
          placeholder="Search pages, users..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? (
              <div className="py-6 text-center text-sm">Loading...</div>
            ) : query.trim() ? (
              <div className="py-6 text-center text-sm">
                No exact matches found. Press Enter to search all content.
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Start typing to search...
              </div>
            )}
          </CommandEmpty>
          {results.length > 0 && (
            <CommandGroup heading="Results">
              {results.map((item, index) => (
                <CommandItem
                  key={`${item.type}-${item.id}`}
                  onSelect={() => handleSelect(item)}
                  className={selectedIndex === index ? "bg-accent text-accent-foreground" : ""}
                >
                  <Search className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>
                      {/* Highlight the matching part of the title/name */}
                      {highlightMatch(item.title || item.name || item.username, query.trim())}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.type === 'user' ? 'User' : 'Page'}
                      {item.type === 'page' && item.username && ` by ${item.username}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}

export default CommandKSearch;
