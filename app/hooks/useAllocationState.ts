"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { 
  AllocationState, 
  UseAllocationStateReturn,
  AllocationError,
  ALLOCATION_ERROR_CODES 
} from '../types/allocation';
import { getLoggedOutPageAllocation } from '../utils/simulatedUsd';

/**
 * Custom hook for managing allocation state for a specific page
 * 
 * This hook centralizes the logic for:
 * - Fetching current page allocation
 * - Managing loading states
 * - Handling optimistic updates
 * - Error handling and retries
 * - Caching allocation data
 */

interface UseAllocationStateOptions {
  pageId: string;
  enabled?: boolean;
  refetchInterval?: number;
  maxRetries?: number;
}

// Cache for allocation data to prevent unnecessary API calls
const allocationCache = new Map<string, {
  data: number;
  timestamp: number;
  expiresAt: number;
}>();

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const STALE_WHILE_REVALIDATE = 30 * 1000; // 30 seconds

export function useAllocationState({
  pageId,
  enabled = true,
  refetchInterval = 0,
  maxRetries = 3
}: UseAllocationStateOptions): UseAllocationStateReturn {
  const { user } = useAuth();
  
  const [allocationState, setAllocationState] = useState<AllocationState>({
    currentAllocationCents: 0,
    isLoading: true,
    isOptimistic: false,
    lastUpdated: null
  });

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate cache key
  const getCacheKey = useCallback((pageId: string, userId?: string) => {
    return `allocation:${pageId}:${userId || 'anonymous'}`;
  }, []);

  // Check if cached data is valid
  const getCachedData = useCallback((cacheKey: string) => {
    const cached = allocationCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.expiresAt) {
      allocationCache.delete(cacheKey);
      return null;
    }

    return {
      data: cached.data,
      isStale: now > cached.timestamp + STALE_WHILE_REVALIDATE
    };
  }, []);

  // Set cached data
  const setCachedData = useCallback((cacheKey: string, data: number) => {
    const now = Date.now();
    allocationCache.set(cacheKey, {
      data,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    });
  }, []);

  // Fetch allocation from API
  const fetchAllocation = useCallback(async (
    pageId: string, 
    signal?: AbortSignal
  ): Promise<number> => {
    if (!pageId) {
      throw new AllocationError(
        'Page ID is required',
        ALLOCATION_ERROR_CODES.INVALID_AMOUNT
      );
    }

    if (!user?.uid) {
      // Return simulated allocation for logged-out users
      return getLoggedOutPageAllocation(pageId);
    }

    try {
      const response = await fetch(`/api/usd/allocate?pageId=${pageId}`, {
        signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AllocationError(
            'Authentication required',
            ALLOCATION_ERROR_CODES.UNAUTHORIZED
          );
        }
        if (response.status === 404) {
          throw new AllocationError(
            'Page not found',
            ALLOCATION_ERROR_CODES.PAGE_NOT_FOUND
          );
        }
        if (response.status === 429) {
          throw new AllocationError(
            'Too many requests',
            ALLOCATION_ERROR_CODES.RATE_LIMITED,
            true
          );
        }
        throw new AllocationError(
          `HTTP ${response.status}: ${response.statusText}`,
          ALLOCATION_ERROR_CODES.NETWORK_ERROR,
          true
        );
      }

      const data = await response.json();
      return data.currentAllocation || 0;
    } catch (error) {
      if (error instanceof AllocationError) {
        throw error;
      }
      if (error.name === 'AbortError') {
        throw error;
      }
      throw new AllocationError(
        'Network request failed',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );
    }
  }, [user?.uid]);

  // Main refresh function
  const refreshAllocation = useCallback(async (forceRefresh = false) => {
    if (!enabled || !pageId) return;

    const cacheKey = getCacheKey(pageId, user?.uid);
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey);
      if (cached && !cached.isStale) {
        setAllocationState(prev => ({
          ...prev,
          currentAllocationCents: cached.data,
          isLoading: false,
          lastUpdated: new Date()
        }));
        return;
      }
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setAllocationState(prev => ({
      ...prev,
      isLoading: true
    }));

    try {
      const allocation = await fetchAllocation(pageId, abortControllerRef.current.signal);
      
      // Cache the result
      setCachedData(cacheKey, allocation);
      
      setAllocationState(prev => ({
        ...prev,
        currentAllocationCents: allocation,
        isLoading: false,
        isOptimistic: false,
        lastUpdated: new Date()
      }));

      retryCountRef.current = 0;
    } catch (error) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }

      console.error('Error fetching allocation:', error);

      // Handle retries for retryable errors
      if (error instanceof AllocationError && error.retryable && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff
        
        setTimeout(() => {
          refreshAllocation(forceRefresh);
        }, delay);
        return;
      }

      setAllocationState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  }, [enabled, pageId, user?.uid, getCacheKey, getCachedData, setCachedData, fetchAllocation, maxRetries]);

  // Optimistic update function
  const setOptimisticAllocation = useCallback((cents: number) => {
    setAllocationState(prev => ({
      ...prev,
      currentAllocationCents: cents,
      isOptimistic: true
    }));
  }, []);

  // Initial fetch and user change effect
  useEffect(() => {
    refreshAllocation();
  }, [refreshAllocation]);

  // Refetch interval effect
  useEffect(() => {
    if (refetchInterval > 0) {
      refetchIntervalRef.current = setInterval(() => {
        refreshAllocation();
      }, refetchInterval);

      return () => {
        if (refetchIntervalRef.current) {
          clearInterval(refetchIntervalRef.current);
        }
      };
    }
  }, [refetchInterval, refreshAllocation]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, []);

  return {
    allocationState,
    refreshAllocation: () => refreshAllocation(true),
    setOptimisticAllocation
  };
}
