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

/**
 * Create an append notification
 *
 * @param {string} targetUserId - The ID of the user who owns the source page
 * @param {string} sourceUserId - The ID of the user who appended the page
 * @param {string} sourcePageId - The ID of the page that was appended
 * @param {string} sourcePageTitle - The title of the page that was appended
 * @param {string} targetPageId - The ID of the page that the source page was appended to
 * @param {string} targetPageTitle - The title of the page that the source page was appended to
 * @returns {Promise<string>} - The ID of the created notification
 */
export const createAppendNotification = async (
  targetUserId,
  sourceUserId,
  sourcePageId,
  sourcePageTitle,
  targetPageId,
  targetPageTitle
) => {
  // Don't create notifications for self-appends
  if (targetUserId === sourceUserId) {
    return null;
  }

  return createNotification({
    userId: targetUserId,
    type: 'append',
    sourceUserId,
    sourcePageId,
    sourcePageTitle,
    targetPageId,
    targetPageTitle
  });
};

/**
 * Delete all notifications related to a specific page
 * This function is called when a page is deleted to clean up orphaned notifications
 *
 * @param {string} pageId - The ID of the page that was deleted
 * @returns {Promise<number>} - The number of notifications deleted
 */
export const deleteNotificationsForPage = async (pageId) => {
  try {
    console.log(`Starting notification cleanup for deleted page: ${pageId}`);

    if (!pageId) {
      console.warn('deleteNotificationsForPage called with empty pageId');
      return 0;
    }

    // Get all users to check their notifications
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    let totalDeleted = 0;
    let totalBatches = 0;

    // Process users in smaller chunks to avoid memory issues
    const userChunks = [];
    const chunkSize = 50; // Process 50 users at a time

    for (let i = 0; i < usersSnapshot.docs.length; i += chunkSize) {
      userChunks.push(usersSnapshot.docs.slice(i, i + chunkSize));
    }

    for (const userChunk of userChunks) {
      const batch = writeBatch(db);
      let batchCount = 0;
      const maxBatchSize = 450; // Leave some buffer for safety

      // Process each user's notifications in this chunk
      for (const userDoc of userChunk) {
        const userId = userDoc.id;
        const notificationsRef = collection(db, 'users', userId, 'notifications');

        try {
          // Query for notifications that reference the deleted page as targetPageId
          const targetPageQuery = query(
            notificationsRef,
            where('targetPageId', '==', pageId)
          );

          // Query for notifications that reference the deleted page as sourcePageId
          const sourcePageQuery = query(
            notificationsRef,
            where('sourcePageId', '==', pageId)
          );

          // Execute both queries
          const [targetPageSnapshot, sourcePageSnapshot] = await Promise.all([
            getDocs(targetPageQuery),
            getDocs(sourcePageQuery)
          ]);

          // Combine results and remove duplicates
          const notificationsToDelete = new Map();

          targetPageSnapshot.docs.forEach(doc => {
            notificationsToDelete.set(doc.id, doc);
          });

          sourcePageSnapshot.docs.forEach(doc => {
            notificationsToDelete.set(doc.id, doc);
          });

          // Skip if no notifications to delete for this user
          if (notificationsToDelete.size === 0) {
            continue;
          }

          let unreadCount = 0;

          // Add deletions to batch
          for (const [notificationId, notificationDoc] of notificationsToDelete) {
            const notificationData = notificationDoc.data();

            // Count unread notifications
            if (!notificationData.read) {
              unreadCount++;
            }

            // Delete the notification
            batch.delete(notificationDoc.ref);
            batchCount++;
            totalDeleted++;

            console.log(`Queued for deletion: ${notificationData.type} notification for user ${userId}`);

            // Check if we're approaching batch limit
            if (batchCount >= maxBatchSize) {
              break;
            }
          }

          // Update unread count if there were unread notifications
          if (unreadCount > 0) {
            const userRef = doc(db, 'users', userId);
            batch.update(userRef, {
              unreadNotificationsCount: increment(-unreadCount)
            });
            batchCount++;
          }

          // Break if batch is full
          if (batchCount >= maxBatchSize) {
            break;
          }

        } catch (userError) {
          console.error(`Error processing notifications for user ${userId}:`, userError);
          // Continue with other users
        }
      }

      // Commit batch if there are operations
      if (batchCount > 0) {
        await batch.commit();
        totalBatches++;
        console.log(`Committed batch ${totalBatches} with ${batchCount} operations`);
      }
    }

    console.log(`Notification cleanup completed. Deleted ${totalDeleted} notifications for page ${pageId} across ${totalBatches} batches`);
    return totalDeleted;

  } catch (error) {
    console.error('Error deleting notifications for page:', error);
    throw error;
  }
};
