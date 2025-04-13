"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { ChevronLeft, Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useState, useEffect } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center">
        {showSidebar && (
          <Button
            onClick={() => setSidebarOpen(true)}
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
        <h1 className="text-2xl font-bold truncate">
          {title}
        </h1>
      </div>

      {rightContent && (
        <div className="flex items-center">
          {rightContent}
        </div>
      )}

      {/* Render the sidebar outside the main layout */}
      {showSidebar && user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
    </div>
  );
}
