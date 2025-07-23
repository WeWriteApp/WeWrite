"use client";

import React, { useState, useEffect } from 'react';
import { SmartLoader } from '../ui/smart-loader';

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
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ClientOnlyPageWrapper;
