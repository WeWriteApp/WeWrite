"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Custom hook for managing scroll restoration behavior
 * 
 * This hook ensures that when navigating to a new page, the scroll position
 * is reset to the top, fixing the issue where pages inherit scroll position
 * from the previous page.
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether scroll restoration is enabled (default: true)
 * @param {string} options.behavior - Scroll behavior: 'instant' or 'smooth' (default: 'instant')
 * @param {boolean} options.preserveWithinPage - Whether to preserve scroll when navigating within the same page (default: true)
 * @param {number} options.delay - Delay in ms before scrolling (default: 0)
 */
export function useScrollRestoration(options = {}) {
  const {
    enabled = true,
    behavior = 'instant',
    preserveWithinPage = true,
    delay = 0
  } = options;

  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Skip if scroll restoration is disabled
    if (!enabled || typeof window === 'undefined') return;

    // Check if this is a page change (not just a parameter change)
    const isPageChange = pathname !== previousPathnameRef.current;

    // If preserveWithinPage is true and this is not a page change, skip
    if (preserveWithinPage && !isPageChange) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Function to perform the scroll
    const scrollToTop = () => {
      // Only scroll if we're actually on a new page and the page has loaded
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Check if there are any sticky/fixed elements that might cause warnings
        const hasProblematicElements = document.querySelector('[style*="position: sticky"], [style*="position: fixed"], .sticky, .fixed');

        // Use a more gentle scroll approach if problematic elements exist
        if (hasProblematicElements) {
          // Use a timeout to avoid conflicts with sticky elements
          setTimeout(() => {
            window.scrollTo({
              top: 0,
              left: 0,
              behavior: 'instant' // Use instant to avoid conflicts
            });
          }, 50);
        } else {
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: behavior
          });
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`Scroll restoration: Scrolled to top for ${isPageChange ? 'new page' : 'same page'}:`, pathname);
        }
      }
    };

    // Execute scroll with delay to ensure page has loaded
    const scrollDelay = Math.max(delay, 100); // Minimum 100ms delay to ensure page transition
    timeoutRef.current = setTimeout(scrollToTop, scrollDelay);

    // Update the previous pathname
    previousPathnameRef.current = pathname;

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pathname, enabled, behavior, preserveWithinPage, delay]);

  // Return a manual scroll function that can be called programmatically
  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: behavior
      });
    }
  };

  return { scrollToTop };
}

/**
 * Simplified version of the hook that just scrolls to top on every page change
 * Uses a longer delay to ensure the destination page has loaded before scrolling
 */
export function useScrollToTop() {
  return useScrollRestoration({
    enabled: true,
    behavior: 'instant',
    preserveWithinPage: true,
    delay: 150 // Longer delay to ensure page transition is complete
  });
}

export default useScrollRestoration;