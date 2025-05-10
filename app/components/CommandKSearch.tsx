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
import { searchPages, searchUsers } from "../firebase/search";
import { useAuth } from "../providers/AuthProvider";

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

  // Handle search
  useEffect(() => {
    const fetchResults = async () => {
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

    const timeoutId = setTimeout(fetchResults, 300);
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
            ) : (
              <div className="py-6 text-center text-sm">
                No results found. Press Enter to search all content.
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
                    <span>{item.title || item.name || item.username}</span>
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
