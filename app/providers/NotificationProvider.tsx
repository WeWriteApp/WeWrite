"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { useCurrentAccount } from "./CurrentAccountProvider";
// Import notification types
import { type Notification } from "../firebase/notifications";
import { checkEmailVerificationPeriodically } from "../services/emailVerificationNotifications";

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
  const { session } = useCurrentAccount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Fetch notifications when session changes
  useEffect(() => {
    console.log('🟣 NOTIFICATION_PROVIDER EFFECT: Effect triggered, session:', { uid: session?.uid, exists: !!session });
    if (!session) {
      console.log('🟣 NOTIFICATION_PROVIDER EFFECT: No session, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      setLastDoc(null);
      setHasMore(true);
      return;
    }
    console.log('🟣 NOTIFICATION_PROVIDER EFFECT: Session exists, fetching notifications');

    const fetchNotifications = async () => {
      try {
        setLoading(true);

        // Get notifications via API
        const response = await fetch('/api/notifications?action=list&limit=20');
        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.status}`);
        }
        const data = await response.json();
        const notificationData = data.notifications || [];
        const lastVisible = null; // API doesn't return lastVisible yet

        console.log('NotificationProvider - fetched notifications:', Array.isArray(notificationData) ? notificationData.map(n => ({ id: n.id, read: n.read, type: n.type })) : []);

        // Extract unique user IDs from notifications for batch fetching
        const userIds = new Set<string>();
        if (Array.isArray(notificationData)) {
          notificationData.forEach(notification => {
            if (notification.sourceUserId) {
              userIds.add(notification.sourceUserId);
            }
          });
        }

        // TEMPORARY: Disable user data preloading to fix dashboard rendering issue
        // Preload user data for all users mentioned in notifications
        if (userIds.size > 0) {
          console.log(`NotificationProvider - skipping user data preloading for ${userIds.size} users (temporarily disabled)`);
          // try {
          //   const { preloadUserData } = await import('../firebase/batchUserData');
          //   if (typeof preloadUserData === 'function') {
          //     await preloadUserData(Array.from(userIds));
          //     console.log('NotificationProvider - user data preloaded successfully');
          //   } else {
          //     console.warn('NotificationProvider - preloadUserData is not a function');
          //   }
          // } catch (preloadError) {
          //   console.warn('NotificationProvider - error preloading user data:', preloadError?.message || preloadError);
          //   // Continue even if preloading fails - don't let this crash the app
          // }
        }

        // Count actual unread notifications from the fetched data
        const actualUnreadCount = Array.isArray(notificationData) ? notificationData.filter(n => !n.read).length : 0;
        console.log('NotificationProvider - actual unread count from data:', actualUnreadCount);

        // Get stored unread count via API
        const countResponse = await fetch('/api/notifications?action=count');
        if (!countResponse.ok) {
          throw new Error(`Failed to fetch notification count: ${countResponse.status}`);
        }
        const countData = await countResponse.json();
        const storedCount = countData.count || 0;
        console.log('NotificationProvider - stored unread count:', storedCount);

        setUnreadCount(storedCount);

        setNotifications(Array.isArray(notificationData) ? notificationData : []);
        setLastDoc(lastVisible);
        setHasMore(Array.isArray(notificationData) && notificationData.length === 20); // Assuming pageSize is 20

        // Check for email verification notifications after fetching notifications
        checkEmailVerificationPeriodically();
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [session]);

  /**
   * Function to load more notifications
   */
  const loadMoreNotifications = async (): Promise<void> => {
    if (!session || loading || !hasMore) return;

    try {
      setLoading(true);

      // Load more notifications via API (pagination not fully implemented yet)
      const response = await fetch('/api/notifications?action=list&limit=20');
      if (!response.ok) {
        throw new Error(`Failed to fetch more notifications: ${response.status}`);
      }
      const data = await response.json();
      const newNotifications = data.notifications || [];
      const newLastDoc = null; // API doesn't support pagination yet

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
          console.warn('NotificationProvider - error preloading additional user data:', preloadError?.message || preloadError);
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
    if (!session) return;

    try {
      // Find the notification BEFORE updating local state to check if it was unread
      const notification = notifications.find(n => n.id === notificationId);
      const wasUnread = notification && !notification.read;

      // Call the API to mark as read
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
    if (!session) return;

    try {
      // Find the notification BEFORE updating local state to check if it was read
      const notification = notifications.find(n => n.id === notificationId);
      const wasRead = notification && notification.read;

      // Call the API to mark as unread
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
    if (!session) return;

    try {
      console.log('markAllAsRead called - current unreadCount:', unreadCount);
      console.log('markAllAsRead called - current notifications:', notifications.map(n => ({ id: n.id, read: n.read })));

      // Call the API to mark all as read
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