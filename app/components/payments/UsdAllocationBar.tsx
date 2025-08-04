"use client";

import React from 'react';
import { SimpleAllocationBar } from './SimpleAllocationBar';

interface UsdAllocationBarProps {
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
 * UsdAllocationBar - Consolidated allocation bar component
 *
 * This component now uses the unified AllocationBar with the 'simple' variant
 * to provide the same functionality as the original UsdAllocationBar but with
 * shared logic, better performance, and consistent behavior.
 */
export const UsdAllocationBar = React.forwardRef<HTMLDivElement, UsdAllocationBarProps>(({
  pageId,
  pageTitle,
  authorId,
  visible = true,
  className,
  isUserAllocation = false,
  username,
}, ref) => {
  return (
    <SimpleAllocationBar
      ref={ref}
      pageId={pageId}
      pageTitle={pageTitle}
      authorId={authorId}
      visible={visible}
      className={className}
      isUserAllocation={isUserAllocation}
      username={username}
    />
  );
});

UsdAllocationBar.displayName = 'UsdAllocationBar';
