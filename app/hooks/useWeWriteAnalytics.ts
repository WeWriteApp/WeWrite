'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getAnalyticsService, AnalyticsEventParams } from '../utils/analytics-service';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

/**
 * Custom hook for using WeWrite analytics in components
 * 
 * This hook provides:
 * 1. Automatic page view tracking on route changes
 * 2. Methods for tracking various types of events
 * 3. Access to the underlying analytics service
 */
export const useWeWriteAnalytics = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const analytics = getAnalyticsService();
  
  // Track page views automatically when the route changes
  useEffect(() => {
    if (!pathname) return;
    
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Get a meaningful page title based on the current route
    let pageTitle = document.title;
    
    // For specific routes, we can set more descriptive titles
    if (pathname === '/') {
      pageTitle = 'WeWrite - Home';
    } else if (pathname.startsWith('/auth/login')) {
      pageTitle = 'WeWrite - Login';
    } else if (pathname.startsWith('/auth/register')) {
      pageTitle = 'WeWrite - Register';
    } else if (pathname.startsWith('/user/')) {
      // For user profile pages
      const username = document.querySelector('h1')?.textContent;
      if (username) {
        pageTitle = `WeWrite - ${username}`;
      } else {
        pageTitle = 'WeWrite - User Profile';
      }
    } else if (pathname.startsWith('/pages/')) {
      // For content pages, try to get a more specific title
      const contentTitle = document.querySelector('h1')?.textContent;
      if (contentTitle) {
        pageTitle = `WeWrite - ${contentTitle}`;
      } else {
        pageTitle = 'WeWrite - Content Page';
      }
    }
    
    // Track the page view
    analytics.trackPageView(url, pageTitle);
    
    // Track session start on first page view
    if (typeof window !== 'undefined' && !window.sessionStartTracked) {
      analytics.trackSessionEvent(ANALYTICS_EVENTS.SESSION_START, {
        page_path: url,
        page_title: pageTitle,
      });
      window.sessionStartTracked = true;
    }
  }, [pathname, searchParams, analytics]);
  
  // Helper functions for tracking different types of events
  const trackAuthEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackAuthEvent(action, params);
  };
  
  const trackContentEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackContentEvent(action, params);
  };
  
  const trackInteractionEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackInteractionEvent(action, params);
  };
  
  const trackGroupEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackGroupEvent(action, params);
  };
  
  const trackFeatureEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackFeatureEvent(action, params);
  };
  
  const trackSessionEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackSessionEvent(action, params);
  };
  
  // General event tracking
  const trackEvent = (params: AnalyticsEventParams) => {
    analytics.trackEvent(params);
  };
  
  return {
    trackEvent,
    trackAuthEvent,
    trackContentEvent,
    trackInteractionEvent,
    trackGroupEvent,
    trackFeatureEvent,
    trackSessionEvent,
    events: ANALYTICS_EVENTS,
    categories: EVENT_CATEGORIES,
  };
};

// Add session tracking type to Window interface
declare global {
  interface Window {
    sessionStartTracked?: boolean;
  }
}
