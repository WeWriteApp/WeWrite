'use client';

/**
 * Global Allocation State Context
 * 
 * Provides centralized state management for all allocation data to prevent
 * excessive API calls and improve performance during navigation.
 * 
 * Features:
 * - Global allocation cache with 30-minute TTL
 * - Optimistic updates for immediate UI feedback
 * - Batch API calls to reduce database reads
 * - Persistent cache across page refreshes
 * - Automatic cache invalidation
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { cache, cacheKey } from '../utils/serverCache';

interface AllocationData {
  pageId: string;
  allocationCents: number;
  lastUpdated: number;
}

interface AllocationStateContextType {
  getAllocation: (pageId: string) => number;
  setAllocation: (pageId: string, cents: number) => void;
  updateAllocationOptimistic: (pageId: string, changeCents: number) => void;
  batchUpdateAllocations: (updates: Array<{ pageId: string; cents: number }>) => Promise<void>;
  refreshAllocations: () => Promise<void>;
  isLoading: boolean;
  lastUpdated: Date | null;
}

const AllocationStateContext = createContext<AllocationStateContextType | undefined>(undefined);

// Global cache for allocation data
const allocationCache = new Map<string, Map<string, AllocationData>>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const BATCH_DELAY = 1000; // 1 second batch delay

interface AllocationStateProviderProps {
  children: React.ReactNode;
}

export function AllocationStateProvider({ children }: AllocationStateProviderProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Batch update management
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdates = useRef<Map<string, number>>(new Map());
  const fetchingRef = useRef<Promise<void> | null>(null);

  // Get allocation for a specific page
  const getAllocation = useCallback((pageId: string): number => {
    if (!user?.uid) return 0;
    
    const userAllocations = allocationCache.get(user.uid);
    if (!userAllocations) return 0;
    
    const allocation = userAllocations.get(pageId);
    return allocation?.allocationCents || 0;
  }, [user?.uid]);

  // Set allocation for a specific page (with cache update)
  const setAllocation = useCallback((pageId: string, cents: number) => {
    if (!user?.uid) return;
    
    let userAllocations = allocationCache.get(user.uid);
    if (!userAllocations) {
      userAllocations = new Map();
      allocationCache.set(user.uid, userAllocations);
    }
    
    userAllocations.set(pageId, {
      pageId,
      allocationCents: cents,
      lastUpdated: Date.now()
    });

    // Save to persistent cache
    const key = cacheKey('allocations', user.uid);
    const allAllocations = Object.fromEntries(userAllocations.entries());
    cache.set(key, allAllocations, CACHE_DURATION);
    
    setLastUpdated(new Date());
  }, [user?.uid]);

  // Optimistic update for immediate UI feedback
  const updateAllocationOptimistic = useCallback((pageId: string, changeCents: number) => {
    if (!user?.uid) return;
    
    const currentCents = getAllocation(pageId);
    const newCents = Math.max(0, currentCents + changeCents);
    
    // Update local state immediately
    setAllocation(pageId, newCents);
    
    // Add to pending batch updates
    pendingUpdates.current.set(pageId, newCents);
    
    // Schedule batch update
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(() => {
      processBatchUpdates();
    }, BATCH_DELAY);
    
    console.log(`[AllocationState] Optimistic update: ${pageId} ${changeCents > 0 ? '+' : ''}${changeCents} cents`);
  }, [user?.uid, getAllocation, setAllocation]);

  // Process batch updates to API
  const processBatchUpdates = useCallback(async () => {
    if (!user?.uid || pendingUpdates.current.size === 0) return;
    
    const updates = Array.from(pendingUpdates.current.entries()).map(([pageId, cents]) => ({
      pageId,
      cents
    }));
    
    pendingUpdates.current.clear();
    
    try {
      console.log(`[AllocationState] Processing batch updates:`, updates);
      
      // Make batch API call
      const response = await fetch('/api/usd/allocations/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates })
      });
      
      if (!response.ok) {
        throw new Error(`Batch update failed: ${response.status}`);
      }
      
      console.log(`[AllocationState] Batch update successful`);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('[AllocationState] Batch update failed:', error);
      // TODO: Implement retry logic or rollback optimistic updates
    }
  }, [user?.uid]);

  // Batch update multiple allocations
  const batchUpdateAllocations = useCallback(async (updates: Array<{ pageId: string; cents: number }>) => {
    if (!user?.uid) return;
    
    // Apply optimistic updates immediately
    updates.forEach(({ pageId, cents }) => {
      setAllocation(pageId, cents);
    });
    
    // Add to pending updates
    updates.forEach(({ pageId, cents }) => {
      pendingUpdates.current.set(pageId, cents);
    });
    
    // Process immediately for explicit batch calls
    await processBatchUpdates();
  }, [user?.uid, setAllocation, processBatchUpdates]);

  // Refresh allocations from API
  const refreshAllocations = useCallback(async () => {
    if (!user?.uid) return;
    
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      return fetchingRef.current;
    }
    
    const fetchPromise = (async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/usd/allocations');
        if (!response.ok) {
          throw new Error(`Failed to fetch allocations: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.allocations) {
          const userAllocations = new Map<string, AllocationData>();
          
          data.allocations.forEach((allocation: any) => {
            userAllocations.set(allocation.pageId, {
              pageId: allocation.pageId,
              allocationCents: allocation.usdCents || 0,
              lastUpdated: Date.now()
            });
          });
          
          allocationCache.set(user.uid, userAllocations);
          
          // Save to persistent cache
          const key = cacheKey('allocations', user.uid);
          const allAllocations = Object.fromEntries(userAllocations.entries());
          cache.set(key, allAllocations, CACHE_DURATION);
          
          setLastUpdated(new Date());
          console.log(`[AllocationState] Refreshed ${userAllocations.size} allocations`);
        }
        
      } catch (error) {
        console.error('[AllocationState] Error refreshing allocations:', error);
      } finally {
        setIsLoading(false);
        fetchingRef.current = null;
      }
    })();
    
    fetchingRef.current = fetchPromise;
    return fetchPromise;
  }, [user?.uid]);

  // Load allocations on mount and user change
  useEffect(() => {
    if (!user?.uid) {
      allocationCache.delete(user.uid || '');
      setLastUpdated(null);
      return;
    }
    
    // Check persistent cache first
    const key = cacheKey('allocations', user.uid);
    const cachedAllocations = cache.get<Record<string, AllocationData>>(key);
    
    if (cachedAllocations) {
      const userAllocations = new Map(Object.entries(cachedAllocations));
      allocationCache.set(user.uid, userAllocations);
      setLastUpdated(new Date());
      console.log(`[AllocationState] Loaded ${userAllocations.size} allocations from cache`);
    } else {
      // Fetch fresh data if no cache
      refreshAllocations();
    }
  }, [user?.uid, refreshAllocations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  const contextValue: AllocationStateContextType = {
    getAllocation,
    setAllocation,
    updateAllocationOptimistic,
    batchUpdateAllocations,
    refreshAllocations,
    isLoading,
    lastUpdated
  };

  return (
    <AllocationStateContext.Provider value={contextValue}>
      {children}
    </AllocationStateContext.Provider>
  );
}

export function useAllocationState() {
  const context = useContext(AllocationStateContext);
  if (context === undefined) {
    throw new Error('useAllocationState must be used within an AllocationStateProvider');
  }
  return context;
}
