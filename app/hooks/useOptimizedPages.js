"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchPages, clearPagesCache } from "../lib/pageCache";

// Default limits for page loading
const DEFAULT_INITIAL_LIMIT = 20;
const USER_PAGE_INITIAL_LIMIT = 100;
const LOAD_MORE_LIMIT = 50;

/**
 * useOptimizedPages - A hook for efficiently fetching and caching pages data
 * 
 * Features:
 * - Efficient caching with memory and localStorage
 * - Progressive loading with optimistic UI updates
 * - Exponential backoff for retries
 * - Proper error handling and recovery
 * 
 * @param {string} userId - The user ID to fetch pages for
 * @param {boolean} includePrivate - Whether to include private pages
 * @param {string} currentUserId - The current user's ID
 * @param {boolean} isUserPage - Whether this is a user page (affects initial limit)
 */
const useOptimizedPages = (userId, includePrivate = true, currentUserId = null, isUserPage = false) => {
  // Use higher limit for user pages, default limit for home page
  const initialLimitCount = isUserPage ? USER_PAGE_INITIAL_LIMIT : DEFAULT_INITIAL_LIMIT;
  
  // State for pages data
  const [publicPages, setPublicPages] = useState([]);
  const [privatePages, setPrivatePages] = useState([]);
  const [lastPublicKey, setLastPublicKey] = useState(null);
  const [lastPrivateKey, setLastPrivateKey] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [isMorePublicLoading, setIsMorePublicLoading] = useState(false);
  const [isMorePrivateLoading, setIsMorePrivateLoading] = useState(false);
  
  // Pagination states
  const [hasMorePublicPages, setHasMorePublicPages] = useState(true);
  const [hasMorePrivatePages, setHasMorePrivatePages] = useState(true);
  
  // Error state
  const [error, setError] = useState(null);
  
  // Refs for tracking fetch attempts and backoff
  const fetchAttemptsRef = useRef(0);
  const maxFetchAttempts = 5; // Increased from 3 to 5
  const backoffTimeRef = useRef(1000); // Start with 1 second backoff
  const lastFetchTimeRef = useRef(0);
  const abortControllerRef = useRef(null);
  
  // Function to load initial pages with optimistic UI and caching
  const loadInitialPages = useCallback(async () => {
    if (!userId) {
      console.log("useOptimizedPages: No userId provided, skipping page fetch");
      setLoading(false);
      return;
    }
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    // Increment fetch attempts
    fetchAttemptsRef.current += 1;
    lastFetchTimeRef.current = Date.now();
    
    // Set up a timeout to detect stalled queries
    const timeoutId = setTimeout(() => {
      console.warn("useOptimizedPages: Query execution taking too long, may be stalled");
      
      // If we have cached data, use it even if it's stale
      const cachedPublicData = localStorage.getItem(`wewrite_pages_${userId}_public_${currentUserId === userId ? 'owner' : 'visitor'}_${initialLimitCount}`);
      const cachedPrivateData = includePrivate && currentUserId === userId ? 
        localStorage.getItem(`wewrite_pages_${userId}_private_owner_${initialLimitCount}`) : null;
      
      if (cachedPublicData || cachedPrivateData) {
        console.log("useOptimizedPages: Using stale cached data as fallback");
        
        try {
          if (cachedPublicData) {
            const parsed = JSON.parse(cachedPublicData);
            setPublicPages(parsed.data || []);
          }
          
          if (cachedPrivateData) {
            const parsed = JSON.parse(cachedPrivateData);
            setPrivatePages(parsed.data || []);
          }
          
          // Still show error but at least we have some data
          setError("We're having trouble refreshing your data. Showing cached content.");
        } catch (e) {
          console.error("Error parsing cached data:", e);
        }
      } else {
        // No cached data available, show empty state
        setPublicPages([]);
        setPrivatePages([]);
        setError("We couldn't load your content. Please try again later.");
      }
      
      setLoading(false);
    }, 3000);
    
    try {
      // First, fetch public pages
      const publicResult = await fetchPages(
        userId, 
        true, // isPublic = true
        currentUserId,
        initialLimitCount
      );
      
      // Update public pages state
      setPublicPages(publicResult.data || []);
      setLastPublicKey(publicResult.lastKey);
      setHasMorePublicPages(publicResult.hasMore);
      
      // If we're the owner and includePrivate is true, fetch private pages
      if (includePrivate && currentUserId === userId) {
        const privateResult = await fetchPages(
          userId,
          false, // isPublic = false
          currentUserId,
          initialLimitCount
        );
        
        // Update private pages state
        setPrivatePages(privateResult.data || []);
        setLastPrivateKey(privateResult.lastKey);
        setHasMorePrivatePages(privateResult.hasMore);
      }
      
      // Reset fetch attempts on success
      fetchAttemptsRef.current = 0;
      backoffTimeRef.current = 1000; // Reset backoff time
      
      // Clear the timeout since we got data
      clearTimeout(timeoutId);
      
      // Update loading state
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching pages:", err);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check if this was an abort error (user navigated away)
      if (err.name === 'AbortError') {
        console.log("Request was aborted");
        return;
      }
      
      // Set error state
      setError("Failed to load pages. Please try again later.");
      
      // If we haven't exceeded max attempts, retry with exponential backoff
      if (fetchAttemptsRef.current < maxFetchAttempts) {
        const backoffTime = backoffTimeRef.current;
        console.log(`useOptimizedPages: Will retry fetch in ${backoffTime}ms, attempt ${fetchAttemptsRef.current} of ${maxFetchAttempts}`);
        
        // Increase backoff time for next attempt (exponential backoff)
        backoffTimeRef.current = Math.min(backoffTimeRef.current * 2, 10000); // Cap at 10 seconds
        
        setTimeout(() => {
          loadInitialPages();
        }, backoffTime);
      } else {
        console.error("useOptimizedPages: Max fetch attempts reached, giving up");
        setLoading(false);
        
        // Try to use any cached data as a last resort
        const cachedPublicData = localStorage.getItem(`wewrite_pages_${userId}_public_${currentUserId === userId ? 'owner' : 'visitor'}_${initialLimitCount}`);
        
        if (cachedPublicData) {
          try {
            const parsed = JSON.parse(cachedPublicData);
            setPublicPages(parsed.data || []);
            setError("We're having trouble connecting to the server. Showing cached content.");
          } catch (e) {
            console.error("Error parsing cached data:", e);
          }
        }
      }
    }
  }, [userId, currentUserId, includePrivate, initialLimitCount]);
  
  // Function to load more public pages
  const loadMorePublicPages = useCallback(async () => {
    if (!lastPublicKey || isMorePublicLoading || !hasMorePublicPages) {
      return;
    }
    
    setIsMorePublicLoading(true);
    
    try {
      const result = await fetchPages(
        userId,
        true, // isPublic = true
        currentUserId,
        LOAD_MORE_LIMIT,
        lastPublicKey
      );
      
      // Update state with new pages
      setPublicPages(prev => [...prev, ...result.data]);
      setLastPublicKey(result.lastKey);
      setHasMorePublicPages(result.hasMore);
      setIsMorePublicLoading(false);
    } catch (err) {
      console.error("Error loading more public pages:", err);
      setError("Failed to load more pages. Please try again.");
      setIsMorePublicLoading(false);
    }
  }, [userId, currentUserId, lastPublicKey, isMorePublicLoading, hasMorePublicPages]);
  
  // Function to load more private pages
  const loadMorePrivatePages = useCallback(async () => {
    if (!lastPrivateKey || isMorePrivateLoading || !hasMorePrivatePages || currentUserId !== userId) {
      return;
    }
    
    setIsMorePrivateLoading(true);
    
    try {
      const result = await fetchPages(
        userId,
        false, // isPublic = false
        currentUserId,
        LOAD_MORE_LIMIT,
        lastPrivateKey
      );
      
      // Update state with new pages
      setPrivatePages(prev => [...prev, ...result.data]);
      setLastPrivateKey(result.lastKey);
      setHasMorePrivatePages(result.hasMore);
      setIsMorePrivateLoading(false);
    } catch (err) {
      console.error("Error loading more private pages:", err);
      setError("Failed to load more private pages. Please try again.");
      setIsMorePrivateLoading(false);
    }
  }, [userId, currentUserId, lastPrivateKey, isMorePrivateLoading, hasMorePrivatePages]);
  
  // Function to force refresh the data
  const refreshPages = useCallback(() => {
    // Clear cache for this user
    clearPagesCache(userId);
    
    // Reset states
    setPublicPages([]);
    setPrivatePages([]);
    setLastPublicKey(null);
    setLastPrivateKey(null);
    setHasMorePublicPages(true);
    setHasMorePrivatePages(true);
    
    // Reset fetch attempts
    fetchAttemptsRef.current = 0;
    backoffTimeRef.current = 1000;
    
    // Load pages again
    loadInitialPages();
  }, [userId, loadInitialPages]);
  
  // Load initial pages when component mounts or userId changes
  useEffect(() => {
    loadInitialPages();
    
    // Set up event listener for force refresh
    const handleForceRefresh = () => {
      console.log("useOptimizedPages: Received force-refresh event");
      refreshPages();
    };
    
    window.addEventListener('force-refresh-pages', handleForceRefresh);
    
    // Cleanup function
    return () => {
      window.removeEventListener('force-refresh-pages', handleForceRefresh);
      
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [userId, loadInitialPages, refreshPages]);
  
  // Combine public and private pages for the full list
  const allPages = [...publicPages, ...privatePages];
  
  // Sort by lastModified (newest first)
  allPages.sort((a, b) => {
    const dateA = a.lastModified?.toDate?.() || new Date(a.lastModified || 0);
    const dateB = b.lastModified?.toDate?.() || new Date(b.lastModified || 0);
    return dateB - dateA;
  });
  
  return {
    pages: allPages,
    publicPages,
    privatePages,
    loading,
    error,
    hasMorePages: hasMorePublicPages || hasMorePrivatePages,
    isMoreLoading: isMorePublicLoading || isMorePrivateLoading,
    loadMorePages: loadMorePublicPages,
    loadMorePrivatePages,
    refreshPages
  };
};

export default useOptimizedPages;
