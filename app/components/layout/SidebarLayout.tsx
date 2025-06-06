"use client";

import React from 'react';
import { cn } from '../../lib/utils';
import { useSidebarContext } from './UnifiedSidebar';

/**
 * SidebarLayout Component
 * 
 * Provides proper layout spacing for the main content area
 * when the desktop sidebar is present. This component should
 * wrap the main content area to ensure it doesn't overlap
 * with the sidebar.
 */
interface SidebarLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function SidebarLayout({ children, className }: SidebarLayoutProps) {
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();

  // Calculate the actual width that should push content
  // Hover state should overlay (not push), so only use width for persistent expanded state
  const contentPushWidth = isExpanded && !isHovering ? sidebarWidth : sidebarWidth > 0 ? 64 : 0;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar spacer - only on desktop, only pushes content for persistent expanded state */}
      <div
        className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
        style={{ width: `${contentPushWidth}px` }}
      />

      {/* Main content area */}
      <div className={cn("flex-1 min-w-0", className)}>
        {children}
      </div>
    </div>
  );
}
