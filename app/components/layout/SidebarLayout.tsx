"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { useSidebarContext } from './UnifiedSidebar';
import SiteFooter from './SiteFooter';
import { SITE_CONTENT_CONTAINER_CLASSES } from '../../constants/layout';

/**
 * SidebarLayout Component
 *
 * Provides proper layout spacing for the main content area
 * when the desktop sidebar is present. This component should
 * wrap the main content area to ensure it doesn't overlap
 * with the sidebar.
 *
 * IMPORTANT: This component applies a site-wide max-width container
 * (max-w-4xl / 1024px) to ensure consistent content alignment.
 * Pages that need full-width elements (like carousels) should use
 * the BREAKOUT_CLASSES from constants/layout.ts to break out of
 * the container while maintaining alignment.
 */
interface SidebarLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function SidebarLayout({ children, className }: SidebarLayoutProps) {
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const pathname = usePathname();

  // Check if we're on admin pages (should be full-width content, no max-width constraint)
  const isAdminPage = pathname === '/admin/dashboard' || pathname?.startsWith('/admin');

  // Calculate the actual width that should push content
  // Content should only respond to persistent expanded state, not hover state
  // When expanded: always use full width (256px) regardless of hover
  // When collapsed: always use collapsed width (64px) regardless of hover
  // NOTE: All pages need the sidebar spacer to prevent overlap, including admin pages
  const contentPushWidth = isExpanded ? sidebarWidth : sidebarWidth > 0 ? 64 : 0;

  return (
    <div className="flex min-h-screen pb-24 md:pb-8 bg-background">
      {/* Sidebar spacer - only on desktop, only pushes content for persistent expanded state */}
      <div
        className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
        style={{ width: `${contentPushWidth}px` }}
      />

      {/* Main content area with site-wide max-width container */}
      <div className={cn("flex-1 min-w-0 flex flex-col", className)}>
        <div className={cn(
          "flex-1",
          // Apply max-width container for non-admin pages
          !isAdminPage && SITE_CONTENT_CONTAINER_CLASSES
        )}>
          {children}
        </div>
        {/* Global site footer - also constrained to max-width */}
        <div className={cn(!isAdminPage && SITE_CONTENT_CONTAINER_CLASSES)}>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
