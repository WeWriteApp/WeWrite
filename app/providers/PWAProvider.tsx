"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isPWA, shouldShowPWABanner } from "../utils/pwa-detection";
import { getAnalyticsService } from "../utils/analytics-service";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { PWAInstallTrackingService } from '../services/pwaInstallTracking';
import { useAuth } from './AuthProvider';

// Define the context type
interface PWAContextType {
  isPWA: boolean;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
  resetBannerState: () => void;
}

// Create the context with default values
const PWAContext = createContext<PWAContextType>({
  isPWA: false,
  showBanner: false,
  setShowBanner: () => {},
  resetBannerState: () => {},
});

// Hook to use the PWA context
export const usePWA = () => useContext(PWAContext);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPWAApp, setIsPWAApp] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const { user } = useAuth();

  // Initialize PWA detection on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pwaStatus = isPWA();
      setIsPWAApp(pwaStatus);

      // Only check banner visibility if not in PWA mode
      if (!pwaStatus) {
        setShowBanner(shouldShowPWABanner());
      }

      // Initialize PWA installation tracking with user context
      try {
        PWAInstallTrackingService.initialize(user?.uid, user?.username);
        console.log('PWA installation tracking initialized', user ? `for user: ${user.username}` : 'anonymously');
      } catch (error) {
        console.error('Error initializing PWA installation tracking:', error);
      }

      // Track PWA status in analytics
      try {
        const analyticsService = getAnalyticsService();
        analyticsService.trackEvent({
          category: EVENT_CATEGORIES.APP,
          action: ANALYTICS_EVENTS.PWA_STATUS,
          label: pwaStatus ? 'PWA' : 'Browser',
          value: pwaStatus ? 1 : 0,
        });

        if (process.env.NODE_ENV === 'development') {
          console.log(`PWA status tracked: ${pwaStatus ? 'PWA' : 'Browser'}`);
        }
      } catch (error) {
        console.error('Error tracking PWA status:', error);
      }

      // Listen for display mode changes
      const mediaQuery = window.matchMedia('(display-mode: standalone)');

      const handleChange = (e: MediaQueryListEvent) => {
        const newPWAStatus = e.matches;
        setIsPWAApp(newPWAStatus);

        // Track change in analytics
        try {
          const analyticsService = getAnalyticsService();
          analyticsService.trackEvent({
            category: EVENT_CATEGORIES.APP,
            action: ANALYTICS_EVENTS.PWA_STATUS_CHANGED,
            label: newPWAStatus ? 'PWA' : 'Browser',
            value: newPWAStatus ? 1 : 0,
          });
        } catch (error) {
          console.error('Error tracking PWA status change:', error);
        }
      };

      // Add event listener for display mode changes
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange);
      }

      // Cleanup
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleChange);
        } else {
          // Fallback for older browsers
          mediaQuery.removeListener(handleChange);
        }
      };
    }
  }, []);

  // Reinitialize PWA tracking when user changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Reinitialize with updated user context
        PWAInstallTrackingService.initialize(user?.uid, user?.username);
        console.log('PWA tracking updated for user context:', user ? user.username : 'anonymous');
      } catch (error) {
        console.error('Error updating PWA tracking user context:', error);
      }
    }
  }, [user?.uid, user?.username]);

  // Function to reset banner state for testing
  const resetBannerState = () => {
    if (typeof window !== 'undefined') {
      // Get the device-specific storage keys
      const deviceId = window.navigator.userAgent.replace(/\D+/g, '');
      localStorage.removeItem(`device_${deviceId}_pwa_banner_dismissed`);
      localStorage.removeItem(`device_${deviceId}_pwa_banner_dismissed_timestamp`);
      localStorage.removeItem(`device_${deviceId}_pwa_dont_remind`);
      setShowBanner(true);

      // Track reset in analytics
      try {
        const analyticsService = getAnalyticsService();
        analyticsService.trackEvent({
          category: EVENT_CATEGORIES.ADMIN,
          action: ANALYTICS_EVENTS.PWA_BANNER_RESET,
          label: 'Admin Action',
        });
      } catch (error) {
        console.error('Error tracking PWA banner reset:', error);
      }
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isPWA: isPWAApp,
        showBanner,
        setShowBanner,
        resetBannerState,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};

export default PWAProvider;
