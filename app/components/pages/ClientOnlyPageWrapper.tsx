"use client";

import React, { useState, useEffect } from 'react';
import UnifiedLoader from '../ui/unified-loader';

interface ClientOnlyPageWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * ClientOnlyPageWrapper - Ensures components only render on client-side
 * 
 * This wrapper prevents hydration mismatches by only rendering children
 * after the component has mounted on the client side.
 */
export function ClientOnlyPageWrapper({ 
  children, 
  fallback 
}: ClientOnlyPageWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return fallback || (
      <UnifiedLoader
        isLoading={true}
        message="Loading page..."
        fullScreen={false}
      />
    );
  }

  return <>{children}</>;
}

export default ClientOnlyPageWrapper;
