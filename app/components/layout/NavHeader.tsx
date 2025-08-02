"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { useSidebarContext } from "./UnifiedSidebar";
import { Logo } from "../ui/Logo";

export interface NavHeaderProps {
  backUrl?: string;
  backLabel?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

/**
 * NavHeader Component
 *
 * Standardized header for navigation pages with:
 * - Left: Back button
 * - Center: WeWrite logo (clickable to home)
 * - Right: Action buttons
 * - Position: Below status bar on second row
 * - No title text or icons
 */
export default function NavHeader({
  backUrl,
  backLabel = "Back",
  rightContent,
  className = ""
}: NavHeaderProps) {
  const router = useRouter();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();

  // Calculate header positioning width - should match other headers
  const headerSidebarWidth = React.useMemo(() => {
    if (isExpanded) {
      return sidebarWidth; // Use full expanded width (256px)
    } else if (sidebarWidth > 0) {
      return 64; // Use collapsed width (64px) for collapsed state
    } else {
      return 0; // No sidebar (user not authenticated)
    }
  }, [isExpanded, sidebarWidth]);

  const handleBack = () => {
    if (backUrl) {
      console.log("NavHeader: Navigating to backUrl:", backUrl);

      // Navigate without scrolling current page - scroll restoration handled by destination
      window.location.href = backUrl;
    } else {
      console.log("NavHeader: Going back in history");

      // Go to previous page - users can reach home via WeWrite logo
      // Navigate without scrolling current page - scroll restoration handled by destination

      // Try router.back() first, but fall back to window.history if needed
      try {
        router.back();
      } catch (error) {
        console.error("Navigation error:", error);
        window.history.back();
      }
    }
  };

  return (
    <div className={`flex flex-col pt-8 pb-6 ${className}`}>
      {/* Use the same layout approach as other headers for consistent spacing */}
      <div className="flex w-full">
        {/* Sidebar spacer - only on desktop, matches other headers */}
        <div
          className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
          style={{ width: `${headerSidebarWidth}px` }}
        />

        {/* Header content area - standardized navigation layout */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-3 items-center w-full h-14 px-4 sm:px-6">
            {/* Left: Back button (mobile only) */}
            <div className="flex items-center justify-start">
              {backUrl !== undefined && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  className="flex items-center gap-2 lg:hidden"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden md:inline">{backLabel}</span>
                </Button>
              )}
            </div>

            {/* Center: WeWrite logo - clickable to go home */}
            <div className="flex items-center justify-center">
              <div
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => router.push('/')}
              >
                <Logo size="md" priority={true} styled={true} clickable={true} />
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center justify-end">
              {rightContent}
            </div>
          </div>
        </div>
      </div>



      {/* Mobile overflow sidebar functionality moved to MobileBottomNav */}
    </div>
  );
}