/**
 * PWA Analytics Utility
 * 
 * Comprehensive PWA detection and analytics tracking for admin dashboard
 * and user behavior analysis
 */

import { getAnalyticsService } from './analytics-service';
import { PWA_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { isPWA, isMobileDevice } from './pwa-detection';

export interface PWAAnalyticsData {
  isPWA: boolean;
  isMobile: boolean;
  displayMode: string;
  userAgent: string;
  platform: string;
  standalone: boolean;
  orientation: string;
  screenSize: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  installPromptAvailable: boolean;
  sessionId: string;
  timestamp: number;
}

/**
 * Get comprehensive PWA analytics data
 */
export function getPWAAnalyticsData(): PWAAnalyticsData {
  if (typeof window === 'undefined') {
    return {
      isPWA: false,
      isMobile: false,
      displayMode: 'browser',
      userAgent: 'server',
      platform: 'server',
      standalone: false,
      orientation: 'unknown',
      screenSize: { width: 0, height: 0, devicePixelRatio: 1 },
      installPromptAvailable: false,
      sessionId: 'server',
      timestamp: Date.now()
    };
  }

  // Detect display mode
  let displayMode = 'browser';
  if (window.matchMedia('(display-mode: standalone)').matches) {
    displayMode = 'standalone';
  } else if (window.matchMedia('(display-mode: fullscreen)').matches) {
    displayMode = 'fullscreen';
  } else if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    displayMode = 'minimal-ui';
  } else if (window.matchMedia('(display-mode: window-controls-overlay)').matches) {
    displayMode = 'window-controls-overlay';
  }

  // Get or create session ID
  let sessionId = sessionStorage.getItem('pwa_session_id');
  if (!sessionId) {
    sessionId = `pwa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('pwa_session_id', sessionId);
  }

  return {
    isPWA: isPWA(),
    isMobile: isMobileDevice(),
    displayMode,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    standalone: !!(navigator as any).standalone,
    orientation: screen.orientation?.type || 'unknown',
    screenSize: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    installPromptAvailable: !!(window as any).deferredPrompt,
    sessionId,
    timestamp: Date.now()
  };
}

/**
 * Track PWA status for analytics and admin dashboard
 */
export function trackPWAStatus(): void {
  try {
    const pwaData = getPWAAnalyticsData();
    const analyticsService = getAnalyticsService();

    // Track PWA status event
    analyticsService.trackEvent({
      category: EVENT_CATEGORIES.PWA,
      action: PWA_EVENTS.PWA_STATUS,
      label: pwaData.isPWA ? 'pwa_mode' : 'browser_mode',
      value: pwaData.isPWA ? 1 : 0,
      customParameters: {
        display_mode: pwaData.displayMode,
        is_mobile: pwaData.isMobile,
        platform: pwaData.platform,
        screen_width: pwaData.screenSize.width,
        screen_height: pwaData.screenSize.height,
        device_pixel_ratio: pwaData.screenSize.devicePixelRatio,
        orientation: pwaData.orientation,
        session_id: pwaData.sessionId
      }
    });

    console.log('📱 PWA Analytics tracked:', {
      isPWA: pwaData.isPWA,
      displayMode: pwaData.displayMode,
      isMobile: pwaData.isMobile,
      sessionId: pwaData.sessionId
    });

  } catch (error) {
    console.error('PWA analytics tracking failed:', error);
  }
}

/**
 * Track PWA status changes (e.g., when user installs/uninstalls)
 */
export function trackPWAStatusChange(newStatus: boolean, previousStatus: boolean): void {
  try {
    const analyticsService = getAnalyticsService();
    const pwaData = getPWAAnalyticsData();

    analyticsService.trackEvent({
      category: EVENT_CATEGORIES.PWA,
      action: PWA_EVENTS.PWA_STATUS_CHANGED,
      label: newStatus ? 'installed' : 'uninstalled',
      value: newStatus ? 1 : 0,
      customParameters: {
        previous_status: previousStatus,
        new_status: newStatus,
        display_mode: pwaData.displayMode,
        session_id: pwaData.sessionId
      }
    });

    console.log('📱 PWA status change tracked:', {
      from: previousStatus ? 'PWA' : 'browser',
      to: newStatus ? 'PWA' : 'browser'
    });

  } catch (error) {
    console.error('PWA status change tracking failed:', error);
  }
}

/**
 * Initialize PWA analytics tracking
 * Call this once when the app loads
 */
export function initializePWAAnalytics(): void {
  if (typeof window === 'undefined') return;

  // Track initial PWA status
  trackPWAStatus();

  // Listen for display mode changes
  const mediaQueries = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)',
    '(display-mode: window-controls-overlay)'
  ];

  mediaQueries.forEach(query => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener('change', () => {
      // Re-track PWA status when display mode changes
      setTimeout(() => trackPWAStatus(), 100);
    });
  });

  // Listen for orientation changes
  if (screen.orientation) {
    screen.orientation.addEventListener('change', () => {
      setTimeout(() => trackPWAStatus(), 100);
    });
  }

  // Track PWA status periodically (every 5 minutes) to catch any changes
  setInterval(() => {
    trackPWAStatus();
  }, 5 * 60 * 1000);

  console.log('📱 PWA analytics initialized');
}

/**
 * Get PWA data for admin dashboard
 */
export function getPWADataForAdmin() {
  const pwaData = getPWAAnalyticsData();
  
  return {
    ...pwaData,
    // Additional admin-specific data
    installable: !pwaData.isPWA && pwaData.isMobile,
    browserInfo: {
      isChrome: /chrome/i.test(pwaData.userAgent),
      isSafari: /safari/i.test(pwaData.userAgent) && !/chrome/i.test(pwaData.userAgent),
      isFirefox: /firefox/i.test(pwaData.userAgent),
      isEdge: /edge/i.test(pwaData.userAgent)
    },
    deviceInfo: {
      isIOS: /iPad|iPhone|iPod/.test(pwaData.userAgent),
      isAndroid: /android/i.test(pwaData.userAgent),
      isDesktop: !pwaData.isMobile
    }
  };
}
