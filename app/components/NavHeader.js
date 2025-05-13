"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { ChevronLeft } from 'lucide-react';

/**
 * NavHeader Component
 *
 * A reusable header component for navigation in non-page views.
 *
 * @param {Object} props
 * @param {string} props.title - The title to display
 * @param {string} props.backUrl - URL to navigate to when back button is clicked
 * @param {string} props.backLabel - Label for the back button
 * @param {React.ReactNode} props.rightContent - Optional content to display on the right side
 * @param {string} props.className - Additional CSS classes
 */
export default function NavHeader({
  title,
  backUrl,
  backLabel = "Back",
  rightContent,
  className = ""
}) {
  const router = useRouter();

  const handleBack = () => {
    if (backUrl) {
      console.log("NavHeader: Navigating to backUrl:", backUrl);
      // Use window.location for more reliable navigation
      window.location.href = backUrl;
    } else {
      console.log("NavHeader: Going back in history");
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
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center">
        {backUrl !== undefined && (
          <Button variant="outline" size="sm" onClick={handleBack} className="mr-3">
            <ChevronLeft className="h-4 w-4 mr-1" />
            {backLabel}
          </Button>
        )}
      </div>

      <h1 className="text-xl font-bold truncate text-center flex-1">
        {title}
      </h1>

      {rightContent && (
        <div className="flex items-center">
          {rightContent}
        </div>
      )}
    </div>
  );
}
