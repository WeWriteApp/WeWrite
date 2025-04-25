"use client";

import React, { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '../providers/AuthProvider';
import { NotificationContext } from '../providers/NotificationProvider';
import NavHeader from '../components/NavHeader';
import NotificationItem from '../components/NotificationItem';
import { Button } from '../components/ui/button';
import { Loader, Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useContext(AuthContext);
  const { 
    notifications, 
    loading, 
    hasMore, 
    loadMoreNotifications, 
    markAllAsRead 
  } = useContext(NotificationContext);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/notifications');
    }
  }, [user, authLoading, router]);
  
  // Handle "Mark all as read" button click
  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };
  
  // Show loading state while checking authentication
  if (authLoading) {
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
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <NavHeader 
        title="Notifications" 
        backUrl="/" 
        backLabel="Home"
        rightContent={
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={loading || notifications.length === 0}
            className="flex items-center gap-1"
          >
            <CheckCheck className="h-4 w-4" />
            <span>Mark all as read</span>
          </Button>
        }
      />
      
      <div className="mt-6 bg-card rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="animate-spin h-6 w-6 text-primary mr-2" />
            <span className="text-muted-foreground">Loading notifications...</span>
          </div>
        ) : notifications.length > 0 ? (
          <>
            <div className="divide-y divide-border">
              {notifications.map(notification => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                />
              ))}
            </div>
            
            {hasMore && (
              <div className="p-4 flex justify-center">
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
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No notifications yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              When someone follows your pages or links to them, you'll see notifications here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
