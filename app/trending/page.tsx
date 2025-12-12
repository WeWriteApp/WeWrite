import React from 'react';
import type { Metadata } from 'next';
import TrendingPageClient from './TrendingPageClient';

export const metadata: Metadata = {
  title: 'Trending Pages',
  description: 'Discover the most popular and trending content on WeWrite. See what writers and readers are engaging with right now.',
  keywords: ['trending', 'popular', 'viral content', 'hot topics', 'trending writing', 'popular articles'],
  openGraph: {
    title: 'Trending Pages on WeWrite',
    description: 'Discover the most popular and trending content on WeWrite.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Trending Pages on WeWrite',
    description: 'Discover the most popular and trending content on WeWrite.',
  },
  alternates: {
    canonical: 'https://www.getwewrite.app/trending',
  },
};

/**
 * Server component for the trending page
 * This renders the client component that will fetch trending pages
 */
export default function TrendingPage() {
  return <TrendingPageClient />;
}