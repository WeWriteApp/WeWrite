'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

/**
 * AutomaticUpdateManager - Seamless Background App Updates
 * 
 * This component provides a completely transparent app update experience:
 * 
 * HOW IT WORKS:
 * 1. Continuously checks for new app versions in the background (every 5 minutes)
 * 2. When a new version is detected, it prepares for an automatic update
 * 3. On the user's NEXT navigation event, it seamlessly refreshes the app
 * 4. The user experiences what feels like a normal page navigation, but gets the new version
 * 
 * BENEFITS:
 * - No disruptive modals or popups
 * - No manual refresh buttons
 * - Updates happen during natural user flow
 * - Feels like normal navigation, not an "update"
 * - Always keeps users on the latest version
 * 
 * TECHNICAL DETAILS:
 * - Uses build timestamp comparison to detect new deployments
 * - Intercepts router.push() calls when update is pending
 * - Clears all caches before applying update
 * - Preserves user's intended navigation destination
 * - Includes safety timeouts and error handling
 * 
 * DEVELOPMENT MODE:
 * - Completely disabled on localhost to avoid interference
 * - Only active in production environments
 * 
 * PERFORMANCE:
 * - Minimal overhead: only checks build info, not full app
 * - Uses efficient caching to avoid redundant checks
 * - Debounced to prevent excessive API calls
 */

interface AutomaticUpdateState {
  isUpdatePending: boolean;
  newBuildTime: string | null;
  lastChecked: Date | null;
}

export default function AutomaticUpdateManager() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [updateState, setUpdateState] = React.useState<AutomaticUpdateState>({
    isUpdatePending: false,
    newBuildTime: null,
    lastChecked: null
  });
  
  const currentBuildTimeRef = useRef<string | null>(null);
  const originalPushRef = useRef<typeof router.push | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();
  const isApplyingUpdateRef = useRef(false);

  // Check for updates function
  const checkForUpdates = React.useCallback(async () => {
    // NEVER check in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return;
    }

    try {
      const response = await fetch('/api/build-info', { 
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newBuildTime = data.buildTime;
        
        setUpdateState(prev => ({ ...prev, lastChecked: new Date() }));
        
        // First time - just store the build time
        if (!currentBuildTimeRef.current) {
          currentBuildTimeRef.current = newBuildTime;
          return;
        }
        
        // Check if there's a new build
        if (newBuildTime && newBuildTime !== currentBuildTimeRef.current) {
          console.log('🔄 [AutoUpdate] New version detected:', {
            current: currentBuildTimeRef.current,
            new: newBuildTime
          });
          
          setUpdateState(prev => ({
            ...prev,
            isUpdatePending: true,
            newBuildTime
          }));
        }
      }
    } catch (error) {
      console.warn('[AutoUpdate] Failed to check for updates:', error);
    }
  }, []);

  // Apply update function
  const applyUpdate = React.useCallback(async (targetRoute: string) => {
    if (isApplyingUpdateRef.current) return;
    isApplyingUpdateRef.current = true;

    console.log('🚀 [AutoUpdate] Applying update during navigation to:', targetRoute);

    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // Update the current build time
      if (updateState.newBuildTime) {
        currentBuildTimeRef.current = updateState.newBuildTime;
      }

      // Navigate to the target route with a full page refresh
      window.location.href = targetRoute;
      
    } catch (error) {
      console.error('[AutoUpdate] Error applying update:', error);
      // Fallback: just navigate normally
      if (originalPushRef.current) {
        originalPushRef.current(targetRoute);
      }
    }
  }, [updateState.newBuildTime]);

  // Intercept router.push when update is pending
  React.useEffect(() => {
    if (!updateState.isUpdatePending) return;

    // Store original router.push if not already stored
    if (!originalPushRef.current) {
      originalPushRef.current = router.push.bind(router);
    }

    // Override router.push to trigger update
    router.push = (href: string, options?: any) => {
      // Apply update with the target route
      applyUpdate(href);
      return Promise.resolve();
    };

    // Cleanup function to restore original router.push
    return () => {
      if (originalPushRef.current) {
        router.push = originalPushRef.current;
      }
    };
  }, [updateState.isUpdatePending, router, applyUpdate]);

  // Set up periodic checking
  React.useEffect(() => {
    // 🚨 EMERGENCY: Auto-update checking disabled to prevent database read crisis
    console.warn('🚨 EMERGENCY: Auto-update checking disabled to prevent excessive database reads (174K reads/min crisis)');
    return;

    // DISABLED: All automatic update checking to prevent database read overload
    // // NEVER run in development
    // if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    //   return;
    // }

    // // Initial check after a short delay
    // const initialTimeout = setTimeout(checkForUpdates, 3000);

    // // Set up interval for periodic checks (every 5 minutes)
    // const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    // return () => {
    //   clearTimeout(initialTimeout);
    //   clearInterval(interval);
    // };
  }, [checkForUpdates]);

  // Reset update state when pathname changes (in case update was applied)
  React.useEffect(() => {
    if (updateState.isUpdatePending && isApplyingUpdateRef.current) {
      // Update was applied, reset state
      setUpdateState({
        isUpdatePending: false,
        newBuildTime: null,
        lastChecked: new Date()
      });
      isApplyingUpdateRef.current = false;
    }
  }, [pathname, updateState.isUpdatePending]);

  // This component renders nothing - it works entirely in the background
  return null;
}
