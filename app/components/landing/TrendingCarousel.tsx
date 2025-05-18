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
        setError(null); // Clear any previous errors

        // Get trending pages for the last 24 hours
        console.log('Fetching trending pages with limit:', limit);
        const pages = await getTrendingPages(limit);

        if (!pages || pages.length === 0) {
          console.log('No trending pages returned');
          setTrendingPages([]);
          setLoading(false);
          return;
        }

        console.log(`Fetched ${pages.length} trending pages`);

        // For each page, get the hourly view data for sparklines and username
        const pagesWithSparklines = await Promise.all(
          pages.map(async (page) => {
            try {
              if (!page || !page.id) {
                console.error('Invalid page object:', page);
                return null;
              }

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

        // Filter out any null values
        const validPages = pagesWithSparklines.filter(page => page !== null);
        console.log(`Processed ${validPages.length} valid trending pages`);

        setTrendingPages(validPages);
      } catch (err) {
        console.error('Error fetching trending pages:', err);
        setError(`Failed to load trending pages: ${err.message || 'Unknown error'}`);
        // Set empty array to prevent rendering issues
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
      height={220}
      scrollSpeed={0.25}
      reverseDirection={true}
      fullWidth={true}
    >
      {trendingPages.map((page, index) => (
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
                    color="#1768FF"
                    strokeWidth={0.8}
                    fillOpacity={0.08}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </ContentCarousel>
  );
}
