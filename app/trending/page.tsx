import React from 'react';
import TrendingPageClient from './TrendingPageClient';

/**
 * Server component for the trending page
 * This renders the client component that will fetch trending pages
 */
export default function TrendingPage() {
  return <TrendingPageClient />;
}
