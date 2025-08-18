"use client";

import { useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';

/**
 * Production Data Fetch Hook
 *
 * This hook provides a fetch function that automatically adds the
 * X-Force-Production-Data header for logged-out users anywhere in the app.
 *
 * This ensures that logged-out users (including on auth pages) always see
 * production data for read-only operations, giving them an accurate
 * representation of the platform regardless of the development environment.
 *
 * Only after authentication do users switch to environment-appropriate collections.
 *
 * Usage:
 * ```typescript
 * const productionFetch = useProductionDataFetch();
 * const response = await productionFetch('/api/trending?limit=20');
 * ```
 *
 * The hook automatically:
 * - Detects if the user is logged out
 * - Adds X-Force-Production-Data: true header for ALL logged-out users
 * - Uses normal fetch behavior for logged-in users
 * - Preserves all other fetch options and behavior
 */
export function useProductionDataFetch() {
  const { user } = useAuth();
  
  const productionFetch = useCallback(async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    // Determine if we should force production data
    const shouldForceProduction = !user; // Force production data for ALL logged-out users

    // Prepare headers
    const headers = new Headers(init?.headers);

    // Add production data header for logged-out users (anywhere in the app)
    if (shouldForceProduction) {
      headers.set('X-Force-Production-Data', 'true');
      console.log('[Production Data Fetch] Adding X-Force-Production-Data header for logged-out user');
    }
    
    // Merge with existing init options
    const fetchOptions: RequestInit = {
      ...init,
      headers
    };
    
    return fetch(input, fetchOptions);
  }, [user]);
  
  return productionFetch;
}

/**
 * Production Data Fetch Hook with JSON parsing
 * 
 * Convenience hook that combines useProductionDataFetch with automatic JSON parsing.
 * 
 * Usage:
 * ```typescript
 * const fetchJson = useProductionDataFetchJson();
 * const data = await fetchJson('/api/trending?limit=20');
 * ```
 */
export function useProductionDataFetchJson() {
  const productionFetch = useProductionDataFetch();
  
  const fetchJson = useCallback(async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<any> => {
    const response = await productionFetch(input, init);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }, [productionFetch]);
  
  return fetchJson;
}

export default useProductionDataFetch;
