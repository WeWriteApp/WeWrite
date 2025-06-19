/**
 * Hook for batch loading page data to reduce individual requests
 * Optimizes performance by grouping page requests together
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getBatchPages, preloadPages } from '../utils/requestCache';
import { useAuth } from '../providers/AuthProvider';

interface BatchPageState {
  pages: Record<string, any>;
  loading: boolean;
  error: string | null;
}

interface UseBatchPageDataOptions {
  preload?: boolean;
  batchDelay?: number; // Delay to batch requests together
}

/**
 * Hook for efficiently loading multiple pages with batching and caching
 */
export const useBatchPageData = (
  pageIds: string[],
  options: UseBatchPageDataOptions = {}
) => {
  const { user } = useAuth();
  const { preload = false, batchDelay = 50 } = options;
  
  const [state, setState] = useState<BatchPageState>({
    pages: {},
    loading: false,
    error: null
  });

  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPageIds = useRef<Set<string>>(new Set());

  const loadPages = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const results = await getBatchPages(ids, user?.uid);
      setState(prev => ({
        ...prev,
        pages: { ...prev.pages, ...results },
        loading: false
      }));
    } catch (error) {
      console.error('Error loading batch pages:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load pages'
      }));
    }
  }, [user?.uid]);

  const batchLoadPages = useCallback((ids: string[]) => {
    // Add new IDs to pending batch
    ids.forEach(id => pendingPageIds.current.add(id));

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Set new timeout to batch requests
    batchTimeoutRef.current = setTimeout(() => {
      const idsToLoad = Array.from(pendingPageIds.current);
      pendingPageIds.current.clear();
      loadPages(idsToLoad);
    }, batchDelay);
  }, [loadPages, batchDelay]);

  // Load pages when pageIds change
  useEffect(() => {
    if (pageIds.length > 0) {
      const newIds = pageIds.filter(id => !state.pages[id]);
      if (newIds.length > 0) {
        batchLoadPages(newIds);
      }
    }
  }, [pageIds, state.pages, batchLoadPages]);

  // Preload pages if requested
  useEffect(() => {
    if (preload && pageIds.length > 0) {
      preloadPages(pageIds, user?.uid);
    }
  }, [preload, pageIds, user?.uid]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    pages: state.pages,
    loading: state.loading,
    error: state.error,
    loadPage: (pageId: string) => batchLoadPages([pageId]),
    loadPages: batchLoadPages
  };
};

/**
 * Hook for loading a single page with caching
 */
export const useCachedPageData = (pageId: string | null) => {
  const { pages, loading, error, loadPage } = useBatchPageData(
    pageId ? [pageId] : [],
    { batchDelay: 10 } // Shorter delay for single pages
  );

  return {
    pageData: pageId ? pages[pageId] : null,
    loading,
    error,
    refetch: () => pageId && loadPage(pageId)
  };
};

/**
 * Hook for preloading pages based on user interaction patterns
 */
export const usePagePreloader = () => {
  const { user } = useAuth();

  const preloadPagesFromContent = useCallback((content: any[]) => {
    if (!content || !Array.isArray(content)) return;

    const pageIds: string[] = [];
    
    // Extract page IDs from content structure
    const extractPageIds = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'link' && node.pageId) {
          pageIds.push(node.pageId);
        }
        if (node.children && Array.isArray(node.children)) {
          extractPageIds(node.children);
        }
      }
    };

    extractPageIds(content);

    if (pageIds.length > 0) {
      preloadPages(pageIds, user?.uid);
    }
  }, [user?.uid]);

  const preloadFromLinks = useCallback((linkElements: HTMLElement[]) => {
    const pageIds: string[] = [];
    
    linkElements.forEach(element => {
      const pageId = element.getAttribute('data-page-id');
      if (pageId) {
        pageIds.push(pageId);
      }
    });

    if (pageIds.length > 0) {
      preloadPages(pageIds, user?.uid);
    }
  }, [user?.uid]);

  return {
    preloadPagesFromContent,
    preloadFromLinks
  };
};

export default useBatchPageData;
