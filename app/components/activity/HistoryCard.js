"use client";

import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * HistoryCard Component
 * 
 * Displays a history entry in a consistent format.
 * Used in page history view.
 * 
 * @param {Object} props
 * @param {string} props.action - The action performed (e.g., "Updated", "Created")
 * @param {string} props.username - The username of the person who performed the action
 * @param {Date|string} props.timestamp - When the action occurred
 * @param {string} props.content - Optional content associated with the action
 * @param {React.ReactNode} props.children - Optional additional content
 */
export default function HistoryCard({ 
  action, 
  username, 
  timestamp, 
  content,
  children 
}) {
  // Helper function to validate timestamp
  const isValidTimestamp = (timestamp) => {
    if (!timestamp) return false;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return !isNaN(date.getTime());
  };
  
  return (
    <div className="p-6 border-accent/20 border rounded-lg bg-accent/5">
      <div className="flex flex-col">
        <div className="text-2xl font-medium mb-1">
          {action}
        </div>
        <div className="text-muted-foreground flex items-center gap-1 mb-1">
          <span>{username}</span>
          <span className="text-xs">•</span>
          <span>{isValidTimestamp(timestamp) ? formatDistanceToNow(new Date(timestamp)) : 'some time'} ago</span>
        </div>
        {isValidTimestamp(timestamp) && (
          <div className="text-muted-foreground">
            {format(new Date(timestamp), 'MMM d, yyyy, h:mm:ss a')}
          </div>
        )}
        
        {content && (
          <div className="mt-4 p-3 border rounded bg-background/50">
            <pre className="whitespace-pre-wrap text-sm">{content}</pre>
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
}
