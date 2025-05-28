'use client';

import React, { Suspense } from 'react';
import { TopUsersSkeleton } from '../ui/skeleton-loaders';
import dynamic from 'next/dynamic';

// Dynamically import the original TopUsers component
const TopUsers = dynamic(() => import("./TopUsers"), {
  loading: () => <TopUsersSkeleton limit={10} />,
  ssr: false
});

interface TopUsersOptimizedProps {
  limit?: number;
  showActivity?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Optimized TopUsers component wrapper that uses the original TopUsers component
 * with performance optimizations like lazy loading and memoization
 */
const TopUsersOptimized = React.memo(function TopUsersOptimized({
  limit = 10,
  showActivity = false,
  priority = 'low'
}: TopUsersOptimizedProps) {
  console.log('TopUsersOptimized: Rendering with props:', { limit, showActivity, priority });

  return (
    <Suspense fallback={<TopUsersSkeleton limit={limit} />}>
      <TopUsers />
    </Suspense>
  );
});

export default TopUsersOptimized;
