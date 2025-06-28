"use client";

import React, { useContext } from 'react';
import { NotificationContext } from '../../providers/NotificationProvider';
import { cn } from '../../lib/utils';

/**
 * NotificationBadge Component
 *
 * Displays a badge with the number of unread notifications
 *
 * @param {Object} props
 * @param {string} props.className - Additional CSS classes
 */
export default function NotificationBadge({ className }) {
  const { unreadCount } = useContext(NotificationContext);

  if (unreadCount <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-xs font-medium",
        className
      )}
      data-component="notification-badge"
      data-testid="notification-badge"
      data-count={unreadCount}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  );
}
