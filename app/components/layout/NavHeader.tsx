"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";

export interface NavHeaderProps {
  title?: string;
  backUrl?: string;
  backLabel?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

/**
 * NavHeader Component
 *
 * A reusable header component for navigation in non-page views.
 */
export default function NavHeader({
  title,
  backUrl,
  backLabel = "Back",
  rightContent,
  className = ""
}: NavHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backUrl) {
      console.log("NavHeader: Navigating to backUrl:", backUrl);

      // Navigate without scrolling current page - scroll restoration handled by destination
      window.location.href = backUrl;
    } else {
      console.log("NavHeader: Going back in history");

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
    <div className={`flex flex-col mb-6 ${className}`}>
      {/* Top row with buttons on mobile, full header on desktop */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {backUrl !== undefined && (
            <Button variant="outline" size="sm" onClick={handleBack} className="mr-3">
              <ChevronLeft className="h-5 w-5 mr-2" />
              {backLabel}
            </Button>
          )}
          {/* Title only visible on desktop */}
          <h1 className="text-2xl font-bold truncate hidden md:block">
            {title}
          </h1>
        </div>

        {rightContent && (
          <div className="flex items-center">
            {rightContent}
          </div>
        )}
      </div>

      {/* Title row only visible on mobile */}
      {title && (
        <h1 className="text-2xl font-bold truncate mt-4 md:hidden">
          {title}
        </h1>
      )}

      {/* Mobile overflow sidebar functionality moved to MobileBottomNav */}
    </div>
  );
}
