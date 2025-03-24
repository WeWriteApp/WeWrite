"use client";

import ReactGA from 'react-ga4';

/**
 * Utility functions for Google Analytics
 */

/**
 * Track a page view
 * @param {string} path - The path to track
 * @param {string} title - The page title
 */
export const trackPageView = (path, title) => {
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

/**
 * Track an event
 * @param {Object} params - Event parameters
 * @param {string} params.category - Event category
 * @param {string} params.action - Event action
 * @param {string} params.label - Event label (optional)
 * @param {number} params.value - Event value (optional)
 * @param {Object} params.nonInteraction - Whether this is a non-interaction event (optional)
 */
export const trackEvent = ({ category, action, label, value, nonInteraction = false }) => {
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
 * @returns {boolean} - Whether initialization was successful
 */
export const initializeGA = () => {
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
