"use client";

import { useEffect } from 'react';

/**
 * Disables browser's automatic scroll restoration.
 *
 * The browser's scroll restoration can cause layout shifts during SPA navigation
 * because it tries to restore the previous page's scroll position even when
 * navigating to a new page.
 *
 * By setting scrollRestoration to 'manual', we take control of scroll behavior
 * and Next.js's built-in scroll-to-top on navigation will work correctly.
 */
export default function ScrollRestorationDisabler() {
  useEffect(() => {
    // Disable browser's automatic scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  return null;
}
