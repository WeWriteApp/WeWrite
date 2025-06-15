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
    console.error('Error sending manual GA pageview:', error);
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
    console.error('Error tracking GA event:', error);
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
    
    ReactGA.initialize(GA_TRACKING_ID, {
      gaOptions: {
        debug_mode: process.env.NODE_ENV === 'development'
      },
      testMode: process.env.NODE_ENV !== 'production'
    });
    
    window.GA_INITIALIZED = true;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Analytics initialized successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing Google Analytics:', error);
    return false;
  }
};
