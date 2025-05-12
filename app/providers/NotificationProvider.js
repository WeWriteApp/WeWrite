"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { AuthContext } from "./AuthProvider";
import { useNotificationPermission } from "./NotificationPermissionProvider";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../firebase/notifications";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { permission, showNotification } = useNotificationPermission();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);

  // Fetch notifications when user changes
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setPreviousUnreadCount(0);
      setLastDoc(null);
      setHasMore(true);
      return;
    }

    const fetchNotifications = async () => {
      try {
        setLoading(true);

        // Get unread count
        const count = await getUnreadNotificationsCount(user.uid);

        // Store previous count before updating
        setPreviousUnreadCount(unreadCount);
        setUnreadCount(count);

        // Get notifications
        const { notifications: notificationData, lastDoc: lastVisible } = await getNotifications(user.uid);

        setNotifications(notificationData);
        setLastDoc(lastVisible);
        setHasMore(notificationData.length === 20); // Assuming pageSize is 20
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Set up polling for new notifications every 30 seconds
    const intervalId = setInterval(fetchNotifications, 30000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [user]);

  // Trigger browser notifications when new notifications arrive
  useEffect(() => {
    // Only proceed if notifications are enabled and we have a user
    if (permission !== 'granted' || !user) return;

    // Check if there are new notifications
    const newNotificationsCount = unreadCount - previousUnreadCount;

    if (newNotificationsCount > 0) {
      // Find the new notifications (they should be at the beginning of the array)
      const newNotifications = notifications.slice(0, newNotificationsCount);

      // Show a notification for each new notification (up to 3)
      newNotifications.slice(0, 3).forEach(notification => {
        let title = 'New notification from WeWrite';
        let body = '';

        // Format the notification message based on type
        if (notification.type === 'follow') {
          title = 'New follower on WeWrite';
          body = `Someone is following your page "${notification.targetPageTitle}"`;
        } else if (notification.type === 'link') {
          title = 'New link to your page';
          body = `Your page "${notification.targetPageTitle}" was linked from another page`;
        } else if (notification.type === 'append') {
          title = 'Your page was added to another page';
          body = `Your page "${notification.sourcePageTitle}" was added to another page`;
        }

        // Show the browser notification
        showNotification(title, {
          body,
          tag: notification.id, // Prevent duplicate notifications
          data: {
            url: `/${notification.targetPageId || notification.sourcePageId}`,
            notificationId: notification.id
          },
          requireInteraction: false,
          silent: false
        });
      });

      // If there are more than 3 new notifications, show a summary
      if (newNotificationsCount > 3) {
        showNotification('WeWrite Notifications', {
          body: `You have ${newNotificationsCount} new notifications`,
          tag: 'summary',
          data: {
            url: '/notifications'
          },
          requireInteraction: false,
          silent: false
        });
      }
    }
  }, [unreadCount, previousUnreadCount, notifications, permission, user, showNotification]);

  // Function to load more notifications
  const loadMoreNotifications = async () => {
    if (!user || loading || !hasMore) return;

    try {
      setLoading(true);

      const { notifications: newNotifications, lastDoc: newLastDoc } = await getNotifications(
        user.uid,
        20,
        lastDoc
      );

      setNotifications(prev => [...prev, ...newNotifications]);
      setLastDoc(newLastDoc);
      setHasMore(newNotifications.length === 20); // Assuming pageSize is 20
    } catch (error) {
      console.error("Error loading more notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to mark a notification as read
  const markAsRead = async (notificationId) => {
    if (!user) return;

    try {
      await markNotificationAsRead(user.uid, notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      // Decrement unread count if the notification was unread
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Function to mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await markAllNotificationsAsRead(user.uid);

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        hasMore,
        loadMoreNotifications,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}