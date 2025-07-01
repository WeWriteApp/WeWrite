"use client";

import ReactGA from 'react-ga4';

// Extend Window interface to include GA_INITIALIZED
declare global {
  interface Window {
    GA_INITIALIZED?: boolean;
  }
}

/**
 * Utility functions for Google Analytics
 */

/**
 * Track a page view
 */
export const trackPageView = (path: string, title?: string): void => {
  if (typeof window === 'undefined' || !window.GA_INITIALIZED) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Google Analytics not initialized for page view tracking');
    }
    return;
  }

  // Skip ReactGA calls in development to prevent authentication errors
  if (process.env.NODE_ENV === 'development') {
    console.log('ReactGA pageview skipped in development:', { path, title });
    return;
  }

  try {
    ReactGA.send({
      hitType: "pageview",
      page: path,
      title: title || document.title || path
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Manual GA pageview sent:', { path, title });
    }
  } catch (error) {
    console.error('Error sending manual GA pageview (non-fatal):', error);
  }
};

interface TrackEventParams {
  /** Event category */
  category: string;
  /** Event action */
  action: string;
  /** Event label (optional) */
  label?: string;
  /** Event value (optional) */
  value?: number;
  /** Whether this is a non-interaction event (optional) */
  nonInteraction?: boolean;
}

/**
 * Track an event
 */
export const trackEvent = ({ category, action, label, value, nonInteraction = false }: TrackEventParams): void => {
  if (typeof window === 'undefined' || !window.GA_INITIALIZED) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Google Analytics not initialized for event tracking');
    }
    return;
  }

  // Skip ReactGA calls in development to prevent authentication errors
  if (process.env.NODE_ENV === 'development') {
    console.log('ReactGA event skipped in development:', { category, action, label, value });
    return;
  }

  try {
    ReactGA.event({
      category,
      action,
      label,
      value,
      nonInteraction
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('GA event tracked:', { category, action, label, value });
    }
  } catch (error) {
    console.error('Error tracking GA event (non-fatal):', error);
  }
};

/**
 * Initialize Google Analytics
 */
export const initializeGA = (): boolean => {
  try {
    const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    if (!GA_TRACKING_ID) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Missing Google Analytics Measurement ID');
      }
      return false;
    }

    if (window.GA_INITIALIZED) {
      return true;
    }

    // In development, disable ReactGA to prevent authentication errors
    if (process.env.NODE_ENV === 'development') {
      console.log('ReactGA disabled in development to prevent authentication errors');
      window.GA_INITIALIZED = true;
      return true;
    }

    ReactGA.initialize(GA_TRACKING_ID, {
      gaOptions: {
        debug_mode: false // Disable debug mode to prevent API calls
      },
      testMode: false // Disable test mode to prevent authentication issues
    });

    window.GA_INITIALIZED = true;

    if (process.env.NODE_ENV === 'development') {
      console.log('Google Analytics initialized successfully');
    }

    return true;
  } catch (error) {
    console.error('Error initializing Google Analytics (non-fatal):', error);
    // Mark as initialized even if there's an error to prevent repeated attempts
    window.GA_INITIALIZED = true;
    return false;
  }
};