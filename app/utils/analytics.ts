'use client';

import { initializeAnalytics } from "../firebase/config";
import { getAnalytics, logEvent as firebaseLogEvent } from 'firebase/analytics';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

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
 * 
 * NOTE: This module is being gradually replaced by the analytics-service.ts
 * implementation, but is maintained for backward compatibility.
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

// Add GA_INITIALIZED to Window interface if not already defined
declare global {
  interface Window {
    GA_INITIALIZED?: boolean;
  }
}

// Define gtag as a global function if not already defined
declare let gtag: (command: string, targetId: string, config?: Record<string, any>) => void;

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
  private async setupAnalytics(): Promise<void> {
    // Check if Google Analytics is available
    if (this.gaId) {
      this.gaAvailable = true;
    }

    // Check if Firebase Analytics is available
    if (this.fbMeasurementId) {
      try {
        this.firebaseAnalytics = await initializeAnalytics();
        if (this.firebaseAnalytics) {
          this.fbAvailable = true;
        }
      } catch (e) {
        console.error('Error initializing Firebase Analytics:', e);
      }
    }
  }

  /**
   * Track a page view
   * 
   * @param path - The page path
   * @param title - The page title (important for data analysis)
   */
  public pageView(path: string, title?: string): void {
    if (typeof window === 'undefined') return;

    // Get page title if not provided
    const pageTitle = title || document.title || 'WeWrite';
    
    // Track in Google Analytics
    if (this.gaAvailable && window.gtag) {
      try {
        window.gtag('config', this.gaId as string, {
          page_path: path,
          page_title: pageTitle,
          page_location: window.location.href
        });
      } catch (e) {
        console.error('Error tracking Google Analytics page view:', e);
      }
    }
    
    // Track in Firebase Analytics
    if (this.fbAvailable && this.firebaseAnalytics) {
      try {
        firebaseLogEvent(this.firebaseAnalytics, ANALYTICS_EVENTS.PAGE_VIEW, {
          page_path: path,
          page_title: pageTitle,
          page_location: window.location.href
        });
      } catch (e) {
        console.error('Error tracking Firebase Analytics page view:', e);
      }
    }
  }

  /**
   * Track a custom event
   * 
   * @param event - The event to track
   */
  public event(event: TrackingEvent): void {
    if (typeof window === 'undefined') return;
    
    // Ensure we have a page title
    if (!event.page_title) {
      event.page_title = document.title || 'WeWrite';
    }
    
    // Track in Google Analytics
    if (this.gaAvailable && window.gtag) {
      try {
        // Use a timeout to ensure GA is ready
        setTimeout(() => {
          try {
            window.gtag('event', event.action, {
              event_category: event.category,
              event_label: event.label,
              value: event.value,
              ...event
            });
          } catch (e) {
            console.error('Error tracking delayed Google Analytics event:', e);
          }
        }, 500);

        // Also try immediately in case GA is already ready
        window.gtag('event', event.action, {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          ...event
        });
      } catch (e) {
        console.error('Error tracking Google Analytics event:', e);
      }
    }
    
    // Track in Firebase Analytics
    if (this.fbAvailable && this.firebaseAnalytics) {
      try {
        firebaseLogEvent(this.firebaseAnalytics, event.action, {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          ...event
        });
      } catch (e) {
        console.error('Error tracking Firebase Analytics event:', e);
      }
    }
  }
  
  /**
   * Helper method to track authentication events
   */
  public trackAuthEvent(action: string, params: Partial<TrackingEvent> = {}): void {
    this.event({
      category: EVENT_CATEGORIES.AUTH,
      action,
      ...params
    });
  }
  
  /**
   * Helper method to track content events
   */
  public trackContentEvent(action: string, params: Partial<TrackingEvent> = {}): void {
    this.event({
      category: EVENT_CATEGORIES.CONTENT,
      action,
      ...params
    });
  }
  
  /**
   * Helper method to track interaction events
   */
  public trackInteractionEvent(action: string, params: Partial<TrackingEvent> = {}): void {
    this.event({
      category: EVENT_CATEGORIES.INTERACTION,
      action,
      ...params
    });
  }

  /**
   * Get debug status for analytics providers
   * Used by UnifiedAnalyticsProvider for debugging
   */
  public debugStatus(): { gaAvailable: boolean; fbAvailable: boolean; gaId?: string; fbMeasurementId?: string } {
    return {
      gaAvailable: this.gaAvailable,
      fbAvailable: this.fbAvailable,
      gaId: this.gaId || undefined,
      fbMeasurementId: this.fbMeasurementId || undefined
    };
  }
}

/**
 * Get the singleton analytics instance
 * This ensures we only initialize analytics once
 */
export const getAnalyticsInstance = (): Analytics => {
  if (!analyticsInstance && typeof window !== 'undefined') {
    analyticsInstance = new Analytics();
  }
  
  return analyticsInstance as Analytics;
};

/**
 * Hook for easier tracking in components
 * Use this in React components that need to track events
 */
export const useAnalytics = () => {
  return getAnalyticsInstance();
};

// Export the analytics instance for direct use
export const analytics = getAnalyticsInstance();

// Export event constants for convenience
export { ANALYTICS_EVENTS, EVENT_CATEGORIES };