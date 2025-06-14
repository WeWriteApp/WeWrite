'use client';

import { initializeAnalytics } from "../firebase/config";
import { getAnalytics, logEvent as firebaseLogEvent } from 'firebase/analytics';
import ReactGA from 'react-ga4';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

/**
 * WeWrite Analytics Service
 *
 * A unified service for tracking analytics events across multiple providers
 * (Google Analytics and Firebase Analytics). This service maintains compatibility
 * with the existing implementation while providing a more structured approach.
 *
 * Features:
 * - Centralized event naming using constants
 * - Automatic tracking of both GA and Firebase Analytics
 * - Consistent error handling and logging
 * - Debug mode for development
 */

// Types
export interface AnalyticsEventParams {
  category?: string;
  action: string;
  label?: string;
  value?: number;
  page_title?: string;
  page_path?: string;
  page_location?: string;
  [key: string]: any;
}

// Add GA_INITIALIZED to Window interface
declare global {
  interface Window {
    GA_INITIALIZED?: boolean;
  }
}

// Define gtag as a global function
declare let gtag: (command: string, targetId: string, config?: Record<string, any>) => void;

// Singleton instance
let instance: AnalyticsService | null = null;

class AnalyticsService {
  private firebaseAnalytics: any | null = null;
  private gaInitialized: boolean = false;
  private fbInitialized: boolean = false;
  private debug: boolean = process.env.NODE_ENV === 'development';
  private gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  private fbMeasurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  constructor() {
    if (typeof window === 'undefined') return;

    this.initializeAnalytics();
  }

  /**
   * Initialize analytics providers
   */
  private async initializeAnalytics(): Promise<void> {
    // Initialize Google Analytics
    if (this.gaId && typeof window !== 'undefined') {
      try {
        if (!window.GA_INITIALIZED) {
          if (this.debug) console.log('Initializing Google Analytics with ID:', this.gaId);

          ReactGA.initialize(this.gaId, {
            gaOptions: {
              debug_mode: this.debug
            },
            testMode: process.env.NODE_ENV !== "production"
          });

          window.GA_INITIALIZED = true;
          this.gaInitialized = true;

          if (this.debug) console.log('Google Analytics initialized successfully');
        } else {
          this.gaInitialized = true;
        }
      } catch (error) {
        console.error('Failed to initialize Google Analytics:', error);
      }
    }

    // Initialize Firebase Analytics
    try {
      this.firebaseAnalytics = await initializeAnalytics();
      if (this.firebaseAnalytics) {
        this.fbInitialized = true;
        if (this.debug) console.log('Firebase Analytics initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Analytics:', error);
    }
  }

  /**
   * Track a page view
   *
   * @param url - The page URL
   * @param title - The page title
   */
  public trackPageView(url: string, title?: string): void {
    if (typeof window === 'undefined') return;

    // Get page title if not provided
    const pageTitle = title || document.title || 'WeWrite';

    const pageData = {
      page_path: url,
      page_title: pageTitle,
      page_location: window.location.href
    };

    // Track in Google Analytics
    if (this.gaInitialized) {
      try {
        ReactGA.send({
          hitType: "pageview",
          page: url,
          title: pageTitle
        });

        if (this.debug) console.log('Google Analytics page view tracked:', pageTitle);
      } catch (error) {
        console.error('Error tracking Google Analytics page view:', error);
      }
    }

    // Track in Firebase Analytics
    if (this.fbInitialized && this.firebaseAnalytics) {
      try {
        firebaseLogEvent(this.firebaseAnalytics, ANALYTICS_EVENTS.PAGE_VIEW, pageData);

        if (this.debug) console.log('Firebase Analytics page view tracked:', pageTitle);
      } catch (error) {
        console.error('Error tracking Firebase Analytics page view:', error);
      }
    }
  }

  /**
   * Track a custom event
   *
   * @param params - Event parameters
   */
  public trackEvent(params: AnalyticsEventParams): void {
    if (typeof window === 'undefined') return;

    // Ensure we have a page title
    if (!params.page_title) {
      params.page_title = document.title || 'WeWrite';
    }

    // Add page path and location if not provided
    if (!params.page_path) {
      params.page_path = window.location.pathname;
    }

    if (!params.page_location) {
      params.page_location = window.location.href;
    }

    if (this.debug) console.log(`Tracking event: ${params.action}`, params);

    // Track in Google Analytics
    if (this.gaInitialized) {
      try {
        ReactGA.event({
          category: params.category,
          action: params.action,
          label: params.label,
          value: params.value,
          ...params
        });

        if (this.debug) console.log('Google Analytics event tracked:', params.action);
      } catch (error) {
        console.error('Error tracking Google Analytics event:', error);
      }
    }

    // Track in Firebase Analytics
    if (this.fbInitialized && this.firebaseAnalytics) {
      try {
        firebaseLogEvent(this.firebaseAnalytics, params.action, {
          event_category: params.category,
          event_label: params.label,
          value: params.value,
          ...params
        });

        if (this.debug) console.log('Firebase Analytics event tracked:', params.action);
      } catch (error) {
        console.error('Error tracking Firebase Analytics event:', error);
      }
    }
  }

  /**
   * Helper method to track authentication events
   */
  public trackAuthEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.AUTH,
      action,
      ...params
    });
  }

  /**
   * Helper method to track content events
   */
  public trackContentEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.CONTENT,
      action,
      ...params
    });
  }

  /**
   * Helper method to track interaction events
   */
  public trackInteractionEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.INTERACTION,
      action,
      ...params
    });
  }

  /**
   * Helper method to track group events
   */
  public trackGroupEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.GROUP,
      action,
      ...params
    });
  }

  /**
   * Helper method to track feature usage events
   */
  public trackFeatureEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.FEATURE,
      action,
      ...params
    });
  }

  /**
   * Helper method to track session events
   */
  public trackSessionEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.SESSION,
      action,
      ...params
    });
  }

  /**
   * Helper method to track navigation events
   */
  public trackNavigationEvent(action: string, params: Partial<AnalyticsEventParams> = {}): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.NAVIGATION,
      action,
      ...params
    });
  }

  /**
   * Helper method to track subscription initiated events
   */
  public trackSubscriptionInitiated(tier: string, amount: number, tokens: number): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.FEATURE,
      action: 'subscription_initiated',
      tier,
      amount,
      tokens,
      value: amount
    });
  }

  /**
   * Helper method to track subscription cancelled events
   */
  public trackSubscriptionCancelled(tier: string, amount: number): void {
    this.trackEvent({
      category: EVENT_CATEGORIES.FEATURE,
      action: 'subscription_cancelled',
      tier,
      amount,
      value: amount
    });
  }
}

/**
 * Get the singleton instance of the analytics service
 */
export const getAnalyticsService = (): AnalyticsService => {
  if (!instance && typeof window !== 'undefined') {
    instance = new AnalyticsService();
  }

  return instance as AnalyticsService;
};

/**
 * React hook for using analytics in components
 */
export const useAnalytics = () => {
  return getAnalyticsService();
};
