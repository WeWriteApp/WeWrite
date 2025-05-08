"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { PillLink } from '../PillLink';
import { Sparkline } from '../ui/sparkline';
import { getPageViewsLast24Hours, getTrendingPages } from '../../firebase/pageViews';
import Link from 'next/link';
import { getUsernameById } from '../../utils/userUtils';
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
 * TrendingCarousel component
 *
 * A carousel that displays trending pages using the reusable ContentCarousel component.
 */
export default function TrendingCarousel({ limit = 10 }) {
  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);

        // Get trending pages for the last 24 hours
        const pages = await getTrendingPages(limit);

        // For each page, get the hourly view data for sparklines and username
        const pagesWithSparklines = await Promise.all(
          pages.map(async (page) => {
            try {
              const viewData = await getPageViewsLast24Hours(page.id);

              // Get username if userId exists
              let username = "Anonymous";
              if (page.userId) {
                try {
                  username = await getUsernameById(page.userId);
                } catch (usernameError) {
                  console.error(`Error getting username for user ${page.userId}:`, usernameError);
                }
              }

              return {
                ...page,
                hourlyViews: viewData.hourly || Array(24).fill(0),
                username: username || "Anonymous"
              };
            } catch (err) {
              console.error(`Error fetching view data for page ${page.id}:`, err);
              return {
                ...page,
                hourlyViews: Array(24).fill(0),
                username: page.username || "Anonymous"
              };
            }
          })
        );

        setTrendingPages(pagesWithSparklines);
      } catch (err) {
        console.error('Error fetching trending pages:', err);
        setError('Failed to load trending pages');
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
      scrollSpeed={0.03}
      reverseDirection={true}
      fullWidth={true}
    >
      {trendingPages.map((page, index) => (
        <div
          key={page.id}
          className="trending-page-item flex-shrink-0"
          style={{
            width: '300px',
            height: '220px'
          }}
        >
          <Link href={`/${page.id}`} className="block h-full">
            <Card className="h-full cursor-pointer flex flex-col justify-between border-0 shadow-none hover:shadow-none" style={{ transform: 'none' }}>
              <CardHeader className="p-4">
                <CardTitle className="text-lg mb-2 break-words">
                  <PillLink href={`/${page.id}`}>
                    {page.title || 'Untitled'}
                  </PillLink>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  <span className="text-foreground">by{" "}</span>
                  <Link
                    href={`/user/${page.userId}`}
                    className="hover:underline text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {page.username || 'Anonymous'}
                  </Link>
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
            </Card>
          </Link>
        </div>
      ))}
    </ContentCarousel>
  );
}
