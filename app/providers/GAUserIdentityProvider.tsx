'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';

/**
 * GAUserIdentityProvider
 *
 * Sets the Google Analytics user_id and user properties based on auth state.
 * - Logged in users: Sets user_id to username (more readable than uid)
 * - Logged out users: Clears user_id, sets login_status to "logged_out"
 *
 * This allows tracking users across devices when logged in and
 * distinguishing logged-in vs logged-out behavior in GA4 reports.
 */
export function GAUserIdentityProvider() {
  const { user, isLoading } = useAuth();
  const lastIdentifiedUser = useRef<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) return;

    // Skip in development - GA is disabled there anyway
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA Identity] Development mode - skipping', {
        user: user?.username || 'logged_out'
      });
      return;
    }

    // Check if gtag is available
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (!GA_MEASUREMENT_ID) return;

    if (user?.username) {
      // User is logged in - set user_id to username for readable reports
      // Only update if user changed to avoid redundant calls
      if (lastIdentifiedUser.current !== user.username) {
        lastIdentifiedUser.current = user.username;

        // Set the user_id (shows as "User-ID" in GA4 reports)
        // Using username instead of uid for better readability
        window.gtag('config', GA_MEASUREMENT_ID, {
          user_id: user.username
        });

        // Set user properties for additional filtering
        window.gtag('set', 'user_properties', {
          login_status: 'logged_in',
          username: user.username
        });

        console.log('[GA Identity] User identified:', user.username);
      }
    } else {
      // User is logged out - clear user_id
      if (lastIdentifiedUser.current !== null) {
        lastIdentifiedUser.current = null;

        // Clear user_id by setting to undefined
        window.gtag('config', GA_MEASUREMENT_ID, {
          user_id: undefined
        });

        // Set login_status to logged_out for filtering
        window.gtag('set', 'user_properties', {
          login_status: 'logged_out',
          username: undefined
        });

        console.log('[GA Identity] User logged out - identity cleared');
      }
    }
  }, [user, isLoading]);

  // This is a logic-only component, no UI
  return null;
}
