"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Check, RotateCcw } from 'lucide-react';

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
 * A sticky green header that appears above the main header when there are unsaved changes.
 * Provides quick access to save/revert actions while scrolling.
 *
 * Features:
 * - Smart positioning: pushes content when at top, overlay when scrolled
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
  // SIMPLIFIED: Remove all complex scroll tracking and body class manipulation
  // Just use a simple fixed header that pushes content down consistently

  // Don't render if no unsaved changes and not animating out
  if (!hasUnsavedChanges && !isAnimatingOut) {
    return null;
  }

  // Add body class to push content down when save header is visible
  useEffect(() => {
    if (hasUnsavedChanges && !isAnimatingOut) {
      document.body.classList.add('has-sticky-save-header');
    } else {
      document.body.classList.remove('has-sticky-save-header');
    }

    return () => {
      document.body.classList.remove('has-sticky-save-header');
    };
  }, [hasUnsavedChanges, isAnimatingOut]);

  return (
    <div
      className={`fixed left-0 right-0 w-full z-[80] transition-all duration-300 ease-out ${
        isAnimatingOut ? 'opacity-0 transform -translate-y-full' : 'opacity-100 transform translate-y-0'
      }`}
      style={{
        // Position below any active banners using the unified CSS variable
        top: 'var(--banner-stack-height, 0px)',
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
            <RotateCcw className="h-4 w-4" />
            Revert
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-white text-green-600 hover:bg-gray-100 font-medium rounded-lg flex-1"
            onClick={onSave}
            disabled={isSaving}
          >
            <Check className="h-4 w-4" />
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
            <RotateCcw className="h-4 w-4" />
            Revert
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-white text-green-600 hover:bg-gray-100 font-medium rounded-lg"
            onClick={onSave}
            disabled={isSaving}
          >
            <Check className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
