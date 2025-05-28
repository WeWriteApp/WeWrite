"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { AuthContext } from "./AuthProvider";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../firebase/notifications";

/**
 * Notification data interface
 */
interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  userId: string;
  fromUserId?: string;
  fromUsername?: string;
  pageId?: string;
  pageTitle?: string;
  [key: string]: any;
}

/**
 * Notification context interface
 */
interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  loadMoreNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Notification provider props interface
 */
interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * NotificationProvider component that manages notification state
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

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

  /**
   * Function to load more notifications
   */
  const loadMoreNotifications = async (): Promise<void> => {
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

  /**
   * Function to mark a notification as read
   *
   * @param notificationId - The ID of the notification to mark as read
   */
  const markAsRead = async (notificationId: string): Promise<void> => {
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

  /**
   * Function to mark all notifications as read
   */
  const markAllAsRead = async (): Promise<void> => {
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

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use the notification context
 *
 * @returns The notification context value
 * @throws Error if used outside of NotificationProvider
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};