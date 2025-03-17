'use client';

import { initializeAnalytics } from '../firebase/config';
import { getAnalytics, logEvent as firebaseLogEvent } from 'firebase/analytics';

// Add TypeScript declaration for gtag
declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: Record<string, any>
    ) => void;
  }
}

/**
 * Analytics Integration Module
 * 
 * This module provides a unified interface for tracking analytics events across
 * multiple providers (Google Analytics and Firebase Analytics). It handles:
 * 
 * 1. Initialization of analytics providers
 * 2. Page view tracking with page titles (important for data science team)
 * 3. Custom event tracking with standardized parameters
 * 4. Error handling and fallbacks if one provider fails
 * 
 * IMPORTANT: Page titles are included in all page view events to make data
 * analysis easier since our URLs use UUIDs which aren't human-readable.
 */

// Interfaces
interface TrackingEvent {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  page_title?: string; // Important for data science team
  page_uuid?: string;  // Original UUID from URL for reference
  [key: string]: any;
}

// Singleton instance of the analytics service
let analyticsInstance: Analytics | null = null;

class Analytics {
  private firebaseAnalytics: any | null = null;
  private gaAvailable: boolean = false;
  private fbAvailable: boolean = false;
  private debug: boolean = process.env.NODE_ENV === 'development';
  private gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  private fbMeasurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  constructor() {
    if (typeof window === 'undefined') return;
    
    this.setupAnalytics();
  }

  /**
   * Initialize analytics providers
   * This sets up both Google Analytics and Firebase Analytics if available
   */
  private async setupAnalytics() {
    if (this.debug) console.log('Setting up analytics...');
    
    // Setup Google Analytics
    this.gaAvailable = !!this.gaId && typeof window !== 'undefined' && 'gtag' in window;
    if (this.debug) console.log('Google Analytics available:', this.gaAvailable);
    
    // Setup Firebase Analytics
    try {
      this.firebaseAnalytics = await initializeAnalytics();
      this.fbAvailable = !!this.firebaseAnalytics;
      if (this.debug) console.log('Firebase Analytics available:', this.fbAvailable);
    } catch (error) {
      if (this.debug) console.error('Error initializing Firebase Analytics:', error);
      this.fbAvailable = false;
    }
    
    if (this.debug) {
      console.log('Analytics setup complete.');
      console.log('- Google Analytics:', this.gaAvailable ? 'Ready' : 'Not available');
      console.log('- Firebase Analytics:', this.fbAvailable ? 'Ready' : 'Not available');
    }
  }

  /**
   * Track page view with title
   * 
   * @param url - The URL of the page being viewed
   * @param title - The title of the page (important for data science team)
   * @param pageId - Optional UUID of the page (from URL) for reference
   */
  public pageView(url: string, title?: string, pageId?: string) {
    if (this.debug) console.log(`Tracking pageview: ${url}${title ? ` (${title})` : ''}`);
    
    // Extract page data for analytics
    const pageData = {
      page_path: url,
      page_title: title || this.getPageTitleFromDOM(), // Fallback to DOM title if not provided
      page_uuid: pageId || this.extractPageIdFromUrl(url),
      timestamp: new Date().toISOString()
    };
    
    // Track in Google Analytics
    if (this.gaAvailable && window.gtag && this.gaId) {
      try {
        window.gtag('config', this.gaId, pageData);
        if (this.debug) console.log('Google Analytics pageview tracked with title:', pageData.page_title);
      } catch (e) {
        if (this.debug) console.error('Error tracking Google Analytics pageview:', e);
      }
    }
    
    // Track in Firebase Analytics
    if (this.fbAvailable && this.firebaseAnalytics) {
      try {
        firebaseLogEvent(this.firebaseAnalytics, 'page_view', pageData);
        if (this.debug) console.log('Firebase Analytics pageview tracked with title:', pageData.page_title);
      } catch (e) {
        if (this.debug) console.error('Error tracking Firebase Analytics pageview:', e);
      }
    }
  }

  /**
   * Track custom event
   * 
   * @param event - The event details to track
   */
  public event(event: TrackingEvent) {
    if (this.debug) console.log(`Tracking event: ${event.action}`, event);
    
    // Ensure page title is included if possible
    if (!event.page_title) {
      event.page_title = this.getPageTitleFromDOM();
    }
    
    // Track in Google Analytics
    if (this.gaAvailable && window.gtag) {
      try {
        window.gtag('event', event.action, {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          ...event,
        });
        if (this.debug) console.log('Google Analytics event tracked');
      } catch (e) {
        if (this.debug) console.error('Error tracking Google Analytics event:', e);
      }
    }
    
    // Track in Firebase Analytics
    if (this.fbAvailable && this.firebaseAnalytics) {
      try {
        firebaseLogEvent(this.firebaseAnalytics, event.action, {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          ...event,
        });
        if (this.debug) console.log('Firebase Analytics event tracked');
      } catch (e) {
        if (this.debug) console.error('Error tracking Firebase Analytics event:', e);
      }
    }
  }

  /**
   * Get page debug status
   */
  public debugStatus() {
    return {
      gaAvailable: this.gaAvailable,
      fbAvailable: this.fbAvailable,
      gaId: this.gaId?.substring(0, 2) + '...',
      fbMeasurementId: this.fbMeasurementId?.substring(0, 2) + '...',
    };
  }

  /**
   * Helper method to get the current page title from the DOM
   * This ensures we always have a title even if not passed explicitly
   */
  private getPageTitleFromDOM(): string {
    if (typeof document !== 'undefined') {
      return document.title || 'Unknown Page';
    }
    return 'Unknown Page';
  }

  /**
   * Helper method to extract page ID from URL if present
   * This helps associate analytics data with specific pages
   */
  private extractPageIdFromUrl(url: string): string | undefined {
    // Extract page ID from URLs like /pages/[id] or /user/[id]
    const pageMatch = url.match(/\/pages\/([^/?#]+)/);
    const userMatch = url.match(/\/user\/([^/?#]+)/);
    
    return pageMatch?.[1] || userMatch?.[1];
  }
}

/**
 * Get the singleton analytics instance
 * This ensures we only initialize analytics once
 */
export const getAnalyticsInstance = (): Analytics => {
  if (!analyticsInstance) {
    analyticsInstance = new Analytics();
  }
  return analyticsInstance;
};

/**
 * Hook for easier tracking in components
 * Use this in React components that need to track events
 */
export const useAnalytics = () => {
  return getAnalyticsInstance();
}; 