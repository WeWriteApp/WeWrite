'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  rootMargin?: string; // Intersection observer root margin
}

interface UseInfiniteScrollResult {
  isNearBottom: boolean;
  targetRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for detecting when user scrolls near the bottom of a container
 * Uses Intersection Observer for better performance
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollResult {
  const { threshold = 200, rootMargin = '0px' } = options;
  const [isNearBottom, setIsNearBottom] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setIsNearBottom(true);
        onLoadMore();
      } else {
        setIsNearBottom(false);
      }
    },
    [onLoadMore]
  );

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: `${threshold}px`,
      threshold: 0.1
    });

    observerRef.current.observe(target);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold]);

  return {
    isNearBottom,
    targetRef
  };
}

/**
 * Alternative hook using scroll event (fallback for older browsers)
 */
export function useScrollInfinite(
  onLoadMore: () => void,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollResult {
  const { threshold = 200 } = options;
  const [isNearBottom, setIsNearBottom] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!targetRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = targetRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom <= threshold) {
        setIsNearBottom(true);
        onLoadMore();
      } else {
        setIsNearBottom(false);
      }
    };

    const target = targetRef.current;
    if (target) {
      target.addEventListener('scroll', handleScroll, { passive: true });
      return () => target.removeEventListener('scroll', handleScroll);
    }
  }, [onLoadMore, threshold]);

  return {
    isNearBottom,
    targetRef
  };
}

/**
 * Hook for infinite scroll with debouncing to prevent excessive API calls
 */
export function useDebouncedInfiniteScroll(
  onLoadMore: () => void,
  delay: number = 300,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollResult {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedLoadMore = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onLoadMore();
    }, delay);
  }, [onLoadMore, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useInfiniteScroll(debouncedLoadMore, options);
}

/**
 * Hook for infinite scroll with manual load more functionality
 * This provides the API expected by components like GlobalRecentEdits
 */
interface UseInfiniteScrollWithLoadMoreOptions {
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
  /** External loading state from parent - if provided, overrides internal loading state */
  isLoading?: boolean;
}

interface UseInfiniteScrollWithLoadMoreResult {
  loadingMore: boolean;
  loadMore: () => void;
  targetRef: React.RefObject<HTMLDivElement>;
}

export function useInfiniteScrollWithLoadMore({
  hasMore,
  onLoadMore,
  threshold = 200,
  isLoading
}: UseInfiniteScrollWithLoadMoreOptions): UseInfiniteScrollWithLoadMoreResult {
  const [internalLoadingMore, setInternalLoadingMore] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Track if we've already triggered a load for the current intersection
  const hasTriggeredRef = useRef(false);

  // Use external loading state if provided, otherwise use internal state
  const loadingMore = isLoading !== undefined ? isLoading : internalLoadingMore;

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || hasTriggeredRef.current) {
      console.log('📄 InfiniteScroll: Skipping load more', { hasMore, loadingMore, hasTriggered: hasTriggeredRef.current });
      return;
    }

    console.log('📄 InfiniteScroll: Triggering load more');
    hasTriggeredRef.current = true;

    // Only set internal state if not using external loading state
    if (isLoading === undefined) {
      setInternalLoadingMore(true);
    }

    onLoadMore();
  }, [hasMore, loadingMore, onLoadMore, isLoading]);

  // Reset the trigger flag when loading completes (external state changes from true to false)
  useEffect(() => {
    if (!loadingMore && hasTriggeredRef.current) {
      // Small delay before allowing another trigger to prevent rapid re-triggers
      const timeout = setTimeout(() => {
        console.log('📄 InfiniteScroll: Resetting trigger flag');
        hasTriggeredRef.current = false;
        // Also reset internal loading state
        setInternalLoadingMore(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [loadingMore]);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loadingMore && !hasTriggeredRef.current) {
        loadMore();
      }
    },
    [hasMore, loadingMore, loadMore]
  );

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: `${threshold}px`,
      threshold: 0.1
    });

    observerRef.current.observe(target);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold]);

  return {
    loadingMore,
    loadMore,
    targetRef
  };
}
