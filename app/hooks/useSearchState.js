"use client";

import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Custom hook for managing search state in an isolated way
 * This prevents re-renders from cascading to parent components
 */
export const useSearchState = (userId, userGroups) => {
  // Core search state
  const [currentQuery, setCurrentQuery] = useState('');
  const [results, setResults] = useState({ pages: [], users: [], groups: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Refs to prevent unnecessary re-renders
  const lastSearchRef = useRef('');
  const abortControllerRef = useRef(null);

  // Stabilize dependencies to prevent unnecessary re-renders
  const stableUserId = useRef(userId);
  const stableUserGroups = useRef(userGroups);

  // Update refs when values change
  if (stableUserId.current !== userId) {
    stableUserId.current = userId;
  }
  if (JSON.stringify(stableUserGroups.current) !== JSON.stringify(userGroups)) {
    stableUserGroups.current = userGroups;
  }

  // Memoized search function that's stable across re-renders
  const performSearch = useCallback(async (searchTerm) => {
    // Cancel any ongoing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!searchTerm || !searchTerm.trim()) {
      setResults({ pages: [], users: [], groups: [] });
      setIsLoading(false);
      setCurrentQuery('');
      lastSearchRef.current = '';
      return;
    }

    const trimmedSearchTerm = searchTerm.trim();

    // Prevent duplicate searches
    if (trimmedSearchTerm === lastSearchRef.current) {
      return;
    }

    lastSearchRef.current = trimmedSearchTerm;
    setIsLoading(true);
    setCurrentQuery(trimmedSearchTerm);

    // Create new abort controller for this search
    abortControllerRef.current = new AbortController();

    try {
      if (!stableUserId.current) {
        console.log(`User not authenticated, showing empty results for: "${trimmedSearchTerm}"`);
        setResults({ pages: [], users: [], groups: [] });
        setIsLoading(false);
        return;
      }

      const queryUrl = `/api/search?userId=${stableUserId.current}&searchTerm=${encodeURIComponent(trimmedSearchTerm)}&groupIds=${stableUserGroups.current}&useScoring=true`;
      console.log(`Making API request to search for "${trimmedSearchTerm}"`, queryUrl);

      const response = await fetch(queryUrl, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        console.error('Search API returned error:', response.status, response.statusText);
        throw new Error(`Search API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Search results for "${trimmedSearchTerm}":`, data);

      if (data.error) {
        console.warn('Search API returned error:', data.error);
      }

      // Process the results to ensure usernames are properly set
      const processedPages = await Promise.all((data.pages || []).map(async (page) => {
        if (!page.username || page.username === "Anonymous" || page.username === "NULL") {
          try {
            const { getUsernameById } = await import('../utils/userUtils');
            if (page.userId) {
              const username = await getUsernameById(page.userId);
              return {
                ...page,
                username: username || "Missing username"
              };
            }
          } catch (error) {
            console.error('Error fetching username:', error);
          }
        }
        return page;
      }));

      // Deduplicate results
      const uniquePages = Array.from(
        new Map(processedPages.map(page => [page.id, page])).values()
      );
      const uniqueUsers = Array.from(
        new Map((data.users || []).map(user => [user.id, user])).values()
      );

      setResults({
        pages: uniquePages,
        users: uniqueUsers,
        groups: []
      });

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Search aborted:', trimmedSearchTerm);
        return;
      }
      console.error('Error searching:', error);
      setResults({ pages: [], users: [], groups: [] });
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove dependencies to prevent re-renders - use stable refs instead

  // Clear search function
  const clearSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setResults({ pages: [], users: [], groups: [] });
    setCurrentQuery('');
    lastSearchRef.current = '';
  }, []);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    currentQuery,
    results,
    isLoading,
    performSearch,
    clearSearch
  }), [currentQuery, results, isLoading, performSearch, clearSearch]);
};
