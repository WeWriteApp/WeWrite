'use client';

import React, { Suspense } from 'react';
import { TrendingPagesSkeleton } from './ui/skeleton-loaders';
import dynamic from 'next/dynamic';

// Dynamically import the original TrendingPages component
const TrendingPages = dynamic(() => import('./TrendingPages'), {
  loading: () => <TrendingPagesSkeleton limit={5} />,
  ssr: false
});

interface TrendingPagesOptimizedProps {
  limit?: number;
  showSparklines?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Optimized TrendingPages component wrapper that uses the original TrendingPages component
 * with performance optimizations like lazy loading and memoization
 */
const TrendingPagesOptimized = React.memo(function TrendingPagesOptimized({
  limit = 5,
  showSparklines = false,
  priority = 'medium'
}: TrendingPagesOptimizedProps) {
  console.log('TrendingPagesOptimized: Rendering with props:', { limit, showSparklines, priority });

  return (
    <Suspense fallback={<TrendingPagesSkeleton limit={limit} />}>
      <TrendingPages limit={limit} />
    </Suspense>
  );
});

export default TrendingPagesOptimized;
