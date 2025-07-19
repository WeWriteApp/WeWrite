"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '../../lib/utils';
import { PageLoader } from './page-loader';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  enableTransitions?: boolean;
  loadingMessage?: string;
}

/**
 * WeWrite Search Performance Optimization - PageTransition Component
 *
 * Provides smooth transitions between pages with critical optimizations to prevent
 * visual flashing issues on the search page. This component was the primary cause
 * of search page performance problems and has been optimized accordingly.
 *
 * Critical Fix Implemented:
 * The PageTransition component was causing visual flashing/blank screen during
 * search input typing because it was monitoring searchParams changes and triggering
 * loading overlays for search parameter updates.
 *
 * Search Page Optimization:
 * - Detects search page parameter changes vs actual navigation
 * - Skips loading overlay for search parameter updates (?q=searchterm)
 * - Prevents visual flashing during typing in search input
 * - Maintains smooth transitions for actual page navigation
 * - Modified motion.div key to prevent re-animation on search page
 *
 * Performance Benefits:
 * 1. Maintaining a consistent loading state during navigation
 * 2. Animating content in and out smoothly
 * 3. Preventing content flickering and visual interruptions
 * 4. Eliminating search page visual flashing (CRITICAL FIX)
 * 5. Immediate content updates for search parameter changes
 *
 * Implementation Details:
 * - isSearchPageParamChange detection prevents unnecessary transitions
 * - Search page gets special handling to maintain input stability
 * - Scroll restoration for actual page navigation
 * - Optimized animation keys for different page types
 *
 * @param children The page content to render
 * @param className Optional additional classes
 * @param enableTransitions Whether to enable transitions (default: true)
 * @param loadingMessage Optional message to show during loading
 */
export function PageTransition({
  children,
  className,
  enableTransitions = true,
  loadingMessage
}: PageTransitionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [isMounted, setIsMounted] = useState(false);
  const initialRenderRef = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxLoadingTimeRef = useRef<NodeJS.Timeout | null>(null);
  const navigationStartTimeRef = useRef<number | null>(null);

  // Handle component mount - important for hydration safety
  useEffect(() => {
    setIsMounted(true);

    // Set initial content immediately to prevent blank page
    setContent(children);

    // Mark initial render as complete
    initialRenderRef.current = false;

    // Record navigation start time for performance tracking
    navigationStartTimeRef.current = Date.now();

    // Dispatch an event that other components can listen for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('page-transition-mounted'));
    }

    // Cleanup function to clear any pending timers
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (maxLoadingTimeRef.current) {
        clearTimeout(maxLoadingTimeRef.current);
      }
    };
  }, [children]);

  // Track route changes to show loading state
  useEffect(() => {
    // Skip if not mounted yet (prevents hydration issues)
    if (!isMounted) return;

    // Skip the initial render
    if (initialRenderRef.current) return;

    // If the path or search params changed
    const currentSearchParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).toString()
      : '';

    const isPathChange = pathname !== prevPathname;
    const isSearchParamsChange = searchParams.toString() !== currentSearchParams;

    // Skip transitions for search parameter changes on the search page to prevent flashing
    const isSearchPageParamChange = pathname === '/search' && !isPathChange && isSearchParamsChange;

    // Scroll restoration removed - let the browser handle natural scroll behavior
    // Forcing scroll-to-top during navigation creates jarring UX

    if ((isPathChange || isSearchParamsChange) && !isSearchPageParamChange) {
      // Start loading state
      setIsLoading(true);

      // Record navigation start time
      navigationStartTimeRef.current = Date.now();

      // Store the previous pathname
      setPrevPathname(pathname);

      // Clear any existing timers
      if (maxLoadingTimeRef.current) {
        clearTimeout(maxLoadingTimeRef.current);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set a maximum loading time to prevent infinite loading
      maxLoadingTimeRef.current = setTimeout(() => {
        if (isLoading) {
          console.warn('PageTransition: Maximum loading time reached, forcing completion');
          setIsLoading(false);
          setContent(children);

          // Dispatch an event for analytics
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('page-transition-timeout', {
              detail: {
                pathname,
                duration: Date.now() - (navigationStartTimeRef.current || Date.now())
              }
            }));
          }
        }
      }, 3000); // 3 seconds maximum loading time

      // Short delay to ensure loading state is visible
      // This prevents flickering when navigating between cached pages
      timerRef.current = setTimeout(() => {
        // Update content and finish loading
        setContent(children);
        setIsLoading(false);

        // Log navigation performance
        if (navigationStartTimeRef.current) {
          const duration = Date.now() - navigationStartTimeRef.current;
          console.log(`Page transition completed in ${duration}ms`);
          navigationStartTimeRef.current = null;
        }
      }, 300); // Short delay for better UX
    } else {
      // If it's not a navigation change or it's a search page param change, just update the content immediately
      // This prevents flashing on search parameter updates
      setContent(children);

      // Update previous pathname if it changed
      if (isPathChange) {
        setPrevPathname(pathname);
      }
    }
  }, [pathname, searchParams, children, prevPathname, isLoading, isMounted]);

  // If not mounted yet, render a minimal placeholder to prevent blank screen
  if (!isMounted) {
    return <div className={cn("min-h-screen bg-background", className)}></div>;
  }

  // If transitions are disabled, just render the children directly
  if (!enableTransitions) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative min-h-screen", className)}>
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <PageLoader
            message={loadingMessage || "Loading content..."}
            fullScreen={true}
          />
        )}
      </AnimatePresence>

      {/* Page content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname === '/search' ? pathname : pathname + (searchParams?.toString() || '')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {content || children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default PageTransition;