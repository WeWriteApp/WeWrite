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
      return Promise.resolve(); // Return resolved promise for consistency
    }

    const trimmedSearchTerm = searchTerm.trim();

    // Prevent duplicate searches
    if (trimmedSearchTerm === lastSearchRef.current) {
      return Promise.resolve(); // Return resolved promise for consistency
    }

    lastSearchRef.current = trimmedSearchTerm;
    setIsLoading(true);
    setCurrentQuery(trimmedSearchTerm);

    // Create new abort controller for this search
    abortControllerRef.current = new AbortController();

    try {
      // Allow searches even without authentication for public content
      const searchUserId = stableUserId.current || null;
      console.log(`Performing search for: "${trimmedSearchTerm}" with userId:`, searchUserId);

      const queryUrl = `/api/search?userId=${searchUserId || ''}&searchTerm=${encodeURIComponent(trimmedSearchTerm)}&groupIds=${stableUserGroups.current || []}&useScoring=true`;
      console.log(`Making API request to search for "${trimmedSearchTerm}"`, queryUrl);

      const response = await fetch(queryUrl, {
        signal: abortControllerRef.current.signal,
        // Add timeout to prevent hanging requests
        timeout: 10000
      });

      if (!response.ok) {
        console.error('Search API returned error:', response.status, response.statusText);
        throw new Error(`Search API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Search results for "${trimmedSearchTerm}":`, data);

      if (data.error) {
        console.warn('Search API returned error:', data.error);
        // Don't throw on API errors, just log them and continue with empty results
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
        return Promise.resolve(); // Return resolved promise for consistency
      }
      console.error('Error searching:', error);
      setResults({ pages: [], users: [], groups: [] });

      // Re-throw the error so the caller can handle it (for retry logic)
      throw error;
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
