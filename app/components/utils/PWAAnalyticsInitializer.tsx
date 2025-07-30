'use client';

import { useEffect } from 'react';
import { initializePWAAnalytics } from '../../utils/pwaAnalytics';

/**
 * PWA Analytics Initializer Component
 * 
 * Initializes PWA detection and analytics tracking when the app loads.
 * This component should be included once in the app layout to ensure
 * PWA analytics are properly tracked for the admin dashboard.
 */
export default function PWAAnalyticsInitializer() {
  useEffect(() => {
    // Initialize PWA analytics on client side only
    if (typeof window !== 'undefined') {
      // Small delay to ensure all other initialization is complete
      const timer = setTimeout(() => {
        initializePWAAnalytics();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  // This component renders nothing - it's just for initialization
  return null;
}
