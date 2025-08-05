/**
 * Notification Criticality Utilities
 * 
 * Provides default criticality levels for different notification types
 * and utilities for managing notification importance.
 */

import type { NotificationCriticality } from '../services/notificationsApi';
import type { NotificationType } from '../types/database';

/**
 * Default criticality levels for different notification types
 * 
 * - device: Most critical - sends device notifications if enabled
 * - normal: Standard - shows in notifications tab
 * - hidden: Least critical - user can choose to hide these
 */
export const DEFAULT_CRITICALITY_LEVELS: Record<NotificationType, NotificationCriticality> = {
  // User interaction notifications - generally normal importance
  'follow': 'normal',
  'link': 'normal', 
  'append': 'normal',
  'page_mention': 'normal',
  'page_follow': 'normal',
  
  // System notifications - critical for account security
  'system_announcement': 'device',
  'email_verification': 'device',
  
  // Payment notifications - critical for service continuity
  'payment_failed': 'device',
  'payment_failed_warning': 'device',
  'payment_failed_final': 'device',
  
  // Payout notifications - important but not critical
  'payout_initiated': 'normal',
  'payout_processing': 'hidden',      // Less important intermediate state
  'payout_completed': 'normal',
  'payout_failed': 'device',          // Critical - user needs to take action
  'payout_retry_scheduled': 'normal',
  'payout_cancelled': 'normal',
  'payout_processed': 'normal'        // Legacy
};

/**
 * Get the default criticality level for a notification type
 */
export function getDefaultCriticality(type: NotificationType): NotificationCriticality {
  return DEFAULT_CRITICALITY_LEVELS[type] || 'normal';
}

/**
 * Get a human-readable description of criticality levels
 */
export function getCriticalityDescription(criticality: NotificationCriticality): string {
  switch (criticality) {
    case 'device':
      return 'Send device notification (most critical)';
    case 'normal':
      return 'Show in notifications tab (normal)';
    case 'hidden':
      return 'Hide notification (not critical)';
    default:
      return 'Unknown criticality level';
  }
}

/**
 * Get the icon name for a criticality level
 */
export function getCriticalityIcon(criticality: NotificationCriticality): string {
  switch (criticality) {
    case 'device':
      return 'Smartphone';
    case 'normal':
      return 'Bell';
    case 'hidden':
      return 'EyeOff';
    default:
      return 'Bell';
  }
}

/**
 * Check if a notification should be shown based on its criticality
 * This can be used to filter notifications in the UI
 */
export function shouldShowNotification(criticality: NotificationCriticality): boolean {
  return criticality !== 'hidden';
}

/**
 * Check if a notification should trigger a device notification
 */
export function shouldSendDeviceNotification(criticality: NotificationCriticality): boolean {
  return criticality === 'device';
}

/**
 * Get criticality level with fallback to default
 */
export function getCriticalityWithFallback(
  criticality: NotificationCriticality | undefined,
  notificationType: NotificationType
): NotificationCriticality {
  return criticality || getDefaultCriticality(notificationType);
}
