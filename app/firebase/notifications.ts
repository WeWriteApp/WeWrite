"use client";

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { db } from './database/core';
import { getCollectionName } from '../utils/environmentConfig';

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
}

export interface Notification extends NotificationData {
  id: string;
  createdAt: Timestamp | string;
  read: boolean;
}

export interface NotificationResult {
  notifications: Notification[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

/**
 * Get notifications for a user with pagination support
 */
export const getNotifications = async (
  userId: string,
  limit: number = 20,
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null
): Promise<NotificationResult> => {
  try {
    console.log('🔔 getNotifications: Fetching notifications for user:', userId, 'limit:', limit);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { getCollectionName } = await import('../utils/environmentConfig');
    const notificationsRef = collection(db, getCollectionName('users'), userId, getCollectionName('notifications'));
    
    // Build query with ordering by createdAt (newest first)
    let notificationQuery = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    // Add pagination if lastDoc is provided
    if (lastDoc) {
      notificationQuery = query(
        notificationsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        firestoreLimit(limit)
      );
    }

    const querySnapshot = await getDocs(notificationQuery);
    console.log('🔔 getNotifications: Found', querySnapshot.docs.length, 'notifications');

    const notifications: Notification[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || userId,
        type: data.type || 'unknown',
        title: data.title || '',
        message: data.message || '',
        sourceUserId: data.sourceUserId,
        targetPageId: data.targetPageId,
        targetPageTitle: data.targetPageTitle,
        actionUrl: data.actionUrl,
        metadata: data.metadata || {},
        read: data.read || false,
        createdAt: data.createdAt || serverTimestamp()
      };
    });

    const lastVisible = querySnapshot.docs.length > 0 
      ? querySnapshot.docs[querySnapshot.docs.length - 1] 
      : null;

    console.log('🔔 getNotifications: Returning', notifications.length, 'notifications');
    return {
      notifications,
      lastDoc: lastVisible
    };
  } catch (error) {
    console.error('🔔 getNotifications: Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Get the count of unread notifications for a user
 */
export const getUnreadNotificationsCount = async (userId: string): Promise<number> => {
  try {
    console.log('🔔 getUnreadNotificationsCount: Getting count for user:', userId);
    
    if (!userId) {
      return 0;
    }

    // Check if user document has cached unread count
    const userDocRef = doc(db, getCollectionName('users'), userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists() && userDoc.data().unreadNotificationsCount !== undefined) {
      const cachedCount = userDoc.data().unreadNotificationsCount || 0;
      console.log('🔔 getUnreadNotificationsCount: Using cached count:', cachedCount);
      return cachedCount;
    }

    // Fallback: Count unread notifications directly
    const notificationsRef = collection(db, getCollectionName('users'), userId, getCollectionName('notifications'));
    const unreadQuery = query(
      notificationsRef,
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(unreadQuery);
    const count = querySnapshot.docs.length;
    
    console.log('🔔 getUnreadNotificationsCount: Counted', count, 'unread notifications');
    
    // Update cached count in user document
    try {
      await updateDoc(userDocRef, {
        unreadNotificationsCount: count
      });
    } catch (updateError) {
      console.warn('🔔 getUnreadNotificationsCount: Failed to update cached count:', updateError);
    }

    return count;
  } catch (error) {
    console.error('🔔 getUnreadNotificationsCount: Error getting unread count:', error);
    return 0;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<void> => {
  try {
    console.log('🔔 markNotificationAsRead: Marking notification as read:', notificationId);
    
    if (!userId || !notificationId) {
      throw new Error('User ID and notification ID are required');
    }

    const batch = writeBatch(db);
    
    // Update the notification
    const notificationRef = doc(db, getCollectionName('users'), userId, getCollectionName('notifications'), notificationId);
    batch.update(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });

    // Decrement unread count in user document
    const userDocRef = doc(db, getCollectionName('users'), userId);
    batch.update(userDocRef, {
      unreadNotificationsCount: increment(-1)
    });

    await batch.commit();
    console.log('🔔 markNotificationAsRead: Successfully marked as read');
  } catch (error) {
    console.error('🔔 markNotificationAsRead: Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark a notification as unread
 */
export const markNotificationAsUnread = async (userId: string, notificationId: string): Promise<void> => {
  try {
    console.log('🔔 markNotificationAsUnread: Marking notification as unread:', notificationId);
    
    if (!userId || !notificationId) {
      throw new Error('User ID and notification ID are required');
    }

    const batch = writeBatch(db);
    
    // Update the notification
    const notificationRef = doc(db, getCollectionName('users'), userId, getCollectionName('notifications'), notificationId);
    batch.update(notificationRef, {
      read: false,
      readAt: null
    });

    // Increment unread count in user document
    const userDocRef = doc(db, getCollectionName('users'), userId);
    batch.update(userDocRef, {
      unreadNotificationsCount: increment(1)
    });

    await batch.commit();
    console.log('🔔 markNotificationAsUnread: Successfully marked as unread');
  } catch (error) {
    console.error('🔔 markNotificationAsUnread: Error marking notification as unread:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    console.log('🔔 markAllNotificationsAsRead: Marking all notifications as read for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get all unread notifications
const notificationsRef = collection(db, getCollectionName("users"), userId, 'notifications');
    const unreadQuery = query(
      notificationsRef,
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(unreadQuery);
    console.log('🔔 markAllNotificationsAsRead: Found', querySnapshot.docs.length, 'unread notifications');

    if (querySnapshot.docs.length === 0) {
      console.log('🔔 markAllNotificationsAsRead: No unread notifications to update');
      return;
    }

    // Use batch to update all notifications
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: serverTimestamp()
      });
    });

    // Reset unread count in user document
    const userDocRef = doc(db, getCollectionName('users'), userId);
    batch.update(userDocRef, {
      unreadNotificationsCount: 0
    });

    await batch.commit();
    console.log('🔔 markAllNotificationsAsRead: Successfully marked all notifications as read');
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

    const batch = writeBatch(db);

    // Create the notification document
    const notificationsRef = collection(db, getCollectionName('users'), notificationData.userId, getCollectionName('notifications'));
    const notificationRef = doc(notificationsRef);

    const notification = {
      ...notificationData,
      read: notificationData.read || false,
      createdAt: serverTimestamp()
    };

    batch.set(notificationRef, notification);

    // Increment unread count if notification is unread
    if (!notificationData.read) {
      const userDocRef = doc(db, getCollectionName('users'), notificationData.userId);
      batch.update(userDocRef, {
        unreadNotificationsCount: increment(1)
      });
    }

    await batch.commit();
    console.log('🔔 createNotification: Successfully created notification:', notificationRef.id);

    return notificationRef.id;
  } catch (error) {
    console.error('🔔 createNotification: Error creating notification:', error);
    throw error;
  }
};

/**
 * Fix unread notifications count by recalculating from actual data
 */
export const fixUnreadNotificationsCount = async (userId: string): Promise<number> => {
  try {
    console.log('🔔 fixUnreadNotificationsCount: Fixing unread count for user:', userId);

    if (!userId) {
      return 0;
    }

    // Count actual unread notifications
const notificationsRef = collection(db, getCollectionName("users"), userId, 'notifications');
    const unreadQuery = query(
      notificationsRef,
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(unreadQuery);
    const actualCount = querySnapshot.docs.length;

    console.log('🔔 fixUnreadNotificationsCount: Found', actualCount, 'actual unread notifications');

    // Update the cached count in user document
    const userDocRef = doc(db, getCollectionName('users'), userId);
    await updateDoc(userDocRef, {
      unreadNotificationsCount: actualCount
    });

    console.log('🔔 fixUnreadNotificationsCount: Fixed unread count to:', actualCount);
    return actualCount;
  } catch (error) {
    console.error('🔔 fixUnreadNotificationsCount: Error fixing unread count:', error);
    return 0;
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
      metadata: {
        priority: 'high',
        category: 'account'
      }
    };

    const notificationId = await createNotification(notificationData);
    console.log('🔔 createEmailVerificationNotification: Created notification:', notificationId);

    return notificationId;
  } catch (error) {
    console.error('🔔 createEmailVerificationNotification: Error creating email verification notification:', error);
    return null;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (userId: string, notificationId: string): Promise<void> => {
  try {
    console.log('🔔 deleteNotification: Deleting notification:', notificationId);

    if (!userId || !notificationId) {
      throw new Error('User ID and notification ID are required');
    }

    // Get the notification to check if it was unread
    const notificationRef = doc(db, getCollectionName('users'), userId, getCollectionName('notifications'), notificationId);
    const notificationDoc = await getDoc(notificationRef);

    if (!notificationDoc.exists()) {
      console.warn('🔔 deleteNotification: Notification not found:', notificationId);
      return;
    }

    const wasUnread = !notificationDoc.data().read;

    const batch = writeBatch(db);

    // Delete the notification
    batch.delete(notificationRef);

    // Decrement unread count if notification was unread
    if (wasUnread) {
      const userDocRef = doc(db, getCollectionName('users'), userId);
      batch.update(userDocRef, {
        unreadNotificationsCount: increment(-1)
      });
    }

    await batch.commit();
    console.log('🔔 deleteNotification: Successfully deleted notification');
  } catch (error) {
    console.error('🔔 deleteNotification: Error deleting notification:', error);
    throw error;
  }
};

/**
 * Create a test notification for development/testing purposes
 */
export const createTestNotification = async (userId: string): Promise<string | null> => {
  try {
    console.log('🔔 createTestNotification: Creating test notification for user:', userId);

    if (!userId) {
      return null;
    }

    const testNotifications = [
      {
        type: 'page_follow',
        title: 'New Follower',
        message: 'Someone followed your page "Test Page"',
        sourceUserId: 'test-user-123',
        targetPageId: 'test-page-456',
        targetPageTitle: 'Test Page'
      },
      {
        type: 'page_mention',
        title: 'Page Mentioned',
        message: 'Your page was mentioned in another page',
        sourceUserId: 'test-user-789',
        targetPageId: 'test-page-abc',
        targetPageTitle: 'My Awesome Page'
      },
      {
        type: 'system_announcement',
        title: 'Welcome to WeWrite!',
        message: 'Thank you for joining our community. Start creating your first page!',
        metadata: {
          priority: 'normal',
          category: 'welcome'
        }
      }
    ];

    // Pick a random test notification
    const randomNotification = testNotifications[Math.floor(Math.random() * testNotifications.length)];

    const notificationData: NotificationData = {
      userId,
      ...randomNotification
    };

    const notificationId = await createNotification(notificationData);
    console.log('🔔 createTestNotification: Created test notification:', notificationId);

    return notificationId;
  } catch (error) {
    console.error('🔔 createTestNotification: Error creating test notification:', error);
    return null;
  }
};