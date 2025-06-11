"use client";

import React, { useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../providers/AuthProvider';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { useToast } from '../ui/use-toast';

interface FeatureFlagListenerProps {
  children: React.ReactNode;
}

/**
 * FeatureFlagListener - Provides real-time feature flag updates
 *
 * This component listens for changes to feature flags in Firestore and
 * provides safe refresh mechanisms when flags change.
 *
 * Safety Requirements:
 * - Only refresh when users are NOT in edit state
 * - Only refresh when users won't lose content
 * - Provide notifications about why refresh is happening
 */
export default function FeatureFlagListener({ children }: FeatureFlagListenerProps) {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  const lastFeatureFlagsRef = useRef<Record<string, boolean>>({});
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);
  const listenerSetupRef = useRef<boolean>(false);

  // Check if user is in a safe state for refresh
  const isUserInSafeState = (): boolean => {
    try {
      // Check if user is actively editing content
      const activeElement = document.activeElement;

      // Unsafe conditions: user is typing or editing
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.getAttribute('role') === 'textbox'
      )) {

        return false;
      }

      // Check for unsaved changes indicators
      const hasUnsavedChanges = document.querySelector('[data-unsaved-changes="true"]') ||
                               document.querySelector('.unsaved-indicator') ||
                               document.querySelector('[aria-label*="unsaved"]');

      if (hasUnsavedChanges) {

        return false;
      }

      // Check if user is in the middle of a form submission
      const isSubmitting = document.querySelector('[data-submitting="true"]') ||
                          document.querySelector('.submitting') ||
                          document.querySelector('button[disabled][type="submit"]');

      if (isSubmitting) {

        return false;
      }

      // Check for modal dialogs or important interactions
      const hasOpenModal = document.querySelector('[role="dialog"]') ||
                          document.querySelector('.modal') ||
                          document.querySelector('[data-modal-open="true"]');

      if (hasOpenModal) {

        return false;
      }

      return true;
    } catch (error) {
      console.error('[FeatureFlagListener] Error checking user state:', error);
      return false; // Err on the side of caution
    }
  };

  // Safely refresh the page with user notification and protection against multiple reloads
  const safeRefresh = (changedFlags: string[]) => {
    // CRITICAL FIX: Prevent multiple simultaneous refresh attempts
    const now = Date.now();
    const MIN_REFRESH_INTERVAL = 10000; // 10 seconds minimum between refreshes

    if (isRefreshingRef.current) {

      return;
    }

    if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {

      return;
    }

    if (!isUserInSafeState()) {

      // Show notification about pending refresh
      toast({
        title: 'Feature Update Available',
        description: `New features are available. The page will refresh automatically when safe.`,
        variant: 'default'
      });

      // Retry in 30 seconds
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        safeRefresh(changedFlags);
      }, 30000);

      return;
    }

    // Mark that we're starting a refresh
    isRefreshingRef.current = true;
    lastRefreshTimeRef.current = now;

    // Clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    // Show notification about refresh
    const flagNames = changedFlags.join(', ');
    toast({
      title: 'Features Updated',
      description: `${flagNames} feature${changedFlags.length > 1 ? 's have' : ' has'} been updated. Refreshing page...`,
      variant: 'default'
    });

    // Refresh after a short delay to show the notification
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  // Listen for feature flag changes with robust infinite reload prevention
  useEffect(() => {
    if (!user) {
      return;
    }

    // CRITICAL FIX: Prevent multiple listener setups
    if (listenerSetupRef.current) {
      return;
    }

    listenerSetupRef.current = true;

    const featureFlagsRef = doc(db, 'config', 'featureFlags');

    const unsubscribe = onSnapshot(featureFlagsRef, (doc) => {

      if (doc.exists()) {
        const newFlags = doc.data() as Record<string, boolean>;


        // CRITICAL FIX: Use a separate initialization flag instead of checking empty object
        if (!hasInitializedRef.current) {

          lastFeatureFlagsRef.current = { ...newFlags };
          hasInitializedRef.current = true;
          return;
        }

        // Compare with previous flags to detect actual changes
        const changedFlags: string[] = [];
        let hasActualChanges = false;

        Object.keys(newFlags).forEach(flagId => {
          if (lastFeatureFlagsRef.current[flagId] !== newFlags[flagId]) {
            changedFlags.push(flagId);
            hasActualChanges = true;

          }
        });

        // Check for removed flags
        Object.keys(lastFeatureFlagsRef.current).forEach(flagId => {
          if (!(flagId in newFlags)) {
            changedFlags.push(flagId);
            hasActualChanges = true;

          }
        });



        // Update the reference
        lastFeatureFlagsRef.current = { ...newFlags };

        // Only trigger refresh if there are actual changes
        if (hasActualChanges && changedFlags.length > 0) {


          // CRITICAL FIX: Debounce multiple rapid changes to prevent reload loops
          if (debounceTimeoutRef.current) {

            clearTimeout(debounceTimeoutRef.current);
          }

          debounceTimeoutRef.current = setTimeout(() => {

            safeRefresh(changedFlags);
          }, 3000); // 3 second debounce for extra safety
        } else {

        }
      } else {

        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
        }
      }
    }, (error) => {
      console.error('Error listening to feature flags:', error);
    });

    return () => {

      unsubscribe();

      // Reset setup flag to allow re-initialization
      listenerSetupRef.current = false;

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user, toast]);

  // Listen for manual feature flag change events (from admin panel)
  useEffect(() => {
    const handleFeatureFlagChange = (event: CustomEvent) => {
      const { flagId, newValue } = event.detail;


      // Update our local reference to prevent double-refresh
      lastFeatureFlagsRef.current = {
        ...lastFeatureFlagsRef.current,
        [flagId]: newValue
      };
    };

    window.addEventListener('featureFlagChanged', handleFeatureFlagChange as EventListener);

    return () => {
      window.removeEventListener('featureFlagChanged', handleFeatureFlagChange as EventListener);
    };
  }, []);

  return <>{children}</>;
}
