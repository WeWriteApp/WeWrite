"use client";

import React, { Suspense } from "react";
import { MAX_WIDTH_CLASSES, RESPONSIVE_PADDING_CLASSES, type MaxWidthOption } from "../../constants/layout";

export interface NavPageLayoutProps {
  children: React.ReactNode;
  maxWidth?: MaxWidthOption;
  className?: string;
  loading?: boolean;
  loadingFallback?: React.ReactNode;
}

/**
 * Standardized layout for navigation pages with progressive loading
 *
 * Provides consistent:
 * - Page structure with min-h-screen
 * - Container sizing and responsive padding
 * - NavHeader integration (loads instantly)
 * - Progressive content loading below header
 * - Bottom padding for mobile navigation
 */
export default function NavPageLayout({
  children,
  maxWidth = "4xl",
  className = "",
  loading = false,
  loadingFallback
}: NavPageLayoutProps) {

  const defaultLoadingFallback = (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Content area with proper top padding to account for floating header */}
      <div className={`${MAX_WIDTH_CLASSES[maxWidth]} mx-auto ${RESPONSIVE_PADDING_CLASSES} pb-32 md:pb-8 pt-24 ${className}`}>
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
