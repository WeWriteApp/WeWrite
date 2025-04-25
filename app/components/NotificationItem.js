"use client";

import React, { useContext } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Link as LinkIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotificationContext } from '../providers/NotificationProvider';
import UserBadge from './UserBadge';

/**
 * NotificationItem Component
 * 
 * Displays a single notification
 * 
 * @param {Object} props
 * @param {Object} props.notification - The notification object
 */
export default function NotificationItem({ notification }) {
  const router = useRouter();
  const { markAsRead } = useContext(NotificationContext);
  
  const handleClick = () => {
    // Mark the notification as read
    markAsRead(notification.id);
    
    // Navigate to the appropriate page
    if (notification.type === 'follow' && notification.targetPageId) {
      router.push(`/${notification.targetPageId}`);
    } else if (notification.type === 'link' && notification.targetPageId) {
      router.push(`/${notification.targetPageId}`);
    }
  };
  
  // Format the notification message based on type
  const renderNotificationContent = () => {
    switch (notification.type) {
      case 'follow':
        return (
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-1">
                <UserBadge uid={notification.sourceUserId} showUsername={true} />
              </div>
              <p className="text-sm text-muted-foreground">
                followed your page{' '}
                <span className="font-medium text-foreground">
                  {notification.targetPageTitle || 'Untitled Page'}
                </span>
              </p>
            </div>
          </div>
        );
      
      case 'link':
        return (
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-1">
                <UserBadge uid={notification.sourceUserId} showUsername={true} />
              </div>
              <p className="text-sm text-muted-foreground">
                linked to your page{' '}
                <span className="font-medium text-foreground">
                  {notification.targetPageTitle || 'Untitled Page'}
                </span>
                {notification.sourcePageTitle && (
                  <>
                    {' '}from{' '}
                    <span className="font-medium text-foreground">
                      {notification.sourcePageTitle}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                You have a new notification
              </p>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div
      className={cn(
        "p-4 border-b border-border transition-colors cursor-pointer",
        notification.read ? "bg-background" : "bg-primary/5",
        "hover:bg-muted"
      )}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {renderNotificationContent()}
        </div>
        <div className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
          {notification.createdAt && formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
