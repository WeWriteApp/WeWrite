'use client';

import React, { Suspense } from 'react';
import { ActivitySkeleton } from "../ui/skeleton-loaders';
import dynamic from 'next/dynamic';

// Dynamically import the original ActivitySection component
const ActivitySection = dynamic(() => import('./ActivitySection'), {
  loading: () => <ActivitySkeleton limit={4} />,
  ssr: false
});

interface ActivitySectionOptimizedProps {
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Optimized ActivitySection component wrapper that uses the original ActivitySection component
 * with performance optimizations like lazy loading and memoization
 */
const ActivitySectionOptimized = React.memo(function ActivitySectionOptimized({
  limit = 4,
  priority = "high"
}: ActivitySectionOptimizedProps) {
  console.log('ActivitySectionOptimized: Rendering with props:', { limit, priority });

  return (
    <Suspense fallback={<ActivitySkeleton limit={limit} />}>
      <ActivitySection />
    </Suspense>
  );
});

export default ActivitySectionOptimized;
