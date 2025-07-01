"use client";

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface BackNavigationReturn {
  /** Navigate back with unsaved changes check */
  navigateBack: (fallbackUrl?: string) => void;
  /** Force navigation back ignoring unsaved changes */
  forceNavigateBack: (fallbackUrl?: string) => void;
}

/**
 * Hook for handling back button navigation with proper cleanup and unsaved changes detection
 */
export function useBackNavigation(
  hasUnsavedChanges: boolean = false,
  onNavigationAttempt: ((url: string) => void) | null = null,
  onCleanNavigation: (() => void) | null = null
): BackNavigationReturn {
  const router = useRouter();

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent): boolean | void => {
      if (hasUnsavedChanges && onNavigationAttempt) {
        // Prevent the navigation
        event.preventDefault();
        
        // Push the current state back to prevent the browser from going back
        window.history.pushState(null, '', window.location.href);
        
        // Call the navigation attempt handler (should show unsaved changes dialog)
        onNavigationAttempt(document.referrer || '/');
        
        return false;
      } else if (onCleanNavigation) {
        // Allow navigation but call cleanup function
        onCleanNavigation();
      }
    };

    // Add popstate listener for back button
    window.addEventListener('popstate', handlePopState);

    // Push a state to enable popstate detection
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges, onNavigationAttempt, onCleanNavigation]);

  // Safe navigation function
  const navigateBack = useCallback((fallbackUrl: string = '/'): void => {
    try {
      // Clean up any page-specific state
      if (onCleanNavigation) {
        onCleanNavigation();
      }

      // Try to go back in history
      if (window.history.length > 1 && document.referrer) {
        window.history.back();
      } else {
        // Fallback to specified URL or home
        router.push(fallbackUrl);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Ultimate fallback
      router.push(fallbackUrl);
    }
  }, [router, onCleanNavigation]);

  // Force navigation (ignores unsaved changes)
  const forceNavigateBack = useCallback((fallbackUrl: string = '/'): void => {
    try {
      // Clean up any page-specific state
      if (onCleanNavigation) {
        onCleanNavigation();
      }

      // Force navigation
      if (window.history.length > 1 && document.referrer) {
        window.location.href = document.referrer;
      } else {
        window.location.href = fallbackUrl;
      }
    } catch (error) {
      console.error('Force navigation error:', error);
      // Ultimate fallback
      window.location.href = fallbackUrl;
    }
  }, [onCleanNavigation]);

  return {
    navigateBack,
    forceNavigateBack
  };
}