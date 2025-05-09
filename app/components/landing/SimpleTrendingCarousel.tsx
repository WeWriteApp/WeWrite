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
  // Sample fallback data for trending pages
  const fallbackPages: TrendingPage[] = [
    {
      id: 'zRNwhNgIEfLFo050nyAT',
      title: 'WeWrite Roadmap',
      views: 120,
      hourlyViews: Array(24).fill(5),
      userId: 'roadmap',
      username: 'WeWrite'
    },
    {
      id: 'sample1',
      title: 'Getting Started with WeWrite',
      views: 85,
      hourlyViews: Array(24).fill(3).map((v, i) => i % 3 === 0 ? v + 2 : v),
      userId: 'guide',
      username: 'WeWrite'
    },
    {
      id: 'sample2',
      title: 'How to Create Your First Page',
      views: 65,
      hourlyViews: Array(24).fill(2).map((v, i) => i % 4 === 0 ? v + 1 : v),
      userId: 'tutorial',
      username: 'WeWrite'
    }
  ];

  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);
        console.log('SimpleTrendingCarousel: Fetching trending pages with limit', limit);

        // Fetch trending pages with limit
        const result = await getTrendingPages(limit);
        console.log('SimpleTrendingCarousel: Got result', result);

        if (result.error) {
          console.error('SimpleTrendingCarousel: Error fetching trending pages:', result.error);
          console.log('SimpleTrendingCarousel: Using fallback data due to error');
          setError(null); // Don't show error to user, use fallback data instead
          setTrendingPages(fallbackPages);
        } else if (!result.trendingPages || !Array.isArray(result.trendingPages)) {
          console.error('SimpleTrendingCarousel: Invalid trending pages data received', result);
          console.log('SimpleTrendingCarousel: Using fallback data due to invalid data');
          setError(null); // Don't show error to user, use fallback data instead
          setTrendingPages(fallbackPages);
        } else if (result.trendingPages.length === 0) {
          console.log('SimpleTrendingCarousel: No trending pages found, using fallback data');
          setTrendingPages(fallbackPages);
        } else {
          // Limit the number of pages to reduce memory usage
          const limitedPages = result.trendingPages.slice(0, Math.min(10, result.trendingPages.length));
          console.log(`SimpleTrendingCarousel: Setting ${limitedPages.length} trending pages`);
          setTrendingPages(limitedPages);
        }
      } catch (err) {
        console.error('SimpleTrendingCarousel: Exception fetching trending pages:', err);
        console.log('SimpleTrendingCarousel: Using fallback data due to error');
        setError(null); // Don't show error to user, use fallback data instead
        setTrendingPages(fallbackPages);
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
              width: '300px',
              height: '220px'
            }}
          >
            <Link href={`/${page.id}`} className="block h-full">
              <div className="wewrite-card h-full cursor-pointer flex flex-col justify-between border-0 shadow-none" style={{ transform: 'none' }}>
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
                      <Link
                        href={`/user/${page.userId}`}
                        className="hover:underline text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {page.username || 'Anonymous'}
                      </Link>
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
            </Link>
          </div>
        )
      ))}
    </ContentCarousel>
  );
}
