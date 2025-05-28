"use client";

import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { getRecentSearches, clearRecentSearches } from "../utils/recentSearches";
import { Button } from "../ui/button";

/**
 * RecentSearches Component
 * 
 * Displays a list of recent searches with the ability to clear them or select one
 * 
 * @param {Object} props
 * @param {Function} props.onSelect - Function to call when a search is selected
 * @param {string} props.userId - User ID for personalized recent searches
 */
export default function RecentSearches({ onSelect, userId = null }) {
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches on mount
  useEffect(() => {
    const searches = getRecentSearches(userId);
    setRecentSearches(searches);
  }, [userId]);

  // Handle clearing all recent searches
  const handleClearAll = () => {
    clearRecentSearches(userId);
    setRecentSearches([]);
  };

  // If there are no recent searches, don't render anything
  if (!recentSearches.length) {
    return null;
  }

  return (
    <div className="mt-6 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center">
          <Clock className="h-4 w-4 mr-2" />
          Recent Searches
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleClearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {recentSearches.map((search, index) => (
          <div 
            key={`${search.term}-${index}`}
            className="flex items-center bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full text-sm transition-all hover:shadow-sm cursor-pointer group"
          >
            <span 
              className="mr-1"
              onClick={() => onSelect(search.term)}
            >
              {search.term}
            </span>
            <X 
              className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer opacity-70 group-hover:opacity-100" 
              onClick={() => {
                const newSearches = recentSearches.filter((_, i) => i !== index);
                setRecentSearches(newSearches);
                localStorage.setItem(
                  userId ? `recentSearches_${userId}` : 'recentSearches', 
                  JSON.stringify(newSearches)
                );
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
