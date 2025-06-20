"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { AuthContext } from "./AuthProvider";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  fixUnreadNotificationsCount
} from "../firebase/notifications";
import { checkEmailVerificationPeriodically } from "../services/emailVerificationNotifications";

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
  markAsUnread: (notificationId: string) => Promise<void>;
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

        // Get notifications first
        const { notifications: notificationData, lastDoc: lastVisible } = await getNotifications(user.uid);

        console.log('NotificationProvider - fetched notifications:', notificationData.map(n => ({ id: n.id, read: n.read, type: n.type })));

        // Extract unique user IDs from notifications for batch fetching
        const userIds = new Set<string>();
        notificationData.forEach(notification => {
          if (notification.sourceUserId) {
            userIds.add(notification.sourceUserId);
          }
        });

        // Preload user data for all users mentioned in notifications
        if (userIds.size > 0) {
          console.log(`NotificationProvider - preloading user data for ${userIds.size} users`);
          try {
            const { preloadUserData } = await import('../firebase/batchUserData');
            await preloadUserData(Array.from(userIds));
            console.log('NotificationProvider - user data preloaded successfully');
          } catch (preloadError) {
            console.warn('NotificationProvider - error preloading user data:', preloadError);
            // Continue even if preloading fails
          }
        }

        // Count actual unread notifications from the fetched data
        const actualUnreadCount = notificationData.filter(n => !n.read).length;
        console.log('NotificationProvider - actual unread count from data:', actualUnreadCount);

        // Get stored unread count
        const storedCount = await getUnreadNotificationsCount(user.uid);
        console.log('NotificationProvider - stored unread count:', storedCount);

        // If there's a mismatch, fix it
        if (actualUnreadCount !== storedCount) {
          console.log('NotificationProvider - count mismatch detected, fixing...');
          const fixedCount = await fixUnreadNotificationsCount(user.uid);
          setUnreadCount(fixedCount);
        } else {
          setUnreadCount(storedCount);
        }

        setNotifications(notificationData);
        setLastDoc(lastVisible);
        setHasMore(notificationData.length === 20); // Assuming pageSize is 20

        // Check for email verification notifications after fetching notifications
        checkEmailVerificationPeriodically();
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

      // Extract unique user IDs from new notifications for batch fetching
      const userIds = new Set<string>();
      newNotifications.forEach(notification => {
        if (notification.sourceUserId) {
          userIds.add(notification.sourceUserId);
        }
      });

      // Preload user data for all users mentioned in new notifications
      if (userIds.size > 0) {
        console.log(`NotificationProvider - preloading user data for ${userIds.size} additional users`);
        try {
          const { preloadUserData } = await import('../firebase/batchUserData');
          await preloadUserData(Array.from(userIds));
          console.log('NotificationProvider - additional user data preloaded successfully');
        } catch (preloadError) {
          console.warn('NotificationProvider - error preloading additional user data:', preloadError);
          // Continue even if preloading fails
        }
      }

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
      // Find the notification BEFORE updating local state to check if it was unread
      const notification = notifications.find(n => n.id === notificationId);
      const wasUnread = notification && !notification.read;

      // Call the backend to mark as read
      await markNotificationAsRead(user.uid, notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      // Decrement unread count only if the notification was actually unread
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Re-throw the error so the UI can handle it if needed
      throw error;
    }
  };

  /**
   * Function to mark a notification as unread
   *
   * @param notificationId - The ID of the notification to mark as unread
   */
  const markAsUnread = async (notificationId: string): Promise<void> => {
    if (!user) return;

    try {
      // Find the notification BEFORE updating local state to check if it was read
      const notification = notifications.find(n => n.id === notificationId);
      const wasRead = notification && notification.read;

      // Call the backend to mark as unread
      await markNotificationAsUnread(user.uid, notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: false }
            : notification
        )
      );

      // Increment unread count only if the notification was actually read
      if (wasRead) {
        setUnreadCount(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error marking notification as unread:", error);
      // Re-throw the error so the UI can handle it if needed
      throw error;
    }
  };

  /**
   * Function to mark all notifications as read
   */
  const markAllAsRead = async (): Promise<void> => {
    if (!user) return;

    try {
      console.log('markAllAsRead called - current unreadCount:', unreadCount);
      console.log('markAllAsRead called - current notifications:', notifications.map(n => ({ id: n.id, read: n.read })));

      await markAllNotificationsAsRead(user.uid);

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      setUnreadCount(0);
      console.log('markAllAsRead completed - unreadCount set to 0');
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      // Re-throw the error so the UI can handle it if needed
      throw error;
    }
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMoreNotifications,
    markAsRead,
    markAsUnread,
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