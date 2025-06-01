"use client";

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook for handling back button navigation with proper cleanup and unsaved changes detection
 * 
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {Function} onNavigationAttempt - Function to call when navigation is attempted with unsaved changes
 * @param {Function} onCleanNavigation - Function to call for clean navigation (optional)
 * @returns {Object} - Navigation utilities
 */
export function useBackNavigation(hasUnsavedChanges = false, onNavigationAttempt = null, onCleanNavigation = null) {
  const router = useRouter();

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event) => {
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
  const navigateBack = useCallback((fallbackUrl = '/') => {
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
  const forceNavigateBack = useCallback((fallbackUrl = '/') => {
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
