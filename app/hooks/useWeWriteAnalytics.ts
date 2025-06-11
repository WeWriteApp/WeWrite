'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getAnalyticsService, AnalyticsEventParams } from "../utils/analytics-service";
import { ANALYTICS_EVENTS, EVENT_CATEGORIES, CONTENT_EVENTS, INTERACTION_EVENTS, NAVIGATION_EVENTS, FEATURE_EVENTS } from '../constants/analytics-events';
import { getAnalyticsPageTitle } from "../utils/analytics-page-titles";

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

    // Get a standardized page title for analytics
    const pageTitle = getAnalyticsPageTitle(pathname, searchParams, document.title);

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

  const trackNavigationEvent = (action: string, params: Partial<AnalyticsEventParams> = {}) => {
    analytics.trackNavigationEvent(action, params);
  };

  // General event tracking
  const trackEvent = (params: AnalyticsEventParams) => {
    analytics.trackEvent(params);
  };

  // Specialized tracking functions for common patterns
  const trackPageCreationFlow = {
    started: (params: Partial<AnalyticsEventParams> = {}) => {
      trackContentEvent(CONTENT_EVENTS.PAGE_CREATION_STARTED, params);
    },
    saved: (method: 'keyboard' | 'button', params: Partial<AnalyticsEventParams> = {}) => {
      const event = method === 'keyboard' ? CONTENT_EVENTS.PAGE_SAVE_KEYBOARD : CONTENT_EVENTS.PAGE_SAVE_BUTTON;
      trackContentEvent(event, { save_method: method, ...params });
    },
    completed: (pageId: string, params: Partial<AnalyticsEventParams> = {}) => {
      trackContentEvent(CONTENT_EVENTS.PAGE_CREATED, { page_id: pageId, ...params });
    },
    abandoned: (params: Partial<AnalyticsEventParams> = {}) => {
      trackContentEvent(CONTENT_EVENTS.PAGE_CREATION_ABANDONED, params);
    }
  };

  const trackEditingFlow = {
    started: (pageId: string, params: Partial<AnalyticsEventParams> = {}) => {
      trackContentEvent(CONTENT_EVENTS.PAGE_EDIT_STARTED, { page_id: pageId, ...params });
    },
    saved: (pageId: string, method: 'keyboard' | 'button', params: Partial<AnalyticsEventParams> = {}) => {
      const event = method === 'keyboard' ? CONTENT_EVENTS.PAGE_SAVE_KEYBOARD : CONTENT_EVENTS.PAGE_SAVE_BUTTON;
      trackContentEvent(event, { page_id: pageId, save_method: method, ...params });
    },
    cancelled: (pageId: string, params: Partial<AnalyticsEventParams> = {}) => {
      trackContentEvent(CONTENT_EVENTS.PAGE_EDIT_CANCELLED, { page_id: pageId, ...params });
    }
  };

  const trackSortingInteraction = (sortType: string, direction: string, location: string, params: Partial<AnalyticsEventParams> = {}) => {
    trackInteractionEvent(INTERACTION_EVENTS.SORT_CHANGED, {
      sort_type: sortType,
      sort_direction: direction,
      location: location,
      ...params
    });
  };

  const trackNotificationInteraction = (action: 'read' | 'unread' | 'menu_opened', notificationId?: string, params: Partial<AnalyticsEventParams> = {}) => {
    const eventMap = {
      read: INTERACTION_EVENTS.NOTIFICATION_MARKED_READ,
      unread: INTERACTION_EVENTS.NOTIFICATION_MARKED_UNREAD,
      menu_opened: INTERACTION_EVENTS.NOTIFICATION_MENU_OPENED
    };

    trackInteractionEvent(eventMap[action], {
      notification_id: notificationId,
      ...params
    });
  };

  return {
    trackEvent,
    trackAuthEvent,
    trackContentEvent,
    trackInteractionEvent,
    trackNavigationEvent,
    trackGroupEvent,
    trackFeatureEvent,
    trackSessionEvent,
    // Specialized tracking functions
    trackPageCreationFlow,
    trackEditingFlow,
    trackSortingInteraction,
    trackNotificationInteraction,
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
