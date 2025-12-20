/**
 * Capacitor platform detection and plugin utilities
 *
 * Provides helpers for detecting platform and using native plugins
 * when running inside iOS or Android Capacitor wrapper
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';

export type Platform = 'ios' | 'android' | 'web';

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Check if running in a native Capacitor app (iOS or Android)
 *
 * Uses multiple detection methods:
 * 1. Capacitor's native platform detection
 * 2. User agent detection for Android WebView
 * 3. Check for Capacitor bridge on window object
 */
export function isNativeApp(): boolean {
  // Primary check: Capacitor's built-in detection
  if (Capacitor.isNativePlatform()) {
    return true;
  }

  // Fallback: Check for Capacitor bridge injected by native app
  if (typeof window !== 'undefined') {
    // Check if running in Android WebView (contains 'wv' in user agent)
    const userAgent = navigator.userAgent || '';
    const isAndroidWebView = /Android/.test(userAgent) && /wv/.test(userAgent);

    // Check if running in iOS WKWebView
    const isIOSWebView = /iPhone|iPad|iPod/.test(userAgent) && !(window as any).MSStream;

    // Check for Capacitor bridge on window
    const hasCapacitorBridge = !!(window as any).Capacitor?.isNativePlatform?.();

    if (hasCapacitorBridge || isAndroidWebView) {
      console.log('[Capacitor] Detected native via fallback:', { hasCapacitorBridge, isAndroidWebView, isIOSWebView });
      return true;
    }
  }

  return false;
}

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  // Try Capacitor's built-in detection first
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() as 'ios' | 'android';
  }

  // Fallback: detect from user agent
  if (typeof window !== 'undefined') {
    const userAgent = navigator.userAgent || '';

    // Android WebView detection
    if (/Android/.test(userAgent) && /wv/.test(userAgent)) {
      return 'android';
    }

    // iOS WKWebView detection (standalone mode or webview)
    if (/iPhone|iPad|iPod/.test(userAgent) && !(window as any).MSStream) {
      // Check if it's a WebView (not Safari)
      const isStandalone = (window.navigator as any).standalone;
      const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS/.test(userAgent);
      if (isStandalone || !isSafari) {
        return 'ios';
      }
    }
  }

  return 'web';
}

/**
 * Check if running on a specific platform
 */
export function isPlatform(platform: Platform): boolean {
  return getPlatform() === platform;
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return isPlatform('ios');
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return isPlatform('android');
}

/**
 * Check if running on web (not native)
 */
export function isWeb(): boolean {
  return !Capacitor.isNativePlatform();
}

// ============================================================================
// Browser Plugin - Open external URLs in system browser
// ============================================================================

/**
 * Open a URL in the system browser (in-app browser on native, new tab on web)
 */
export async function openBrowser(url: string, options?: { toolbarColor?: string }): Promise<void> {
  if (isNativeApp()) {
    await Browser.open({
      url,
      toolbarColor: options?.toolbarColor,
      presentationStyle: 'popover'
    });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Close the in-app browser (native only)
 */
export async function closeBrowser(): Promise<void> {
  if (isNativeApp()) {
    await Browser.close();
  }
}

// ============================================================================
// Clipboard Plugin - Copy/paste text
// ============================================================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (isNativeApp()) {
      await Clipboard.write({ string: text });
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch (error) {
    console.error('[Clipboard] Failed to copy:', error);
    return false;
  }
}

/**
 * Read text from clipboard
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    if (isNativeApp()) {
      const result = await Clipboard.read();
      return result.value;
    } else {
      return await navigator.clipboard.readText();
    }
  } catch (error) {
    console.error('[Clipboard] Failed to read:', error);
    return null;
  }
}

// ============================================================================
// Haptics Plugin - Vibration feedback
// ============================================================================

/**
 * Trigger light haptic impact (for subtle feedback)
 */
export async function hapticLight(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}

/**
 * Trigger medium haptic impact (for button taps)
 */
export async function hapticMedium(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
}

/**
 * Trigger heavy haptic impact (for significant actions)
 */
export async function hapticHeavy(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  }
}

/**
 * Trigger success haptic notification
 */
export async function hapticSuccess(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.notification({ type: NotificationType.Success });
  }
}

/**
 * Trigger warning haptic notification
 */
export async function hapticWarning(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.notification({ type: NotificationType.Warning });
  }
}

/**
 * Trigger error haptic notification
 */
export async function hapticError(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.notification({ type: NotificationType.Error });
  }
}

/**
 * Trigger selection changed haptic (for picker/slider changes)
 */
export async function hapticSelection(): Promise<void> {
  if (isNativeApp()) {
    await Haptics.selectionChanged();
  }
}

// ============================================================================
// Keyboard Plugin - Native keyboard handling
// ============================================================================

/**
 * Show the native keyboard
 */
export async function showKeyboard(): Promise<void> {
  if (isNativeApp()) {
    await Keyboard.show();
  }
}

/**
 * Hide the native keyboard
 */
export async function hideKeyboard(): Promise<void> {
  if (isNativeApp()) {
    await Keyboard.hide();
  }
}

/**
 * Set keyboard accessory bar visibility (iOS only)
 */
export async function setAccessoryBarVisible(visible: boolean): Promise<void> {
  if (isIOS()) {
    await Keyboard.setAccessoryBarVisible({ isVisible: visible });
  }
}

/**
 * Add keyboard show listener
 */
export function addKeyboardShowListener(callback: (info: { keyboardHeight: number }) => void): Promise<{ remove: () => void }> {
  if (isNativeApp()) {
    return Keyboard.addListener('keyboardWillShow', callback);
  }
  return Promise.resolve({ remove: () => {} });
}

/**
 * Add keyboard hide listener
 */
export function addKeyboardHideListener(callback: () => void): Promise<{ remove: () => void }> {
  if (isNativeApp()) {
    return Keyboard.addListener('keyboardWillHide', callback);
  }
  return Promise.resolve({ remove: () => {} });
}

// ============================================================================
// Network Plugin - Connection status
// ============================================================================

/**
 * Get current network status
 */
export async function getNetworkStatus(): Promise<ConnectionStatus> {
  if (isNativeApp()) {
    return await Network.getStatus();
  }
  // Web fallback
  return {
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'unknown' : 'none'
  };
}

/**
 * Add network status change listener
 */
export function addNetworkListener(callback: (status: ConnectionStatus) => void): Promise<{ remove: () => void }> {
  if (isNativeApp()) {
    return Network.addListener('networkStatusChange', callback);
  }
  // Web fallback using online/offline events
  const handleOnline = () => callback({ connected: true, connectionType: 'unknown' });
  const handleOffline = () => callback({ connected: false, connectionType: 'none' });
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return Promise.resolve({
    remove: () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  });
}

// ============================================================================
// Preferences Plugin - Key-value storage (like AsyncStorage/localStorage)
// ============================================================================

/**
 * Set a preference value
 */
export async function setPreference(key: string, value: string): Promise<void> {
  if (isNativeApp()) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

/**
 * Get a preference value
 */
export async function getPreference(key: string): Promise<string | null> {
  if (isNativeApp()) {
    const result = await Preferences.get({ key });
    return result.value;
  } else {
    return localStorage.getItem(key);
  }
}

/**
 * Remove a preference
 */
export async function removePreference(key: string): Promise<void> {
  if (isNativeApp()) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Clear all preferences
 */
export async function clearPreferences(): Promise<void> {
  if (isNativeApp()) {
    await Preferences.clear();
  } else {
    localStorage.clear();
  }
}

// ============================================================================
// Share Plugin - Native share sheet
// ============================================================================

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * Open native share sheet
 */
export async function shareContent(options: ShareOptions): Promise<{ activityType?: string }> {
  if (isNativeApp()) {
    return await Share.share(options);
  } else if (navigator.share) {
    // Web Share API fallback
    await navigator.share({
      title: options.title,
      text: options.text,
      url: options.url
    });
    return {};
  } else {
    // Fallback: copy URL to clipboard
    if (options.url) {
      await copyToClipboard(options.url);
    }
    return {};
  }
}

/**
 * Check if sharing is available
 */
export function canShare(): boolean {
  if (isNativeApp()) return true;
  return !!navigator.share;
}
