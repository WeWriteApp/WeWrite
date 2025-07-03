"use client";

import { useState, useEffect, useCallback } from 'react';

interface UpdateDetectionConfig {
  checkInterval?: number; // in milliseconds
  buildId?: string; // current build ID
  enabled?: boolean;
}

interface UpdateDetectionResult {
  isUpdateAvailable: boolean;
  checkForUpdates: () => Promise<void>;
  dismissUpdate: () => void;
  lastChecked: Date | null;
}

/**
 * useUpdateDetection Hook
 * 
 * Detects when a new version of the app is available by checking
 * for changes in the build ID or other version indicators.
 */
export function useUpdateDetection({
  checkInterval = 5 * 60 * 1000, // 5 minutes
  buildId,
  enabled = true
}: UpdateDetectionConfig = {}): UpdateDetectionResult {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(buildId || null);

  // Get the current build ID from the page or meta tags
  const getCurrentBuildId = useCallback(async (): Promise<string | null> => {
    try {
      // Method 1: Check for build ID in meta tags
      const metaBuildId = document.querySelector('meta[name="build-id"]')?.getAttribute('content');
      if (metaBuildId) {
        return metaBuildId;
      }

      // Method 2: Check for version in package.json or version endpoint
      const response = await fetch('/api/version', { 
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.buildId || data.version || data.timestamp;
      }

      // Method 3: Check for changes in the main JS bundle
      const htmlResponse = await fetch(window.location.href, { 
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        // Look for Next.js build ID in script tags
        const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
        if (buildIdMatch) {
          return buildIdMatch[1];
        }

        // Look for version in script src attributes
        const scriptMatch = html.match(/\/_next\/static\/([^\/]+)\//);
        if (scriptMatch) {
          return scriptMatch[1];
        }
      }

      // Fallback: use current timestamp as version indicator
      return Date.now().toString();
    } catch (error) {
      console.error('Error getting build ID:', error);
      return null;
    }
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!enabled) return;

    try {
      const newBuildId = await getCurrentBuildId();
      setLastChecked(new Date());

      if (newBuildId && currentBuildId && newBuildId !== currentBuildId) {
        console.log('Update detected:', { current: currentBuildId, new: newBuildId });
        setIsUpdateAvailable(true);
      } else if (!currentBuildId && newBuildId) {
        // First time setting build ID
        setCurrentBuildId(newBuildId);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }, [enabled, currentBuildId, getCurrentBuildId]);

  // Dismiss the update notification
  const dismissUpdate = useCallback(() => {
    setIsUpdateAvailable(false);
    // Store dismissal time to avoid showing again too soon
    localStorage.setItem('updateDismissedAt', Date.now().toString());
  }, []);

  // Set up periodic checking
  useEffect(() => {
    if (!enabled) return;

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkForUpdates, 2000);

    // Set up interval for periodic checks
    const interval = setInterval(checkForUpdates, checkInterval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [enabled, checkInterval, checkForUpdates]);

  // Check if user recently dismissed an update
  useEffect(() => {
    const dismissedAt = localStorage.getItem('updateDismissedAt');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      // Don't show update notification if dismissed within the last hour
      if (now - dismissedTime < oneHour) {
        setIsUpdateAvailable(false);
      }
    }
  }, []);

  // Listen for focus events to check for updates when user returns
  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      // Check for updates when user returns to the tab
      setTimeout(checkForUpdates, 1000);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(checkForUpdates, 1000);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, checkForUpdates]);

  return {
    isUpdateAvailable,
    checkForUpdates,
    dismissUpdate,
    lastChecked
  };
}
