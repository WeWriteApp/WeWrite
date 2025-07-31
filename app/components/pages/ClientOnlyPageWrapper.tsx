"use client";

import React, { useState, useEffect } from 'react';
import { ProgressivePageLoader } from '../ui/progressive-loader';

interface ClientOnlyPageWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  skeletonType?: 'page' | 'list' | 'table' | 'custom';
  customSkeleton?: React.ReactNode;
}

/**
 * ClientOnlyPageWrapper - Ensures components only render on client-side
 *
 * This wrapper prevents hydration mismatches by only rendering children
 * after the component has mounted on the client side.
 *
 * Now uses progressive loading to show page structure immediately
 * instead of a loading spinner.
 */
export function ClientOnlyPageWrapper({
  children,
  fallback,
  skeletonType = 'page',
  customSkeleton
}: ClientOnlyPageWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return fallback || (
      <ProgressivePageLoader
        isLoading={true}
        skeletonType={skeletonType}
        customSkeleton={customSkeleton}
      >
        {children}
      </ProgressivePageLoader>
    );
  }

  return <>{children}</>;
}

export default ClientOnlyPageWrapper;
