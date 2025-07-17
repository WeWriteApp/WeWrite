"use client";

/**
 * Analytics User Tracking
 *
 * This utility enhances Google Analytics tracking by adding username information
 * to user-related events and page views. This allows for better user identification
 * in analytics reports.
 */

// Type definitions
interface UserSession {
  uid: string;
  username?: string;
  email?: string;
}

interface EventParams {
  [key: string]: any;
  username?: string;
  user_id?: string;
}

interface UserProperties {
  username: string;
  user_id: string;
  email_domain: string | null;
  has_username: boolean;
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'set' | 'event',
      targetIdOrParams: string | object,
      params?: object
    ) => void;
  }
}

/**
 * Set user information in Google Analytics
 * This should be called when a user logs in or when their profile information changes
 */
export const setAnalyticsUserInfo = (session: UserSession | null): void => {
  if (!session || typeof window === 'undefined') return;

  // Skip gtag calls in development to prevent authentication errors
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics user info skipped in development:', session.username || 'Anonymous');
    return;
  }

  if (!window.gtag) {
    console.warn('gtag not available for user tracking');
    return;
  }

  try {
    // Set user ID for cross-device tracking
    window.gtag('set', {
      'user_id': session.uid
    });

    // Set user properties for better segmentation
    const userProperties: UserProperties = {
      username: session.username || 'Anonymous',
      user_id: session.uid,
      email_domain: session.email ? session.email.split('@')[1] : null,
      has_username: !!session.username
    };

    window.gtag('set', 'user_properties', userProperties);

  } catch (error) {
    console.error('Error setting analytics user info (non-fatal):', error);
  }
};

/**
 * Track a user-related event with enhanced user information
 */
export const trackUserEvent = (
  eventName: string,
  session: UserSession | null,
  additionalParams: EventParams = {}
): void => {
  if (!eventName || !session || typeof window === 'undefined' || !window.gtag) return;

  try {
    // Ensure we have the username in the event parameters
    const eventParams: EventParams = {
      ...additionalParams,
      username: session.username || 'Anonymous',
      user_id: session.uid
    };

    // Track the event
    window.gtag('event', eventName, eventParams);

  } catch (error) {
    console.error(`Error tracking user event ${eventName}:`, error);
  }
};

/**
 * Track a page view with enhanced user information
 */
export const trackPageViewWithUser = (
  pagePath: string,
  pageTitle: string | null,
  session: UserSession | null
): void => {
  if (!pagePath || !session || typeof window === 'undefined' || !window.gtag) return;

  try {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (!measurementId) {
      console.warn('GA_MEASUREMENT_ID not configured');
      return;
    }

    // Track the page view with user information
    window.gtag('config', measurementId, {
      page_path: pagePath,
      page_title: pageTitle || document.title,
      page_location: window.location.href,
      username: session.username || 'Anonymous',
      user_id: session.uid
    });

  } catch (error) {
    console.error('Error tracking page view with user info:', error);
  }
};