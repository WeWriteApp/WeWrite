"use client";

import React, { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { useNotifications } from "../providers/NotificationProvider";
import NavHeader from '../components/layout/NavHeader';
import NotificationItem from '../components/utils/NotificationItem';
import { Button } from '../components/ui/button';
import { NotificationListSkeleton } from '../components/ui/skeleton';
import { Loader, CheckCheck, ChevronLeft } from 'lucide-react';
import { useWeWriteAnalytics } from '../hooks/useWeWriteAnalytics';

function NotificationsContent() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const {
    notifications,
    loading,
    hasMore,
    loadMoreNotifications,
    markAllAsRead
  } = useNotifications();
  const { trackNotificationInteraction } = useWeWriteAnalytics();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/notifications');
    }
  }, [isAuthenticated, router]);

  // Notifications are automatically loaded by the NotificationProvider when user changes

  // Handle "Mark all as read" button click
  const handleMarkAllAsRead = async () => {
    try {
      console.log('handleMarkAllAsRead clicked - current notifications:', notifications.map(n => ({ id: n.id, read: n.read })));

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
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  // Show loading state while fetching notifications
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        {/* Back button - icon only on mobile, text + icon on desktop */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            console.log("Direct navigation to home");
            window.location.href = "/";
          }}
          className="flex items-center gap-1 md:gap-1 md:px-3 px-2"
          aria-label="Go back to home"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden md:inline">Home</span>
        </Button>

        <h1 className="text-xl md:text-2xl font-bold text-center flex-1 mx-2">Notifications</h1>

        {/* Mark all as read button - icon only on mobile, text + icon on desktop */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllAsRead}
          disabled={loading}
          className="flex items-center gap-1 md:gap-1 md:px-3 px-2"
          aria-label="Mark all notifications as read"
        >
          <CheckCheck className="h-4 w-4" />
          <span className="hidden md:inline">Mark all as read</span>
        </Button>
      </div>

      <div className="mt-6">
        {loading && notifications.length === 0 ? (
          <NotificationListSkeleton count={5} />
        ) : notifications.length > 0 ? (
          <>
            <div className="space-y-4">
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMoreNotifications}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin h-4 w-4 mr-2" />
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
          <div className="bg-card rounded-xl border-theme-strong shadow-sm p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No notifications yet</h3>
            <p className="text-sm text-foreground opacity-80 max-w-md mx-auto">
              When someone follows your pages, links to them, or adds them to their own pages, you'll see notifications here.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          </div>
        </div>
      </div>
    }>
      <NotificationsContent />
    </Suspense>
  );
}