"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { useSidebarContext } from './UnifiedSidebar';
import SiteFooter from './SiteFooter';

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
  const pathname = usePathname();

  // Check if we're on admin dashboard (should be full-width)
  const isAdminDashboard = pathname === '/admin/dashboard';

  // Calculate the actual width that should push content
  // Content should only respond to persistent expanded state, not hover state
  // When expanded: always use full width (256px) regardless of hover
  // When collapsed: always use collapsed width (64px) regardless of hover
  // Admin dashboard: always full-width (no sidebar spacer)
  const contentPushWidth = isAdminDashboard ? 0 : (isExpanded ? sidebarWidth : sidebarWidth > 0 ? 64 : 0);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar spacer - only on desktop, only pushes content for persistent expanded state */}
      <div
        className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
        style={{ width: `${contentPushWidth}px` }}
      />

      {/* Main content area */}
      <div className={cn("flex-1 min-w-0 flex flex-col", className)}>
        <div className="flex-1">
          {children}
        </div>
        {/* Global site footer */}
        <SiteFooter />
      </div>
    </div>
  );
}