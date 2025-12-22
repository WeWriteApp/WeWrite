"use client";

/**
 * Notifications API Service
 * 
 * This service provides a clean interface for all notification operations
 * using environment-aware API endpoints instead of direct Firebase calls.
 */

export type NotificationCriticality = 'device' | 'normal' | 'hidden';

export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  sourceUserId?: string;
  targetPageId?: string;
  targetPageTitle?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  read?: boolean;
  criticality?: NotificationCriticality;
}

export interface Notification extends NotificationData {
  id: string;
  createdAt: any; // Can be Timestamp or string
  read: boolean;
  readAt?: any;
  criticality: NotificationCriticality;
}

export interface NotificationResult {
  notifications: Notification[];
  lastVisible: string | null;
  hasMore: boolean;
}

/**
 * Get notifications for the current user with pagination support
 */
export const getNotifications = async (
  limit: number = 20,
  lastVisible?: string | null
): Promise<NotificationResult> => {
  try {
    const params = new URLSearchParams({
      action: 'list',
      limit: limit.toString()
    });

    if (lastVisible) {
      params.append('lastVisible', lastVisible);
    }

    const response = await fetch(`/api/notifications?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch notifications');
    }

    return {
      notifications: data.notifications || [],
      lastVisible: data.lastVisible || null,
      hasMore: data.hasMore || false
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get unread notifications count for the current user
 */
export const getUnreadNotificationsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/notifications?action=count');

    if (!response.ok) {
      throw new Error(`Failed to fetch unread count: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch unread count');
    }

    const count = data.count || 0;

    return count;
  } catch (error) {
    throw error;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    if (!notificationId) {
      throw new Error('Notification ID is required');
    }

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'markAsRead',
        notificationId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to mark notification as read: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark notification as read');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Mark a notification as unread
 */
export const markNotificationAsUnread = async (notificationId: string): Promise<void> => {
  try {
    if (!notificationId) {
      throw new Error('Notification ID is required');
    }

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'markAsUnread',
        notificationId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to mark notification as unread: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark notification as unread');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Mark all notifications as read for the current user
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'markAllAsRead'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to mark all notifications as read: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark all notifications as read');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new notification
 */
export const createNotification = async (notificationData: NotificationData): Promise<string> => {
  try {
    if (!notificationData.userId) {
      throw new Error('User ID is required');
    }

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        notificationData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create notification: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create notification');
    }

    return data.notificationId;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    if (!notificationId) {
      throw new Error('Notification ID is required');
    }

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        notificationId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to delete notification: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete notification');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Update notification criticality level
 */
export const updateNotificationCriticality = async (
  notificationId: string,
  criticality: NotificationCriticality
): Promise<void> => {
  try {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateCriticality',
        notificationId,
        criticality
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update notification criticality: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to update notification criticality');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Create an email verification notification
 */
export const createEmailVerificationNotification = async (userId: string): Promise<string | null> => {
  try {
    if (!userId) {
      return null;
    }

    const notificationData: NotificationData = {
      userId,
      type: 'email_verification',
      title: 'Verify Your Email',
      message: 'Please verify your email address to access all features.',
      actionUrl: '/settings?tab=account',
      criticality: 'device', // Email verification is critical
      metadata: {
        priority: 'high',
        category: 'account'
      }
    };

    return await createNotification(notificationData);
  } catch (error) {
    return null;
  }
};
