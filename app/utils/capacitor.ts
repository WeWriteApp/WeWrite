/**
 * Capacitor platform detection utilities
 *
 * Provides helpers for detecting if the app is running inside
 * a native iOS or Android Capacitor wrapper
 */

import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

/**
 * Check if running in a native Capacitor app (iOS or Android)
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  if (!Capacitor.isNativePlatform()) return 'web';
  return Capacitor.getPlatform() as 'ios' | 'android';
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
