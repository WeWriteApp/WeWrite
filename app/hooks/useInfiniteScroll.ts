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
