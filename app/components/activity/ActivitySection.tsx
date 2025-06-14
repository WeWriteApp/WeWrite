'use client';

import React, { Suspense } from 'react';
import { ActivitySkeleton } from "../ui/skeleton-loaders";
import dynamic from 'next/dynamic';

// Dynamically import the core ActivitySection component
const ActivitySectionCore = dynamic(() => import('./ActivitySectionCore'), {
  loading: () => <ActivitySkeleton limit={4} />,
  ssr: false
});

interface ActivitySectionProps {
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * ActivitySection component with performance optimizations like lazy loading and memoization
 * This is the main ActivitySection implementation that should be used throughout the app.
 */
const ActivitySection = React.memo(function ActivitySection({
  limit = 4,
  priority = "high"
}: ActivitySectionProps) {
  return (
    <Suspense fallback={<ActivitySkeleton limit={limit} />}>
      <ActivitySectionCore />
    </Suspense>
  );
});

export default ActivitySection;
