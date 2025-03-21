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
    console.warn('Google Analytics not initialized for page view tracking');
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
    console.warn('Google Analytics not initialized for event tracking');
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
      console.log('GA event sent:', { category, action, label, value });
    }
  } catch (error) {
    console.error('Error sending GA event:', error);
  }
};

/**
 * Initialize Google Analytics manually if needed
 * This is a backup in case the automatic initialization in GAProvider fails
 */
export const initializeGA = () => {
  if (typeof window === 'undefined') return;
  
  const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  
  if (!GA_TRACKING_ID) {
    console.warn('Missing Google Analytics Measurement ID in .env.local');
    return;
  }
  
  if (window.GA_INITIALIZED) {
    console.log('Google Analytics already initialized');
    return;
  }
  
  try {
    console.log('Manually initializing Google Analytics with ID:', GA_TRACKING_ID);
    
    ReactGA.initialize(GA_TRACKING_ID, {
      gaOptions: {
        debug_mode: process.env.NODE_ENV === 'development'
      },
      testMode: process.env.NODE_ENV !== 'production'
    });
    
    window.GA_INITIALIZED = true;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Analytics manually initialized successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Error manually initializing Google Analytics:', error);
    return false;
  }
};
