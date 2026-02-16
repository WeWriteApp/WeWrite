"use client";

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import React, { useEffect, Suspense, useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { useNotifications } from "../providers/NotificationProvider";
import NavPageLayout from '../components/layout/NavPageLayout';
import NotificationItem from '../components/utils/NotificationItem';
import { Button } from '../components/ui/button';
import { NotificationListSkeleton } from '../components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { useWeWriteAnalytics } from '../hooks/useWeWriteAnalytics';
import { AnimatedStack, AnimatedStackItem } from '../components/ui/AnimatedStack';

type NotificationFilter = 'unread' | 'all';

function NotificationsContent() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    notifications,
    loading,
    hasMore,
    loadMoreNotifications,
    markAllAsRead
  } = useNotifications();
  const { trackNotificationInteraction } = useWeWriteAnalytics();

  // Filter state - persisted to localStorage
  const [filter, setFilter] = useState<NotificationFilter>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notifications-filter');
      if (saved === 'all' || saved === 'unread') {
        return saved;
      }
    }
    return 'unread';
  });

  // Persist filter to localStorage
  useEffect(() => {
    localStorage.setItem('notifications-filter', filter);
  }, [filter]);

  // Filter notifications based on selected filter
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  // Redirect to login if not authenticated (only after auth has finished loading)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/notifications');
    }
  }, [authLoading, isAuthenticated, router]);

  // Notifications are automatically loaded by the NotificationProvider when user changes

  // Handle "Mark all as read" button click
  const handleMarkAllAsRead = async () => {
    try {

      // Count unread notifications before marking as read
      const unreadCount = notifications.filter(n => !n.read).length;

      // Call the API to mark all as read
      await markAllAsRead();

      // Track the analytics event after successful API call
      trackNotificationInteraction('mark_all_read', undefined, {
        notification_count: unreadCount,
        total_notifications: notifications.length
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // You could add a toast notification here to inform the user of the error
    }
  };

  // Show loading state while checking authentication
  if (authLoading || !isAuthenticated) {
    return null; // Let the useEffect redirect handle this
  }

  // Show loading state while fetching notifications
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Page header with actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with your latest activity</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter toggle button */}
          <Button
            variant={filter === 'unread' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}
            className="flex items-center gap-2"
          >
            <Icon name="Filter" size={16} />
            <span className="hidden md:inline">
              {filter === 'unread' ? 'Unread' : 'All'}
            </span>
          </Button>
          <NotificationsHeaderButton />
        </div>
      </div>

      <div className="mt-6">
        {loading && notifications.length === 0 ? (
          <NotificationListSkeleton count={5} />
        ) : filteredNotifications.length > 0 ? (
          <>
            {/* px-1 gives room for card ring/shadow effects that would otherwise be clipped */}
            <div className="px-1 -mx-1">
              <AnimatedStack gap={16}>
                {filteredNotifications.map(notification => (
                  <AnimatedStackItem key={notification.id}>
                    <NotificationItem
                      notification={notification}
                    />
                  </AnimatedStackItem>
                ))}
              </AnimatedStack>
            </div>

            {hasMore && filter === 'all' && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={loadMoreNotifications}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Icon name="Loader" className="mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="wewrite-card p-8 text-center">
            <h3 className="text-lg font-medium mb-2">
              {filter === 'unread' ? 'No unreads' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {filter === 'unread'
                ? "You're all caught up! No unread notifications at the moment."
                : "When someone follows your pages, links to them, or adds them to their own pages, you'll see notifications here."
              }
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <NavPageLayout>
      <NotificationsContent />
    </NavPageLayout>
  );
}

// Extract the header button to avoid loading delays
function NotificationsHeaderButton() {
  const { markAllAsRead, loading } = useNotifications();
  const router = useRouter();

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleNotificationSettings = () => {
    router.push('/settings/notifications');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
          aria-label="Notification actions"
        >
          <Icon name="MoreHorizontal" size={16} />
          <span className="hidden md:inline">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleMarkAllAsRead} disabled={loading}>
          <Icon name="CheckCheck" size={16} className="mr-2" />
          Mark all as read
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNotificationSettings}>
          <Icon name="Settings" size={16} className="mr-2" />
          Notification settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
