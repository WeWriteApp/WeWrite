'use client';

import { useCallback } from 'react';
import { useWeWriteAnalytics } from './useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../constants/analytics-events';

interface LinkClickParams {
  label: string;
  linkType: 'auth' | 'internal' | 'external' | 'anchor';
  linkText: string;
  linkUrl: string;
  device?: string;
  sectionName?: string;
}

interface ButtonClickParams {
  label: string;
  buttonType: 'primary' | 'secondary' | 'ghost' | 'cta';
  buttonText: string;
  location: string;
  device?: string;
}

/**
 * Centralized analytics tracking hook
 * Provides consistent tracking patterns across components
 */
export function useAnalyticsTracking() {
  const analytics = useWeWriteAnalytics();

  const trackLinkClick = useCallback((params: LinkClickParams) => {
    const { label, linkType, linkText, linkUrl, device, sectionName } = params;
    
    console.log(`🔗 Link clicked: ${label}`);
    
    try {
      analytics.trackInteractionEvent(ANALYTICS_EVENTS.LINK_CLICKED, {
        label,
        link_type: linkType,
        link_text: linkText,
        link_url: linkUrl,
        device: device || 'unknown',
        section_name: sectionName
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [analytics]);

  const trackButtonClick = useCallback((params: ButtonClickParams) => {
    const { label, buttonType, buttonText, location, device } = params;
    
    console.log(`🔘 Button clicked: ${label}`);
    
    try {
      analytics.trackInteractionEvent(ANALYTICS_EVENTS.BUTTON_CLICKED, {
        label,
        button_type: buttonType,
        button_text: buttonText,
        location,
        device: device || 'unknown'
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [analytics]);

  const trackAuthAction = useCallback((action: 'login_attempt' | 'register_attempt' | 'logout', params: Record<string, any> = {}) => {
    console.log(`🔐 Auth action: ${action}`);
    
    try {
      analytics.trackAuthEvent(action, params);
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [analytics]);

  const trackPageInteraction = useCallback((action: string, params: Record<string, any> = {}) => {
    console.log(`📄 Page interaction: ${action}`);
    
    try {
      analytics.trackInteractionEvent(action, params);
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [analytics]);

  return {
    trackLinkClick,
    trackButtonClick,
    trackAuthAction,
    trackPageInteraction,
    // Direct access to analytics for complex cases
    analytics
  };
}
