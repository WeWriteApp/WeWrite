/**
 * PWA Detection Utility
 *
 * This utility provides functions to detect if the app is running as a PWA (Progressive Web App)
 * and to manage user preferences related to PWA installation prompts.
 */

import { getAnalyticsService } from './analytics-service';
import { ANALYTICS_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';

// Local storage keys - using device-specific prefix to ensure per-device storage
const DEVICE_ID = typeof window !== 'undefined' ?
  window.navigator.userAgent.replace(/\D+/g, '') : '';

const STORAGE_KEYS = {
  PWA_BANNER_DISMISSED: `device_${DEVICE_ID}_pwa_banner_dismissed`,
  PWA_BANNER_DISMISSED_TIMESTAMP: `device_${DEVICE_ID}_pwa_banner_dismissed_timestamp`,
  PWA_DONT_REMIND: `device_${DEVICE_ID}_pwa_dont_remind`};

/**
 * Check if the app is running in standalone mode (PWA)
 */
export const isPWA = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Check for standalone mode (iOS and Android PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check for iOS "Add to Home Screen" mode
  const isIOSPWA =
    window.navigator.standalone ||
    // @ts-ignore: This property exists on iOS Safari
    (window.navigator.standalone === true);

  return isStandalone || isIOSPWA;
};

/**
 * Check if the app is running on a mobile device
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Check for mobile user agent
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

/**
 * Check if the PWA banner should be shown
 * @returns {boolean} Whether the banner should be shown
 */
export const shouldShowPWABanner = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Don't show banner if already using as PWA
  if (isPWA()) return false;

  // Check if user has chosen "Don't remind me"
  if (localStorage.getItem(STORAGE_KEYS.PWA_DONT_REMIND) === 'true') {
    return false;
  }

  // Check if banner was recently dismissed with "Maybe later"
  const dismissedTimestamp = localStorage.getItem(STORAGE_KEYS.PWA_BANNER_DISMISSED_TIMESTAMP);
  if (dismissedTimestamp) {
    const dismissedTime = parseInt(dismissedTimestamp, 10);
    const currentTime = Date.now();

    // If dismissed less than 1 day ago, don't show
    if (currentTime - dismissedTime < 1 * 24 * 60 * 60 * 1000) {
      return false;
    }
  }

  return true;
};

/**
 * Mark the PWA banner as dismissed with "Maybe later"
 */
export const dismissPWABanner = (): void => {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.PWA_BANNER_DISMISSED, 'true');
  localStorage.setItem(STORAGE_KEYS.PWA_BANNER_DISMISSED_TIMESTAMP, Date.now().toString());
};

/**
 * Mark the PWA banner as permanently dismissed with "Don't remind me"
 */
export const permanentlyDismissPWABanner = (): void => {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.PWA_DONT_REMIND, 'true');
};

/**
 * Reset the PWA banner dismissal state (for testing)
 */
export const resetPWABannerState = (): void => {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.PWA_BANNER_DISMISSED);
  localStorage.removeItem(STORAGE_KEYS.PWA_BANNER_DISMISSED_TIMESTAMP);
  localStorage.removeItem(STORAGE_KEYS.PWA_DONT_REMIND);
};

/**
 * Get instructions for installing as PWA based on browser
 */
export const getPWAInstallInstructions = (): string => {
  if (typeof window === 'undefined') return '';

  const userAgent = window.navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'Tap the share icon in Safari, then select "Add to Home Screen"';
  } else if (/android/.test(userAgent)) {
    if (/chrome/.test(userAgent)) {
      return 'Tap the menu button in Chrome, then select "Add to Home Screen"';
    } else {
      return 'Open this site in Chrome, tap the menu button, then select "Add to Home Screen"';
    }
  } else if (/chrome/.test(userAgent)) {
    return 'Click the install icon in the address bar or open the menu and select "Install WeWrite"';
  } else if (/firefox/.test(userAgent)) {
    return 'Open the menu in Firefox and select "Install app"';
  } else if (/edge/.test(userAgent)) {
    return 'Click the install icon in the address bar or open the menu and select "Apps > Install this site as an app"';
  }

  return 'Use your browser\'s menu to add this site to your home screen';
};

/**
 * Open an external link properly in PWA mode or browser
 *
 * In PWA mode on iOS, we need to use window.location.href to open links in the default browser
 * In regular browser mode, we use window.open with _blank target
 *
 * @param url The URL to open
 * @param analyticsLabel Optional analytics label for tracking
 */
export const openExternalLink = (url: string, analyticsLabel?: string): void => {
  if (typeof window === 'undefined') return;

  try {
    // Track the event if analytics label is provided
    if (analyticsLabel && typeof getAnalyticsService === 'function') {
      try {
        const analyticsService = getAnalyticsService();
        analyticsService.trackEvent({
          category: EVENT_CATEGORIES.EXTERNAL_LINK,
          action: 'click',
          label: analyticsLabel});
      } catch (error) {
        console.error('Error tracking external link click:', error);
      }
    }

    // Always use location.href to open external links in the device's default browser
    // This ensures consistent behavior across all platforms and prevents issues with
    // the status bar when returning to the app from an external link
    window.location.href = url;
  } catch (error) {
    console.error('Error opening external link:', error);
    // Fallback to changing location directly if window.open fails
    window.location.href = url;
  }
};

/**
 * Open an external link in a new tab
 *
 * @param url The URL to open
 * @param analyticsLabel Optional analytics label for tracking
 */
export const openExternalLinkInNewTab = (url: string, analyticsLabel?: string): void => {
  if (typeof window === 'undefined') return;

  try {
    // Track the event if analytics label is provided
    if (analyticsLabel && typeof getAnalyticsService === 'function') {
      try {
        const analyticsService = getAnalyticsService();
        analyticsService.trackEvent({
          category: EVENT_CATEGORIES.EXTERNAL_LINK,
          action: 'click',
          label: analyticsLabel});
      } catch (error) {
        console.error('Error tracking external link click:', error);
      }
    }

    // Open in a new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Error opening external link in new tab:', error);
    // Fallback to changing location directly if window.open fails
    window.location.href = url;
  }
};