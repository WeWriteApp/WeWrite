"use client";

import React, { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../providers/AuthProvider';
import Link from 'next/link';
import { Button } from '../../components/ui/button';

// Dynamically import React Flow to avoid SSR issues
const ReactFlowComponent = dynamic(
  () => import('./SystemDiagramFlow'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <Icon name="Loader" size={32} className="text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading diagram...</p>
        </div>
      </div>
    )
  }
);

export default function SystemDiagramPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  // Check if user is admin - use user.isAdmin from auth context for consistency
  if (!user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Desktop Header - hidden on mobile (drawer handles navigation) */}
      <div className="hidden lg:block py-4 px-4 border-b bg-background flex-shrink-0">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <Icon name="Network" size={28} className="text-primary" />
            <div>
              <h1 className="text-2xl font-bold">System Architecture</h1>
              <p className="text-muted-foreground text-sm">
                Drag nodes to rearrange, scroll to zoom, pan to navigate
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* React Flow Canvas - takes remaining height */}
      <div className="flex-1 min-h-0">
        <ReactFlowComponent />
      </div>
    </div>
  );
}
