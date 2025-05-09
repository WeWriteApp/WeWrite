"use client";

/**
 * Analytics User Tracking
 * 
 * This utility enhances Google Analytics tracking by adding username information
 * to user-related events and page views. This allows for better user identification
 * in analytics reports.
 */

/**
 * Set user information in Google Analytics
 * This should be called when a user logs in or when their profile information changes
 * 
 * @param {Object} user - The user object containing uid, username, etc.
 */
export const setAnalyticsUserInfo = (user) => {
  if (!user || typeof window === 'undefined' || !window.gtag) return;

  try {
    // Set user ID for cross-device tracking
    window.gtag('set', {
      'user_id': user.uid
    });

    // Set user properties for better segmentation
    window.gtag('set', 'user_properties', {
      username: user.username || 'Anonymous',
      user_id: user.uid,
      email_domain: user.email ? user.email.split('@')[1] : null,
      has_username: !!user.username
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics user info set:', {
        user_id: user.uid,
        username: user.username || 'Anonymous'
      });
    }
  } catch (error) {
    console.error('Error setting analytics user info:', error);
  }
};

/**
 * Track a user-related event with enhanced user information
 * 
 * @param {string} eventName - The name of the event to track
 * @param {Object} user - The user object
 * @param {Object} additionalParams - Additional parameters to include with the event
 */
export const trackUserEvent = (eventName, user, additionalParams = {}) => {
  if (!eventName || !user || typeof window === 'undefined' || !window.gtag) return;

  try {
    // Ensure we have the username in the event parameters
    const eventParams = {
      ...additionalParams,
      username: user.username || 'Anonymous',
      user_id: user.uid
    };

    // Track the event
    window.gtag('event', eventName, eventParams);

    if (process.env.NODE_ENV === 'development') {
      console.log(`User event tracked: ${eventName}`, eventParams);
    }
  } catch (error) {
    console.error(`Error tracking user event ${eventName}:`, error);
  }
};

/**
 * Track a page view with enhanced user information
 * 
 * @param {string} pagePath - The path of the page being viewed
 * @param {string} pageTitle - The title of the page
 * @param {Object} user - The user object
 */
export const trackPageViewWithUser = (pagePath, pageTitle, user) => {
  if (!pagePath || !user || typeof window === 'undefined' || !window.gtag) return;

  try {
    // Track the page view with user information
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      page_path: pagePath,
      page_title: pageTitle || document.title,
      page_location: window.location.href,
      username: user.username || 'Anonymous',
      user_id: user.uid
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Page view tracked with user info:', {
        page_path: pagePath,
        page_title: pageTitle || document.title,
        username: user.username || 'Anonymous'
      });
    }
  } catch (error) {
    console.error('Error tracking page view with user info:', error);
  }
};
