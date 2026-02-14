"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import Link from 'next/link';
import WeWriteLogo from '../ui/WeWriteLogo';

interface PageVersionsHeaderProps {
  pageTitle: string;
  isLoading?: boolean;
}

/**
 * Clean, dedicated header for the page versions view
 * Shows only the page title and back navigation - no user info
 */
export default function PageVersionsHeader({ 
  pageTitle, 
  isLoading = false 
}: PageVersionsHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <header
      className="fixed left-0 right-0 w-full z-50 bg-background border-b"
      style={{ top: 'var(--banner-stack-height, 0px)' }}
    >
      <div className="flex flex-col max-w-4xl mx-auto">
        {/* Top row: Back button and WeWrite logo */}
        <div className="flex items-center justify-between p-4">
          {/* Back button - responsive: icon only on mobile, text on desktop */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <Icon name="ChevronLeft" size={16} />
            <span className="hidden sm:inline">Back</span>
          </Button>

          {/* WeWrite logo in center - using logged-in app styling */}
          <WeWriteLogo
            size="md"
            styled={true}
            clickable={true}
            showText={false}
            priority={true}
          />

          {/* Right spacer to balance the back button */}
          <div className="w-16"></div>
        </div>

        {/* Bottom row: Title */}
        <div className="px-4 pb-4">
          <h1 className="text-lg font-semibold text-center">
            {isLoading ? 'Loading...' : `Versions for "${pageTitle}"`}
          </h1>
        </div>
      </div>
    </header>
  );
}
