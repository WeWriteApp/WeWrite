"use client";

import React, { Suspense } from "react";
import NavHeader, { NavHeaderProps } from "./NavHeader";

export interface NavPageLayoutProps extends NavHeaderProps {
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "full";
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
  loadingFallback,
  ...navHeaderProps
}: NavPageLayoutProps) {

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    "6xl": "max-w-6xl",
    full: "max-w-full"
  };

  const defaultLoadingFallback = (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 sm:px-6 lg:px-8 pb-32 md:pb-8 ${className}`}>
        {/* NavHeader loads instantly - no suspense */}
        <NavHeader {...navHeaderProps} />

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
