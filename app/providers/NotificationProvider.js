"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { AuthContext } from "./AuthProvider";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../firebase/notifications";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Fetch notifications when user changes
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLastDoc(null);
      setHasMore(true);
      return;
    }

    const fetchNotifications = async () => {
      try {
        setLoading(true);

        // Get unread count
        const count = await getUnreadNotificationsCount(user.uid);
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
  }, [user]);

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