"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAnalyticsService } from '../utils/analytics-service';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { checkNotificationSupport, getBrowserInfo } from '../utils/browser-compatibility';

// Define the context type
interface NotificationPermissionContextType {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, options?: NotificationOptions) => Promise<boolean>;
}

// Create the context with default values
const NotificationPermissionContext = createContext<NotificationPermissionContextType>({
  permission: 'default',
  isSupported: false,
  requestPermission: async () => 'default',
  showNotification: async () => false,
});

// Storage key for notification permission preference
const STORAGE_KEY = 'notification_permission_requested';

// Hook to use the notification permission context
export const useNotificationPermission = () => useContext(NotificationPermissionContext);

export const NotificationPermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState<boolean>(false);

  // Initialize notification permission status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check browser compatibility for notifications
      const { isSupported: supported, details } = checkNotificationSupport();
      const browserInfo = getBrowserInfo();

      console.log('Browser notification support:', {
        supported,
        details,
        browser: browserInfo,
        userAgent: navigator.userAgent
      });

      setIsSupported(supported);

      if (supported) {
        // Get current permission status
        setPermission(Notification.permission);
        console.log(`Current notification permission: ${Notification.permission}`);

        // Check if service worker is registered
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration()
            .then(registration => {
              console.log('Service worker registration status:', registration ? 'registered' : 'not registered');
            })
            .catch(error => {
              console.error('Error checking service worker registration:', error);
            });
        }

        // Track notification permission status in analytics
        try {
          const analyticsService = getAnalyticsService();
          analyticsService.trackEvent({
            category: EVENT_CATEGORIES.APP,
            action: ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_STATUS,
            label: Notification.permission,
          });

          if (process.env.NODE_ENV === 'development') {
            console.log(`Notification permission status tracked: ${Notification.permission}`);
          }
        } catch (error) {
          console.error('Error tracking notification permission status:', error);
        }
      } else {
        // Log detailed information about why notifications aren't supported
        console.warn('Notifications not supported in this browser:', details);

        // Track browser compatibility issues in analytics
        try {
          const analyticsService = getAnalyticsService();
          analyticsService.trackEvent({
            category: EVENT_CATEGORIES.APP,
            action: ANALYTICS_EVENTS.NOTIFICATION_COMPATIBILITY_ISSUE,
            label: JSON.stringify({
              browser: browserInfo,
              details
            }),
          });
        } catch (error) {
          console.error('Error tracking notification compatibility issue:', error);
        }
      }
    }
  }, []);

  // Request notification permission
  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      console.warn('Notifications are not supported in this browser');
      return 'denied';
    }

    try {
      console.log('Requesting notification permission...');

      // Check if the browser requires a user gesture to request permission
      if (typeof Notification.requestPermission === 'function') {
        // Modern browsers - Promise-based API
        console.log('Using Promise-based Notification API');
        const result = await Notification.requestPermission();
        console.log(`Permission request result: ${result}`);
        setPermission(result);

        // Store that we've requested permission
        try {
          localStorage.setItem(STORAGE_KEY, 'true');
        } catch (storageError) {
          console.error('Error storing permission state in localStorage:', storageError);
        }

        // Track permission request result in analytics
        try {
          const analyticsService = getAnalyticsService();
          analyticsService.trackEvent({
            category: EVENT_CATEGORIES.APP,
            action: ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_REQUESTED,
            label: result,
          });
        } catch (analyticsError) {
          console.error('Error tracking notification permission request:', analyticsError);
        }

        return result;
      } else {
        // Legacy callback-based API (very old browsers)
        console.log('Using legacy callback-based Notification API');
        return new Promise((resolve) => {
          Notification.requestPermission((result) => {
            console.log(`Permission request result (legacy): ${result}`);
            setPermission(result);

            try {
              localStorage.setItem(STORAGE_KEY, 'true');
            } catch (storageError) {
              console.error('Error storing permission state in localStorage:', storageError);
            }

            resolve(result);
          });
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));

      // Try to provide more specific error information
      if (error instanceof Error) {
        if (error.name === 'SecurityError') {
          console.error('SecurityError: The request is insecure or the user has blocked permissions');
        } else if (error.name === 'TypeError') {
          console.error('TypeError: The Notification API may be disabled or restricted');
        }
      }

      return 'denied';
    }
  };

  // Show a notification
  const showNotification = async (title: string, options?: NotificationOptions): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Cannot show notification: Notifications are not supported in this browser');
      return false;
    }

    if (permission !== 'granted') {
      console.warn(`Cannot show notification: Permission is ${permission}, not granted`);
      return false;
    }

    try {
      console.log('Showing notification:', { title, options });

      // Check if service worker is registered and active
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('Using service worker to show notification');
        try {
          // Try to show notification via service worker
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/favicon-32x32.png',
            ...options,
          });
          console.log('Notification shown via service worker');
        } catch (swError) {
          console.error('Error showing notification via service worker:', swError);
          console.log('Falling back to regular Notification API');

          // Fallback to regular Notification API
          const notification = new Notification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/favicon-32x32.png',
            ...options,
          });
          console.log('Notification shown via regular API');
        }
      } else {
        // Use regular Notification API
        console.log('Using regular Notification API (no service worker)');
        const notification = new Notification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/favicon-32x32.png',
          ...options,
        });
        console.log('Notification shown via regular API');
      }

      // Track notification shown in analytics
      try {
        const analyticsService = getAnalyticsService();
        analyticsService.trackEvent({
          category: EVENT_CATEGORIES.APP,
          action: ANALYTICS_EVENTS.NOTIFICATION_SHOWN,
          label: title,
        });
      } catch (analyticsError) {
        console.error('Error tracking notification shown:', analyticsError);
      }

      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));

      // Try to provide more specific error information
      if (error instanceof Error) {
        if (error.name === 'SecurityError') {
          console.error('SecurityError: The notification cannot be shown due to security restrictions');
        } else if (error.name === 'TypeError') {
          console.error('TypeError: The Notification API may be disabled or restricted');
        }
      }

      return false;
    }
  };

  return (
    <NotificationPermissionContext.Provider
      value={{
        permission,
        isSupported,
        requestPermission,
        showNotification,
      }}
    >
      {children}
    </NotificationPermissionContext.Provider>
  );
};

export default NotificationPermissionProvider;
