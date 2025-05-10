"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { PillLink } from '../PillLink';
import { Sparkline } from '../ui/sparkline';
import Link from 'next/link';
import ContentCarousel from './ContentCarousel';
import { Loader } from 'lucide-react';
import { getTrendingPages } from '../../firebase/pageViews';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  hourlyViews: number[];
  userId?: string;
  username?: string;
}

/**
 * Simple client-side component that fetches and renders trending pages
 */
export default function SimpleTrendingCarousel({ limit = 20 }: { limit?: number }) {
  // Empty array for trending pages - we'll fetch real data
  const fallbackPages: TrendingPage[] = [];

  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);
        console.log('SimpleTrendingCarousel: Fetching trending pages with limit', limit);

        // Use the same function as the logged-in home page to get REAL trending pages
        const response = await getTrendingPages(limit);

        // Handle different response formats
        let pages = [];
        if (Array.isArray(response)) {
          pages = response;
        } else if (response && typeof response === 'object' && Array.isArray(response.trendingPages)) {
          pages = response.trendingPages;
        }

        console.log('SimpleTrendingCarousel: Raw response:', response);
        console.log('SimpleTrendingCarousel: Processed pages:', pages);

        if (!pages || !Array.isArray(pages) || pages.length === 0) {
          console.log('SimpleTrendingCarousel: No trending pages found or invalid format');
          setError(pages.length === 0 ? null : 'No trending pages available');
          setTrendingPages([]);
        } else {
          // Use all available pages, up to a reasonable limit
          const limitedPages = pages.slice(0, Math.min(20, pages.length));
          console.log(`SimpleTrendingCarousel: Setting ${limitedPages.length} trending pages`);
          console.log('Page sample:', limitedPages[0]);
          setTrendingPages(limitedPages);
        }
      } catch (err) {
        console.error('SimpleTrendingCarousel: Exception fetching trending pages:', err);
        setError('Failed to load trending pages');
        setTrendingPages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingPages();
  }, [limit]);

  return (
    <ContentCarousel
      loading={loading}
      error={error}
      emptyMessage="No trending pages available yet. Check back soon!"
      height={240}
      scrollSpeed={0.10}
      reverseDirection={true}
      fullWidth={true}
    >
      {trendingPages && trendingPages.length > 0 && trendingPages.map((page, index) => (
        page && page.id && (
          <div
            key={page.id}
            className="trending-page-item flex-shrink-0"
            style={{
              width: '280px',
              height: '220px',
              marginRight: '8px'
            }}
          >
            <div
              className="block h-full cursor-pointer"
              onClick={() => window.location.href = `/${page.id}`}
            >
              <div className="wewrite-card h-full flex flex-col justify-between border-0 shadow-none" style={{ transform: 'none' }}>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg mb-2 break-words h-[56px] overflow-hidden">
                    <PillLink href={`/${page.id}`}>
                      {page.title || 'Untitled'}
                    </PillLink>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
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
                <div className="px-4 pb-4 pt-0 mt-auto">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{page.views} views</span>
                    <span className="text-sm text-muted-foreground">last 24h</span>
                  </div>
                  <div className="h-12 w-full pb-1">
                    <Sparkline
                      data={page.hourlyViews}
                      height={44}
                      color="#1768FF"
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
