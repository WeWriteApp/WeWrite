"use client";

import React, { useContext } from 'react';
import { NotificationContext } from '../providers/NotificationProvider';
import { cn } from '../lib/utils';

/**
 * NotificationDot Component
 * 
 * Displays a dot indicator for unread notifications
 * 
 * @param {Object} props
 * @param {string} props.className - Additional CSS classes
 */
export default function NotificationDot({ className }) {
  const { unreadCount } = useContext(NotificationContext);
  
  if (unreadCount <= 0) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        "absolute top-0 right-0 w-2 h-2 rounded-full bg-primary",
        className
      )}
      aria-hidden="true"
    />
  );
}
