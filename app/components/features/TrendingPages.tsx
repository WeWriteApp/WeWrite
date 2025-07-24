'use client';

import React from 'react';

import TrendingPagesCore from "./TrendingPagesCore";

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
    <TrendingPagesCore limit={limit} />
  );
});

export default TrendingPages;