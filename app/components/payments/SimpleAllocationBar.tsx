"use client";

import React from 'react';
import { AllocationBar } from './AllocationBar';

interface SimpleAllocationBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
  // User allocation mode
  isUserAllocation?: boolean;
  username?: string;
}

/**
 * Simple allocation bar with quick amount buttons
 * 
 * This is a wrapper around AllocationBar that uses the 'simple' variant
 * to provide the same functionality as the old UsdAllocationBar component.
 * 
 * Features:
 * - Quick amount buttons (1x, 2x, 4x, 10x current allocation interval)
 * - Simple minus button
 * - Works with both logged-in and logged-out users
 * - Uses the same shared hooks and logic as AllocationBar
 */
export const SimpleAllocationBar = React.forwardRef<HTMLDivElement, SimpleAllocationBarProps>(({
  pageId,
  pageTitle,
  authorId,
  visible = true,
  className,
  isUserAllocation = false,
  username,
}, ref) => {
  return (
    <AllocationBar
      ref={ref}
      pageId={pageId}
      pageTitle={pageTitle}
      authorId={authorId}
      visible={visible}
      className={className}
      variant="simple"
      isUserAllocation={isUserAllocation}
      username={username}
    />
  );
});

SimpleAllocationBar.displayName = 'SimpleAllocationBar';

// For backward compatibility, export as UsdAllocationBar
export const UsdAllocationBar = SimpleAllocationBar;
