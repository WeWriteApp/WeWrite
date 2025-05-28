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
        console.log('[FeatureFlagListener] User is actively editing, not safe to refresh');
        return false;
      }

      // Check for unsaved changes indicators
      const hasUnsavedChanges = document.querySelector('[data-unsaved-changes="true"]') ||
                               document.querySelector('.unsaved-indicator') ||
                               document.querySelector('[aria-label*="unsaved"]');

      if (hasUnsavedChanges) {
        console.log('[FeatureFlagListener] Detected unsaved changes, not safe to refresh');
        return false;
      }

      // Check if user is in the middle of a form submission
      const isSubmitting = document.querySelector('[data-submitting="true"]') ||
                          document.querySelector('.submitting') ||
                          document.querySelector('button[disabled][type="submit"]');

      if (isSubmitting) {
        console.log('[FeatureFlagListener] Form submission in progress, not safe to refresh');
        return false;
      }

      // Check for modal dialogs or important interactions
      const hasOpenModal = document.querySelector('[role="dialog"]') ||
                          document.querySelector('.modal') ||
                          document.querySelector('[data-modal-open="true"]');

      if (hasOpenModal) {
        console.log('[FeatureFlagListener] Modal dialog open, not safe to refresh');
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
      console.log('[FeatureFlagListener] Refresh already in progress, ignoring duplicate request');
      return;
    }

    if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      console.log('[FeatureFlagListener] Too soon since last refresh, ignoring request');
      return;
    }

    if (!isUserInSafeState()) {
      console.log('[FeatureFlagListener] User not in safe state, scheduling retry');

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
      console.log('[FeatureFlagListener] Executing page reload for flags:', changedFlags);
      window.location.reload();
    }, 2000);
  };

  // Listen for feature flag changes with robust infinite reload prevention
  useEffect(() => {
    if (!user) {
      console.log('[FeatureFlagListener] No user, skipping listener setup');
      return;
    }

    // CRITICAL FIX: Prevent multiple listener setups
    if (listenerSetupRef.current) {
      console.log('[FeatureFlagListener] Listener already set up, skipping');
      return;
    }

    listenerSetupRef.current = true;
    console.log('[FeatureFlagListener] Setting up feature flag listener for user:', user.email);

    const featureFlagsRef = doc(db, 'config', 'featureFlags');

    const unsubscribe = onSnapshot(featureFlagsRef, (doc) => {
      console.log('[FeatureFlagListener] Snapshot received, doc exists:', doc.exists());

      if (doc.exists()) {
        const newFlags = doc.data() as Record<string, boolean>;
        console.log('[FeatureFlagListener] Feature flags from database:', newFlags);
        console.log('[FeatureFlagListener] Current lastFeatureFlagsRef:', lastFeatureFlagsRef.current);
        console.log('[FeatureFlagListener] hasInitializedRef:', hasInitializedRef.current);

        // CRITICAL FIX: Use a separate initialization flag instead of checking empty object
        if (!hasInitializedRef.current) {
          console.log('[FeatureFlagListener] First time initialization, setting flags without reload');
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
            console.log(`[FeatureFlagListener] Flag ${flagId} changed: ${lastFeatureFlagsRef.current[flagId]} -> ${newFlags[flagId]}`);
          }
        });

        // Check for removed flags
        Object.keys(lastFeatureFlagsRef.current).forEach(flagId => {
          if (!(flagId in newFlags)) {
            changedFlags.push(flagId);
            hasActualChanges = true;
            console.log(`[FeatureFlagListener] Flag ${flagId} was removed`);
          }
        });

        console.log('[FeatureFlagListener] Changed flags:', changedFlags);
        console.log('[FeatureFlagListener] Has actual changes:', hasActualChanges);

        // Update the reference
        lastFeatureFlagsRef.current = { ...newFlags };

        // Only trigger refresh if there are actual changes
        if (hasActualChanges && changedFlags.length > 0) {
          console.log(`[FeatureFlagListener] ${changedFlags.length} flag(s) actually changed, scheduling debounced refresh`);

          // CRITICAL FIX: Debounce multiple rapid changes to prevent reload loops
          if (debounceTimeoutRef.current) {
            console.log('[FeatureFlagListener] Clearing existing debounce timeout');
            clearTimeout(debounceTimeoutRef.current);
          }

          debounceTimeoutRef.current = setTimeout(() => {
            console.log(`[FeatureFlagListener] Debounce timeout completed, triggering safe refresh for flags:`, changedFlags);
            safeRefresh(changedFlags);
          }, 3000); // 3 second debounce for extra safety
        } else {
          console.log('[FeatureFlagListener] No actual changes detected, not triggering refresh');
        }
      } else {
        console.log('[FeatureFlagListener] Feature flags document does not exist');
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
        }
      }
    }, (error) => {
      console.error('[FeatureFlagListener] Error listening to feature flags:', error);
    });

    return () => {
      console.log('[FeatureFlagListener] Cleaning up feature flag listener');
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
      console.log(`[FeatureFlagListener] Manual feature flag change detected: ${flagId} = ${newValue}`);

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
