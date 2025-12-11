"use client";

import React, { Suspense } from "react";
import { RESPONSIVE_PADDING_CLASSES } from "../../constants/layout";

export interface NavPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  loadingFallback?: React.ReactNode;
  /** @deprecated maxWidth is now controlled at SidebarLayout level. Use BREAKOUT_CLASSES for full-width carousels. */
  maxWidth?: string;
}

/**
 * Standardized layout for navigation pages with progressive loading
 *
 * Provides consistent:
 * - Page structure with min-h-screen
 * - Responsive padding (px-4/6/8)
 * - Progressive content loading
 * - Bottom padding for mobile navigation
 * - Top padding for floating header clearance
 *
 * NOTE: Max-width is now controlled at the SidebarLayout level (max-w-4xl).
 * For carousels or elements that need to scroll edge-to-edge, use
 * BREAKOUT_CLASSES from constants/layout.ts.
 */
export default function NavPageLayout({
  children,
  className = "",
  loading = false,
  loadingFallback,
  maxWidth // deprecated but kept for backwards compatibility
}: NavPageLayoutProps) {

  const defaultLoadingFallback = (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Content area with padding - max-width is handled by SidebarLayout */}
      <div className={`${RESPONSIVE_PADDING_CLASSES} pb-32 md:pb-8 pt-24 ${className}`}>
        {/* Content loads progressively below header */}
        {loading ? (
          loadingFallback || defaultLoadingFallback
        ) : (
          <Suspense fallback={loadingFallback || defaultLoadingFallback}>
            {children}
          </Suspense>
        )}
      </div>
    </div>
  );
}
