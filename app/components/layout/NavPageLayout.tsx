"use client";

import React, { Suspense } from "react";
import { Icon } from '@/components/ui/Icon';
import {
  RESPONSIVE_PADDING_CLASSES,
  HEADER_HEIGHTS,
  HEADER_BODY_GAP,
  getHeaderClearance,
} from "../../constants/layout";
import { useAuth } from "../../providers/AuthProvider";
import { useGlobalDrawer } from "../../providers/GlobalDrawerProvider";

export interface NavPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  loadingFallback?: React.ReactNode;
  /** @deprecated maxWidth is now controlled at SidebarLayout level. Use BREAKOUT_CLASSES for full-width carousels. */
  maxWidth?: string;
  /** When true, reduces top padding for pages where logged-out users don't have a floating header */
  reducedPaddingForLoggedOut?: boolean;
  /**
   * Specify which header type this page uses. This automatically calculates
   * the correct top padding including banner stack height + header height + gap.
   *
   * Options: 'userProfile' | 'financial' | 'contentPage'
   *
   * @example
   * <NavPageLayout header="userProfile">...</NavPageLayout>
   */
  header?: keyof typeof HEADER_HEIGHTS;
  /**
   * @deprecated Use `header` prop instead for cleaner API.
   * Custom header height in pixels - includes the gap to body content.
   */
  headerHeight?: number;
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
  maxWidth, // deprecated but kept for backwards compatibility
  reducedPaddingForLoggedOut = false,
  header,
  headerHeight
}: NavPageLayoutProps) {
  const { user } = useAuth();
  const { navigatingTo } = useGlobalDrawer();

  // Calculate the effective header clearance
  // Priority: header prop > headerHeight prop > default behavior
  const effectiveHeaderClearance = header
    ? getHeaderClearance(header)
    : headerHeight;

  // Determine top padding:
  // - header/headerHeight: use custom padding based on page's own header
  // - reducedPaddingForLoggedOut && !user: pt-6 (no floating header for logged-out)
  // - default: pt-24 (standard clearance for financial header ~96px)
  const topPaddingClass = effectiveHeaderClearance !== undefined
    ? ''
    : (reducedPaddingForLoggedOut && !user ? 'pt-6' : 'pt-24');

  // Custom padding style when header type or headerHeight is provided
  const topPaddingStyle = effectiveHeaderClearance !== undefined
    ? { paddingTop: `calc(var(--banner-stack-height, 0px) + ${effectiveHeaderClearance}px)` }
    : undefined;

  const defaultLoadingFallback = (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <Icon name="Loader" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Content area with padding - max-width is handled by SidebarLayout */}
      <div
        className={`${RESPONSIVE_PADDING_CLASSES} pb-32 lg:pb-8 ${topPaddingClass} ${className}`}
        style={topPaddingStyle}
      >
        {/* Content loads progressively below header */}
        {loading || navigatingTo ? (
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
