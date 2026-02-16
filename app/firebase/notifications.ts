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

// Legacy function for backward compatibility - now uses API service
import { createNotification as apiCreateNotification } from '../services/notificationsService';

/**
 * @deprecated Use createNotification from '../services/notificationsService' instead
 * This function is kept for backward compatibility and will be removed in a future version.
 */
export const createTestNotification = async (userId: string): Promise<string | null> => {
  try {

    if (!userId) {
      return null;
    }

    // Test notification templates
    const testNotifications = [
      {
        type: 'follow',
        title: 'New Follower',
        message: 'Someone started following you!',
        sourceUserId: 'test-user-123',
        metadata: { category: 'social' }
      },
      {
        type: 'link',
        title: 'Page Mention',
        message: 'Someone linked to your page!',
        sourceUserId: 'test-user-789',
        targetPageId: 'test-page-456',
        targetPageTitle: 'Test Page',
        metadata: { category: 'engagement' }
      },
      {
        type: 'append',
        title: 'Page Addition',
        message: 'Someone added your page to their page.',
        sourceUserId: 'test-user-456',
        targetPageId: 'test-page-789',
        targetPageTitle: 'Another Test Page',
        metadata: { category: 'engagement' }
      }
    ];

    // Pick a random test notification
    const randomNotification = testNotifications[Math.floor(Math.random() * testNotifications.length)];

    const notificationData = {
      userId,
      ...randomNotification
    };

    const notificationId = await apiCreateNotification(notificationData);

    return notificationId;
  } catch (error) {
    console.error('🔔 createTestNotification: Error creating test notification:', error);
    return null;
  }
};

// All notification functions are now imported from the API service above.
// This file serves as a compatibility layer and will be cleaned up further in the future.