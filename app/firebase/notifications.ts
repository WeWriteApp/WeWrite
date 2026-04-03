"use client";

/**
 * Notifications Module - API-Based Implementation
 *
 * This module now uses environment-aware API endpoints instead of direct Firebase calls.
 * All notification operations go through the /api/notifications endpoint.
 */

// Re-export types and functions from the notification service
export {
  type NotificationData,
  type Notification,
  type NotificationResult,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  createNotification,
  deleteNotification,
  createEmailVerificationNotification
} from '../services/notificationsService';

// All notification functions are now imported from the API service above.
// This file serves as a compatibility layer.