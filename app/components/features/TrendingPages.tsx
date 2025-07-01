'use client';

import React, { Suspense } from 'react';
import { TrendingPagesSkeleton } from '../ui/skeleton-loaders';
import dynamic from 'next/dynamic';

const TrendingPagesCore = dynamic(() => import("./TrendingPagesCore"), {
  loading: () => <TrendingPagesSkeleton limit={5} />,
  ssr: false
});

interface TrendingPagesProps {
  limit?: number;
  showSparklines?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * TrendingPages component with performance optimizations like lazy loading and memoization
 * This is the main TrendingPages implementation that should be used throughout the app.
 */
const TrendingPages = React.memo(function TrendingPages({
  limit = 5,
  showSparklines = false,
  priority = 'medium'
}: TrendingPagesProps) {
  return (
    <Suspense fallback={<TrendingPagesSkeleton limit={limit} />}>
      <TrendingPagesCore limit={limit} />
    </Suspense>
  );
});

export default TrendingPages;