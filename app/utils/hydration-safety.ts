"use client";

/**
 * Hydration Safety Utilities
 *
 * This module provides utilities to help prevent hydration mismatches and blank page issues
 * in Next.js applications. It includes functions to:
 *
 * 1. Safely access browser APIs only after hydration
 * 2. Detect and recover from blank page issues
 * 3. Provide fallback content during hydration
 */

import { useEffect, useState, DependencyList } from 'react';

/**
 * Safely access browser APIs only after hydration
 */
export function useAfterHydration(callback: () => void | (() => void), dependencies: DependencyList = []): void {
  useEffect(() => {
    // Only run on the client
    if (typeof window !== 'undefined') {
      // Execute the callback
      return callback();
    }
  }, dependencies);
}

/**
 * Hook to track hydration status
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    // Set hydrated to true after component mounts
    setHydrated(true);
  }, []);

  return hydrated;
}

/**
 * Detect and recover from blank page issues
 *
 * This function sets up a safety mechanism to detect when a page might be blank
 * and automatically attempts to recover by forcing a refresh.
 */
export function setupBlankPageRecovery(): (() => void) | undefined {
  if (typeof window === 'undefined') return;
  
  // Set up a safety timeout to detect blank pages
  const safetyTimeout = setTimeout(() => {
    // Check if the page appears to be blank (minimal content)
    const mainContent = document.querySelector('main');
    const hasMinimalContent = !mainContent || 
      (mainContent.innerText.trim().length < 50 && mainContent.children.length < 3);
    
    if (hasMinimalContent) {
      console.warn('Blank page detected, attempting recovery');
      
      // Check if we've already tried refreshing
      const refreshAttempts = parseInt(localStorage.getItem('blankPageRefreshAttempts') || '0');
      
      if (refreshAttempts < 2) { // Limit to 2 refresh attempts
        // Increment the counter
        localStorage.setItem('blankPageRefreshAttempts', (refreshAttempts + 1).toString());
        
        // Force a refresh
        window.location.reload();
      } else {
        console.warn('Max refresh attempts reached, trying alternative recovery');
        
        // Dispatch an event that components can listen for
        window.dispatchEvent(new CustomEvent('blank-page-detected'));
        
        // Reset the counter after 5 minutes
        setTimeout(() => {
          localStorage.setItem('blankPageRefreshAttempts', '0');
        }, 5 * 60 * 1000);
      }
    } else {
      // Page has content, reset the counter
      localStorage.setItem('blankPageRefreshAttempts', '0');
    }
  }, 5000); // Check after 5 seconds
  
  // Clean up the timeout when the page is properly loaded
  window.addEventListener('load', () => {
    clearTimeout(safetyTimeout);
    localStorage.setItem('blankPageRefreshAttempts', '0');
  });
  
  return () => {
    clearTimeout(safetyTimeout);
  };
}

/**
 * Initialize all hydration safety mechanisms
 *
 * Call this function once at the app root level to set up all safety mechanisms
 */
export function initializeHydrationSafety(): void {
  if (typeof window === 'undefined') return;
  
  // Set up blank page recovery
  setupBlankPageRecovery();
  
  // Add a class to the body when hydration is complete
  document.body.classList.add('hydrated');
  
  // Log hydration completion
  console.log('Hydration safety mechanisms initialized');
  
  // Dispatch an event that components can listen for
  window.dispatchEvent(new CustomEvent('hydration-complete'));
}