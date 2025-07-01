"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { PillLink } from '../utils/PillLink';
import { Sparkline } from '../ui/sparkline';
import Link from 'next/link';
import ContentCarousel from './ContentCarousel';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  hourlyViews: number[];
  userId?: string;
  username?: string;
}

/**
 * Client component that renders the trending carousel with pre-fetched data
 * This eliminates the loading state by having the data ready on initial render
 */
export default function TrendingCarouselClient({
  initialTrendingPages = [],
  initialError = null
}: {
  initialTrendingPages: TrendingPage[],
  initialError: string | null
}) {
  console.log('TrendingCarouselClient: Rendering with', {
    pageCount: initialTrendingPages.length,
    hasError: !!initialError
  });
  // If we have no data and no error, show a fallback error
  const error = initialTrendingPages.length === 0 && !initialError
    ? "Unable to load trending pages. Please try again later."
    : initialError;

  return (
    <ContentCarousel
      loading={false} // Never show loading state since we have initial data
      error={error}
      emptyMessage="No trending pages available yet. Check back soon!"
      height={220}
      scrollSpeed={0.25}
      reverseDirection={true}
      fullWidth={true}
    >
      {initialTrendingPages && initialTrendingPages.length > 0 && initialTrendingPages.map((page, index) => (
        page && page.id && (
        <div
          key={page.id}
          className="trending-page-item flex-shrink-0"
          style={{
            width: '300px',
            height: '200px'
          }}
        >
          <div
            className="block h-full cursor-pointer"
            onClick={() => window.location.href = `/${page.id}`}
          >
            <div className="wewrite-card h-full flex flex-col justify-between border-0 shadow-none" style={{ transform: 'none' }}>
              <CardHeader className="p-3">
                <CardTitle className="text-lg mb-1 break-words h-[50px] overflow-hidden">
                  <PillLink href={`/${page.id}`}>
                    {page.title || 'Untitled'}
                  </PillLink>
                </CardTitle>
                <CardDescription className="text-xs">
                  <span className="text-foreground">by{" "}</span>
                  {/* Only make the user link clickable if we have a valid userId */}
                  {page.userId ? (
                    <span
                      className="hover:underline text-primary cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/user/${page.userId}`;
                      }}
                    >
                      {page.username || 'Anonymous'}
                    </span>
                  ) : (
                    <span className="text-primary">
                      {page.username || 'Anonymous'}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <div className="px-3 pb-3 pt-0 mt-auto">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{page.views} views</span>
                  <span className="text-xs text-muted-foreground">last 24h</span>
                </div>
                <div className="h-10 w-full">
                  <Sparkline
                    data={page.hourlyViews}
                    height={40}
                    strokeWidth={0.8}
                    fillOpacity={0.08}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        )
      ))}
    </ContentCarousel>
  );
}