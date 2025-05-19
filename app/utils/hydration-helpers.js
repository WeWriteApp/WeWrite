"use client";

import React from 'react';

/**
 * Utility functions to help with hydration and blank page issues
 */

/**
 * Safely access browser APIs only after hydration
 *
 * @param {Function} fn - Function that uses browser APIs
 * @param {any} fallbackValue - Value to return during server rendering
 * @returns {any} - Result of fn() or fallbackValue
 */
export function safelyAccessBrowser(fn, fallbackValue = null) {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    return fn();
  } catch (error) {
    console.error('Error accessing browser API:', error);
    return fallbackValue;
  }
}

/**
 * Force a component to re-render
 *
 * @returns {Function} - Call this function to force a re-render
 */
export function useForceRender() {
  const [, setCounter] = React.useState(0);

  return React.useCallback(() => {
    setCounter(c => c + 1);
  }, []);
}

/**
 * Detect if the current render is happening during hydration
 *
 * @returns {boolean} - True if currently hydrating
 */
export function useIsHydrating() {
  const [isHydrating, setIsHydrating] = React.useState(true);

  React.useEffect(() => {
    setIsHydrating(false);
  }, []);

  return isHydrating;
}

/**
 * Recover from a blank page by forcing a reload
 * This should be used as a last resort
 */
export function recoverFromBlankPage() {
  if (typeof window === 'undefined') return;

  // Check if the page appears to be blank (minimal content)
  const hasMinimalContent = document.body.innerHTML.length < 1000;
  const hasNoVisibleElements = document.querySelectorAll('div, p, h1, h2, h3, button, a').length < 5;

  if (hasMinimalContent || hasNoVisibleElements) {
    console.warn('Detected potential blank page, attempting recovery...');

    // Add a flag to prevent reload loops
    const reloadCount = parseInt(localStorage.getItem('blankPageReloadCount') || '0');

    if (reloadCount < 2) { // Limit to 2 reload attempts
      localStorage.setItem('blankPageReloadCount', (reloadCount + 1).toString());

      // Force reload after a short delay
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
    } else {
      console.warn('Max reload attempts reached, trying alternative recovery');

      // Try to force render some content
      document.body.innerHTML = `
        <div style="display: flex; height: 100vh; align-items: center; justify-content: center; flex-direction: column;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">We're having trouble loading the page</h1>
          <p style="margin-bottom: 24px;">Please try refreshing the page</p>
          <button
            onclick="window.location.reload(true)"
            style="padding: 8px 16px; background: #1768FF; color: white; border: none; border-radius: 4px; cursor: pointer;"
          >
            Refresh Page
          </button>
        </div>
      `;

      // Reset the counter after 5 minutes
      setTimeout(() => {
        localStorage.setItem('blankPageReloadCount', '0');
      }, 5 * 60 * 1000);
    }
  }
}

// Set up automatic blank page detection
if (typeof window !== 'undefined') {
  // Wait for the page to fully load
  window.addEventListener('load', () => {
    // Then wait a bit more to ensure all JS has executed
    setTimeout(() => {
      recoverFromBlankPage();
    }, 3000);
  });
}
