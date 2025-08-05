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
    console.log('🔔 getNotifications: Fetching notifications, limit:', limit);
    
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

    console.log('🔔 getNotifications: Found', data.notifications.length, 'notifications');

    return {
      notifications: data.notifications || [],
      lastVisible: data.lastVisible || null,
      hasMore: data.hasMore || false
    };
  } catch (error) {
    console.error('🔔 getNotifications: Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Get unread notifications count for the current user
 */
export const getUnreadNotificationsCount = async (): Promise<number> => {
  try {
    console.log('🔔 getUnreadNotificationsCount: Fetching unread count');
    
    const response = await fetch('/api/notifications?action=count');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch unread count: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch unread count');
    }

    const count = data.count || 0;
    console.log('🔔 getUnreadNotificationsCount: Count:', count);
    
    return count;
  } catch (error) {
    console.error('🔔 getUnreadNotificationsCount: Error fetching count:', error);
    throw error;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    console.log('🔔 markNotificationAsRead: Marking notification as read:', notificationId);
    
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

    console.log('🔔 markNotificationAsRead: Successfully marked as read');
  } catch (error) {
    console.error('🔔 markNotificationAsRead: Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark a notification as unread
 */
export const markNotificationAsUnread = async (notificationId: string): Promise<void> => {
  try {
    console.log('🔔 markNotificationAsUnread: Marking notification as unread:', notificationId);
    
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

    console.log('🔔 markNotificationAsUnread: Successfully marked as unread');
  } catch (error) {
    console.error('🔔 markNotificationAsUnread: Error marking notification as unread:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for the current user
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    console.log('🔔 markAllNotificationsAsRead: Marking all notifications as read');

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

    console.log('🔔 markAllNotificationsAsRead: Successfully marked all as read');
  } catch (error) {
    console.error('🔔 markAllNotificationsAsRead: Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Create a new notification
 */
export const createNotification = async (notificationData: NotificationData): Promise<string> => {
  try {
    console.log('🔔 createNotification: Creating notification for user:', notificationData.userId);

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

    console.log('🔔 createNotification: Successfully created notification:', data.notificationId);
    return data.notificationId;
  } catch (error) {
    console.error('🔔 createNotification: Error creating notification:', error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    console.log('🔔 deleteNotification: Deleting notification:', notificationId);

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

    console.log('🔔 deleteNotification: Successfully deleted notification');
  } catch (error) {
    console.error('🔔 deleteNotification: Error deleting notification:', error);
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
    console.log('🔔 updateNotificationCriticality: Updating criticality for notification:', notificationId, 'to:', criticality);

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

    console.log('🔔 updateNotificationCriticality: Successfully updated notification criticality');
  } catch (error) {
    console.error('🔔 updateNotificationCriticality: Error updating notification criticality:', error);
    throw error;
  }
};

/**
 * Create an email verification notification
 */
export const createEmailVerificationNotification = async (userId: string): Promise<string | null> => {
  try {
    console.log('🔔 createEmailVerificationNotification: Creating email verification notification for user:', userId);

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
    console.error('🔔 createEmailVerificationNotification: Error creating email verification notification:', error);
    return null;
  }
};
