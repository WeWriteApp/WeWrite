"use client";

import { db } from './database';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';

/**
 * Create a notification
 * 
 * @param {Object} notificationData - The notification data
 * @param {string} notificationData.userId - The ID of the user receiving the notification
 * @param {string} notificationData.type - The type of notification (follow, link, etc.)
 * @param {string} notificationData.sourceUserId - The ID of the user who triggered the notification
 * @param {string} notificationData.targetPageId - The ID of the related page (if applicable)
 * @param {string} notificationData.targetPageTitle - The title of the related page (if applicable)
 * @param {string} notificationData.sourcePageId - The ID of the source page (for link notifications)
 * @param {string} notificationData.sourcePageTitle - The title of the source page (for link notifications)
 * @returns {Promise<string>} - The ID of the created notification
 */
export const createNotification = async (notificationData) => {
  try {
    // Create a reference to the notifications collection for the user
    const notificationsRef = collection(db, 'users', notificationData.userId, 'notifications');
    
    // Create a new document with a generated ID
    const notificationRef = doc(notificationsRef);
    
    // Set the notification data
    await setDoc(notificationRef, {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp()
    });
    
    // Update the unread count for the user
    const userRef = doc(db, 'users', notificationData.userId);
    await updateDoc(userRef, {
      unreadNotificationsCount: increment(1)
    });
    
    return notificationRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * 
 * @param {string} userId - The ID of the user
 * @param {number} pageSize - The number of notifications to fetch
 * @param {Object} lastDoc - The last document from the previous batch (for pagination)
 * @returns {Promise<Object>} - The notifications and the last document
 */
export const getNotifications = async (userId, pageSize = 20, lastDoc = null) => {
  try {
    // Create a reference to the notifications collection for the user
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    
    // Create a query ordered by creation date
    let notificationsQuery = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    // If we have a last document, start after it
    if (lastDoc) {
      notificationsQuery = query(
        notificationsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }
    
    // Execute the query
    const snapshot = await getDocs(notificationsQuery);
    
    // Extract the notifications
    const notifications = [];
    snapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      });
    });
    
    // Get the last document for pagination
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    return {
      notifications,
      lastDoc: lastVisible
    };
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

/**
 * Mark a notification as read
 * 
 * @param {string} userId - The ID of the user
 * @param {string} notificationId - The ID of the notification
 * @returns {Promise<boolean>} - True if successful
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    // Create a reference to the notification
    const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
    
    // Get the notification to check if it's already read
    const notificationDoc = await getDoc(notificationRef);
    if (!notificationDoc.exists()) {
      throw new Error('Notification not found');
    }
    
    const notificationData = notificationDoc.data();
    
    // If the notification is already read, don't decrement the counter
    if (!notificationData.read) {
      // Update the notification
      await updateDoc(notificationRef, {
        read: true
      });
      
      // Decrement the unread count for the user
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        unreadNotificationsCount: increment(-1)
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * 
 * @param {string} userId - The ID of the user
 * @returns {Promise<boolean>} - True if successful
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    // Create a reference to the notifications collection for the user
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    
    // Create a query to get all unread notifications
    const unreadQuery = query(
      notificationsRef,
      where('read', '==', false)
    );
    
    // Execute the query
    const snapshot = await getDocs(unreadQuery);
    
    // If there are no unread notifications, return
    if (snapshot.empty) {
      return true;
    }
    
    // Use a batch to update all notifications
    const batch = writeBatch(db);
    
    // Mark each notification as read
    snapshot.forEach(doc => {
      const notificationRef = doc.ref;
      batch.update(notificationRef, { read: true });
    });
    
    // Commit the batch
    await batch.commit();
    
    // Reset the unread count for the user
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      unreadNotificationsCount: 0
    });
    
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Get the unread notifications count for a user
 * 
 * @param {string} userId - The ID of the user
 * @returns {Promise<number>} - The number of unread notifications
 */
export const getUnreadNotificationsCount = async (userId) => {
  try {
    // Get the user document
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return 0;
    }
    
    // Return the unread count
    return userDoc.data().unreadNotificationsCount || 0;
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
};

/**
 * Create a follow notification
 * 
 * @param {string} targetUserId - The ID of the user who owns the page
 * @param {string} sourceUserId - The ID of the user who followed the page
 * @param {string} pageId - The ID of the page that was followed
 * @param {string} pageTitle - The title of the page that was followed
 * @returns {Promise<string>} - The ID of the created notification
 */
export const createFollowNotification = async (targetUserId, sourceUserId, pageId, pageTitle) => {
  // Don't create notifications for self-follows
  if (targetUserId === sourceUserId) {
    return null;
  }
  
  return createNotification({
    userId: targetUserId,
    type: 'follow',
    sourceUserId,
    targetPageId: pageId,
    targetPageTitle: pageTitle
  });
};

/**
 * Create a link notification
 * 
 * @param {string} targetUserId - The ID of the user who owns the target page
 * @param {string} sourceUserId - The ID of the user who created the link
 * @param {string} targetPageId - The ID of the page that was linked to
 * @param {string} targetPageTitle - The title of the page that was linked to
 * @param {string} sourcePageId - The ID of the page that contains the link
 * @param {string} sourcePageTitle - The title of the page that contains the link
 * @returns {Promise<string>} - The ID of the created notification
 */
export const createLinkNotification = async (
  targetUserId,
  sourceUserId,
  targetPageId,
  targetPageTitle,
  sourcePageId,
  sourcePageTitle
) => {
  // Don't create notifications for self-links
  if (targetUserId === sourceUserId) {
    return null;
  }
  
  return createNotification({
    userId: targetUserId,
    type: 'link',
    sourceUserId,
    targetPageId,
    targetPageTitle,
    sourcePageId,
    sourcePageTitle
  });
};
