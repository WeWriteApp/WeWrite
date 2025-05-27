"use client";

import React, { useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../providers/AuthProvider';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/database';
import { useToast } from './ui/use-toast';

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

  // Safely refresh the page with user notification
  const safeRefresh = (changedFlags: string[]) => {
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

  // Listen for feature flag changes
  useEffect(() => {
    if (!user) return;

    console.log('[FeatureFlagListener] Setting up feature flag listener');

    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    
    const unsubscribe = onSnapshot(featureFlagsRef, (doc) => {
      if (doc.exists()) {
        const newFlags = doc.data() as Record<string, boolean>;
        console.log('[FeatureFlagListener] Feature flags updated:', newFlags);

        // Compare with previous flags to detect changes
        const changedFlags: string[] = [];
        
        Object.keys(newFlags).forEach(flagId => {
          if (lastFeatureFlagsRef.current[flagId] !== newFlags[flagId]) {
            changedFlags.push(flagId);
            console.log(`[FeatureFlagListener] Flag ${flagId} changed: ${lastFeatureFlagsRef.current[flagId]} -> ${newFlags[flagId]}`);
          }
        });

        // Check for removed flags
        Object.keys(lastFeatureFlagsRef.current).forEach(flagId => {
          if (!(flagId in newFlags)) {
            changedFlags.push(flagId);
            console.log(`[FeatureFlagListener] Flag ${flagId} was removed`);
          }
        });

        // Update the reference
        lastFeatureFlagsRef.current = { ...newFlags };

        // If this is the initial load, don't trigger refresh
        if (Object.keys(lastFeatureFlagsRef.current).length === 0) {
          console.log('[FeatureFlagListener] Initial feature flags load, not triggering refresh');
          return;
        }

        // If flags changed, trigger safe refresh
        if (changedFlags.length > 0) {
          console.log(`[FeatureFlagListener] ${changedFlags.length} flag(s) changed, triggering safe refresh`);
          safeRefresh(changedFlags);
        }
      } else {
        console.log('[FeatureFlagListener] Feature flags document does not exist');
      }
    }, (error) => {
      console.error('[FeatureFlagListener] Error listening to feature flags:', error);
    });

    return () => {
      console.log('[FeatureFlagListener] Cleaning up feature flag listener');
      unsubscribe();
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
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
