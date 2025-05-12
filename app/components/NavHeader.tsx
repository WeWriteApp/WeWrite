"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { ChevronLeft, Menu } from "lucide-react";
import { useContext } from "react";
import { DrawerContext } from "../providers/DrawerProvider";
import { useAuth } from "../providers/AuthProvider";

export interface NavHeaderProps {
  title?: string;
  backUrl?: string;
  backLabel?: string;
  rightContent?: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
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
  className = "",
  showSidebar = true
}: NavHeaderProps) {
  const router = useRouter();
  const { setIsOpen: setDrawerOpen } = useContext(DrawerContext);
  const { user } = useAuth();

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  return (
    <div className={`flex flex-col mb-6 ${className}`}>
      {/* Top row with buttons on mobile, full header on desktop */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {showSidebar && (
            <Button
              onClick={() => setDrawerOpen(true)}
              variant="outline"
              size="icon"
              aria-label="Menu"
              className="mr-3 transition-all duration-200"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
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

      {/* No longer rendering a separate Sidebar instance - using the global one */}
    </div>
  );
}
