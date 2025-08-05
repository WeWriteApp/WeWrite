"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthProvider";
// Import notification types and API service
import {
  type Notification,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead
} from "../services/notificationsApi";
import { checkEmailVerificationPeriodically } from "../services/emailVerificationNotifications";
import { preloadUserData } from "../firebase/batchUserData";
// 🚨 EMERGENCY: Import optimized notifications service for 90% read reduction
import { optimizedNotificationsService } from "../services/optimizedNotificationsService";

/**
 * Notification context interface
 */
interface NotificationContextType {
  notifications: Notification[];
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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastVisible, setLastVisible] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Fetch notifications when user changes
  useEffect(() => {
    console.log('🟣 NOTIFICATION_PROVIDER EFFECT: Effect triggered, user:', { uid: user?.uid, exists: !!user });
    if (!user) {
      console.log('🟣 NOTIFICATION_PROVIDER EFFECT: No user, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      setLastVisible(null);
      setHasMore(true);
      return;
    }
    console.log('🟣 NOTIFICATION_PROVIDER EFFECT: User exists, fetching notifications');

    const fetchNotifications = async () => {
      try {
        setLoading(true);

        // 🚨 EMERGENCY: Use optimized notifications service for 90% read reduction
        const result = await optimizedNotificationsService.getNotifications(user.uid, 20);
        const notificationData = result.notifications || [];

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
          try {
            await preloadUserData(Array.from(userIds));
            console.log('NotificationProvider - user data preloaded successfully');
          } catch (preloadError) {
            console.warn('NotificationProvider - error preloading user data:', preloadError?.message || preloadError);
            // Continue even if preloading fails - don't let this crash the app
          }
        }

        // 🚨 EMERGENCY: Use optimized unread count with aggressive caching
        const unreadCount = await optimizedNotificationsService.getUnreadCount(user.uid);
        console.log('NotificationProvider - unread count (OPTIMIZED):', unreadCount);

        setUnreadCount(unreadCount);
        setNotifications(notificationData);
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);

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

      // Load more notifications via new API service
      const result = await getNotifications(20, lastVisible);
      const newNotifications = result.notifications || [];

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
          await preloadUserData(Array.from(userIds));
          console.log('NotificationProvider - additional user data preloaded successfully');
        } catch (preloadError) {
          console.warn('NotificationProvider - error preloading additional user data:', preloadError?.message || preloadError);
          // Continue even if preloading fails
        }
      }

      setNotifications(prev => [...prev, ...newNotifications]);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
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

      // 🚨 EMERGENCY: Use optimized service with optimistic updates
      await optimizedNotificationsService.markAsRead(user.uid, notificationId);

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

      // Call the new API service to mark as unread
      await markNotificationAsUnread(notificationId);

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

      // 🚨 EMERGENCY: Use optimized service with optimistic updates
      await optimizedNotificationsService.markAllAsRead(user.uid);

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