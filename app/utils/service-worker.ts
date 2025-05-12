/**
 * Service Worker Utility
 *
 * This utility provides functions to register and manage the service worker
 */

import { getAnalyticsService } from './analytics-service';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

// Register the service worker
export const registerServiceWorker = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Track service worker registration in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.APP,
        action: ANALYTICS_EVENTS.SERVICE_WORKER_REGISTERED,
        label: 'Success',
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Service Worker registered successfully:', registration);
      }
    } catch (error) {
      console.error('Error tracking service worker registration:', error);
    }

    return true;
  } catch (error) {
    console.error('Service Worker registration failed:', error);

    // Track service worker registration failure in analytics
    try {
      const analyticsService = getAnalyticsService();
      analyticsService.trackEvent({
        category: EVENT_CATEGORIES.APP,
        action: ANALYTICS_EVENTS.SERVICE_WORKER_REGISTERED,
        label: 'Failed',
      });
    } catch (analyticsError) {
      console.error('Error tracking service worker registration failure:', analyticsError);
    }

    return false;
  }
};

// Unregister the service worker
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration) {
      await registration.unregister();
      
      // Track service worker unregistration in analytics
      try {
        const analyticsService = getAnalyticsService();
        analyticsService.trackEvent({
          category: EVENT_CATEGORIES.APP,
          action: ANALYTICS_EVENTS.SERVICE_WORKER_UNREGISTERED,
          label: 'Success',
        });
      } catch (error) {
        console.error('Error tracking service worker unregistration:', error);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
};

// Check if service worker is registered
export const isServiceWorkerRegistered = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return !!registration;
  } catch (error) {
    console.error('Error checking service worker registration:', error);
    return false;
  }
};
