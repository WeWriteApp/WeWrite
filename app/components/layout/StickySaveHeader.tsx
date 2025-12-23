"use client";

import React, { useEffect } from 'react';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import { useBanner } from '../../providers/BannerProvider';

interface StickySaveHeaderProps {
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isAnimatingOut?: boolean;
}

/**
 * StickySaveHeader Component
 *
 * A sticky green header that appears below system banners when there are unsaved changes.
 * Integrates with BannerProvider for unified banner stack management.
 *
 * Features:
 * - Integrated with BannerProvider for proper banner stacking
 * - Positioned at bottom of banner stack (below email/PWA/username banners)
 * - Responsive layout: full-width on mobile, right-aligned on desktop
 * - Smooth animations with no layout shifts
 * - Clean styling without shadows
 */
export default function StickySaveHeader({
  hasUnsavedChanges,
  onSave,
  onCancel,
  isSaving,
  isAnimatingOut = false
}: StickySaveHeaderProps) {
  const { setSaveBannerVisible, bannerOffset, showSaveBanner } = useBanner();

  // Calculate the position for this banner (below system banners, above save banner height)
  // The save banner height is already included in bannerOffset when showSaveBanner is true
  // So we position at (bannerOffset - 56px) to get the top of our banner
  const systemBannerOffset = showSaveBanner ? bannerOffset - 56 : bannerOffset;

  // Register visibility with BannerProvider
  useEffect(() => {
    const isVisible = hasUnsavedChanges && !isAnimatingOut;
    setSaveBannerVisible(isVisible);

    return () => {
      setSaveBannerVisible(false);
    };
  }, [hasUnsavedChanges, isAnimatingOut, setSaveBannerVisible]);

  // Don't render if no unsaved changes and not animating out
  if (!hasUnsavedChanges && !isAnimatingOut) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 w-full z-[80] transition-all duration-300 ease-out ${
        isAnimatingOut ? 'opacity-0 transform -translate-y-full' : 'opacity-100 transform translate-y-0'
      }`}
      style={{
        // Position below system banners using calculated offset
        top: `${systemBannerOffset}px`,
        height: '56px', // Fixed height for consistent spacing
        animation: hasUnsavedChanges && !isAnimatingOut ? 'slideDown 0.3s ease-out' : undefined
      }}
    >
      <div className="bg-green-600 text-white h-full flex items-center px-4">
        {/* Mobile: Horizontal buttons side by side */}
        <div className="flex gap-2 w-full md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-white hover:bg-green-700 font-medium border border-white/30 hover:border-white/50 rounded-lg flex-1"
            onClick={onCancel}
            disabled={isSaving}
          >
            <Icon name="RotateCcw" size={16} />
            Revert
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-white text-green-600 hover:bg-gray-100 font-medium rounded-lg flex-1"
            onClick={onSave}
            disabled={isSaving}
          >
            <Icon name="Check" size={16} />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* Desktop: Right-aligned button group */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-white hover:bg-green-700 font-medium border border-white/30 hover:border-white/50 rounded-lg"
            onClick={onCancel}
            disabled={isSaving}
          >
            <Icon name="RotateCcw" size={16} />
            Revert
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-white text-green-600 hover:bg-gray-100 font-medium rounded-lg"
            onClick={onSave}
            disabled={isSaving}
          >
            <Icon name="Check" size={16} />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
