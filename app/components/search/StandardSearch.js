"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, Loader2, User, FileText } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { search, formatSearchResults } from '../../services/SearchService';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';

/**
 * StandardSearch - A standardized search component for use across the application
 * 
 * @param {object} props - Component props
 * @param {function} props.onSelect - Callback when an item is selected
 * @param {boolean} props.autoFocus - Whether to autofocus the search input
 * @param {string} props.placeholder - Placeholder text for the search input
 * @param {boolean} props.includeUsers - Whether to include users in search results
 * @param {boolean} props.includePages - Whether to include pages in search results
 * @param {boolean} props.editableOnly - Whether to only show pages the user can edit
 * @param {string} props.initialValue - Initial search value
 * @param {function} props.onFocus - Callback when the search input is focused
 * @param {function} props.onBlur - Callback when the search input is blurred
 * @param {string} props.className - Additional CSS classes
 */
export default function StandardSearch({
  onSelect,
  autoFocus = false,
  placeholder = "Search...",
  includeUsers = true,
  includePages = true,
  editableOnly = false,
  initialValue = "",
  onFocus,
  onBlur,
  className = ""
}) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { user } = useAuth();
  const router = useRouter();
  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const { trackInteractionEvent } = useWeWriteAnalytics();

  // Handle search term changes
  useEffect(() => {
    if (!user) return;
    
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    // Minimum 2 characters for search
    if (searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }

    // Perform search
    search(searchTerm, {
      userId: user.uid,
      groupIds: user.groups ? Object.keys(user.groups) : [],
      includeUsers,
      includePages,
      editableOnly,
      onResults: (searchResults) => {
        const formattedResults = formatSearchResults(searchResults, searchTerm);
        setResults(formattedResults);
      },
      onError: (error) => {
        console.error("Search error:", error);
        setResults([]);
      },
      onLoading: (loading) => {
        setIsSearching(loading);
      }
    });
  }, [searchTerm, user, includeUsers, includePages, editableOnly]);

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target) &&
        resultsRef.current && 
        !resultsRef.current.contains(event.target)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showResults || results.length === 0) return;

    // Arrow down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    }
    // Arrow up
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    }
    // Enter
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectItem(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelectItem(results[0]);
      }
    }
    // Escape
    else if (e.key === 'Escape') {
      e.preventDefault();
      setShowResults(false);
    }
  };

  // Handle item selection
  const handleSelectItem = (item) => {
    if (!item) return;

    // Track the selection
    trackInteractionEvent('search_result_selected', {
      result_type: item.type || 'page',
      query: searchTerm
    });

    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(item);
      setShowResults(false);
      return;
    }

    // Default navigation behavior
    if (item.type === 'user') {
      router.push(`/u/${item.id}`);
    } else {
      router.push(`/${item.id}`);
    }
    
    setShowResults(false);
  };

  // Highlight matching text
  const highlightMatch = (text, highlight) => {
    if (!highlight.trim() || !text) return text;
    
    try {
      const regex = new RegExp(`(${highlight.trim()})`, 'gi');
      const parts = text.split(regex);
      
      return parts.map((part, i) => 
        regex.test(part) ? <mark key={i} className="bg-primary/20 text-foreground">{part}</mark> : part
      );
    } catch (e) {
      return text;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative" ref={searchRef}>
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            setShowResults(true);
            if (onFocus) onFocus();
          }}
          onBlur={() => {
            if (onBlur) onBlur();
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className="pl-10"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Search Results */}
      {showResults && searchTerm.trim().length >= 2 && (
        <div 
          ref={resultsRef}
          className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-md max-h-[60vh] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {isSearching ? 'Searching...' : 'No results found'}
            </div>
          ) : (
            <div>
              {/* Group results by category */}
              {['user', 'Your Pages', 'Group Pages', 'Public Pages'].map(category => {
                const categoryResults = results.filter(item => 
                  (category === 'user' && item.type === 'user') || 
                  (category !== 'user' && item.category === category)
                );
                
                if (categoryResults.length === 0) return null;
                
                return (
                  <div key={category}>
                    <div className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/50">
                      {category === 'user' ? 'Users' : category}
                    </div>
                    {categoryResults.map((item, index) => {
                      const resultIndex = results.findIndex(r => r.id === item.id && r.type === item.type);
                      const isSelected = resultIndex === selectedIndex;
                      
                      return (
                        <Button
                          key={`${item.type || 'page'}-${item.id}`}
                          variant="ghost"
                          className={`w-full justify-start px-3 py-2 h-auto text-left ${isSelected ? 'bg-accent' : ''}`}
                          onClick={() => handleSelectItem(item)}
                        >
                          <div className="flex items-center">
                            {item.type === 'user' ? (
                              <User className="h-4 w-4 mr-2 text-muted-foreground" />
                            ) : (
                              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-medium">
                                {highlightMatch(item.name, item.highlight)}
                              </div>
                              {item.username && !item.type && (
                                <div className="text-xs text-muted-foreground">
                                  by {item.username}
                                </div>
                              )}
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
