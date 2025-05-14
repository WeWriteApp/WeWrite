"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { ChevronLeft, Flame, Loader } from 'lucide-react';
import Link from 'next/link';
import PillLink from '../components/PillLink';
import SimpleSparkline from '../components/SimpleSparkline';
import { getTrendingPages, getPageViewsLast24Hours } from '../firebase/pageViews';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  hourlyViews: number[];
  userId?: string;
  username?: string;
}

export default function TrendingPageClient() {
  const router = useRouter();
  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);
        console.log('TrendingPageClient: Fetching trending pages with limit: 50');

        // Get trending pages for the last 24 hours
        const response = await getTrendingPages(50);

        // Check if we got the expected response format
        if (!response || typeof response !== 'object') {
          console.error('TrendingPageClient: Unexpected response format:', response);
          setError('Failed to load trending pages: Invalid response format');
          setLoading(false);
          return;
        }

        // Handle both old and new response formats
        const pages = Array.isArray(response)
          ? response
          : (response.trendingPages || []);

        console.log('TrendingPageClient: Received pages:', pages.length);

        if (pages.length === 0) {
          console.log('TrendingPageClient: No trending pages found');
          setTrendingPages([]);
          setLoading(false);
          return;
        }

        // Check if pages already have hourlyViews data
        const needsHourlyData = !pages[0].hourlyViews;

        if (needsHourlyData) {
          console.log('TrendingPageClient: Fetching hourly view data for pages');
          // For each page, get the hourly view data for sparklines
          const pagesWithSparklines = await Promise.all(
            pages.map(async (page) => {
              try {
                const viewData = await getPageViewsLast24Hours(page.id);
                return {
                  ...page,
                  hourlyViews: viewData.hourly || Array(24).fill(0)
                };
              } catch (err) {
                console.error(`Error fetching view data for page ${page.id}:`, err);
                return {
                  ...page,
                  hourlyViews: Array(24).fill(0)
                };
              }
            })
          );

          console.log('TrendingPageClient: Setting trending pages with sparklines');
          setTrendingPages(pagesWithSparklines);
        } else {
          console.log('TrendingPageClient: Pages already have hourly data');
          setTrendingPages(pages);
        }
      } catch (err) {
        console.error('Error fetching trending pages:', err);
        setError(`Failed to load trending pages: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingPages();
  }, []);

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              // Use router.back() with a fallback to home page
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push('/');
              }
            } catch (error) {
              console.error("Navigation error:", error);
              // Fallback to home page if there's any error
              router.push('/');
            }
          }}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-bold flex items-center absolute left-1/2 transform -translate-x-1/2">
          <Flame className="mr-2 h-5 w-5" />
          Trending Pages
        </h1>

        {/* Empty div to balance layout */}
        <div className="w-[73px]" />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Flame className="h-8 w-8 animate-pulse text-primary mb-4" />
            <p className="text-muted-foreground">Loading trending pages...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      ) : trendingPages.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No trending pages to display</p>
        </div>
      ) : (
        <>
          {/* Desktop view: Table layout (hidden on mobile) */}
          <div className="hidden md:block border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Page</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Author</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Views (24h)</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Activity (24h)</th>
                </tr>
              </thead>
              <tbody>
                {trendingPages.map((page) => (
                  <tr
                    key={page.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/${page.id}`}
                  >
                    <td className="py-3 px-4">
                      <PillLink href={`/${page.id}`}>
                        {page.title || 'Untitled'}
                      </PillLink>
                    </td>
                    <td className="py-3 px-4">
                      {page.userId && page.username ? (
                        <Link
                          href={`/user/${page.userId}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {page.username}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Anonymous</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {page.views.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-24 h-8 ml-auto">
                        <SimpleSparkline
                          data={page.hourlyViews}
                          height={32}
                          strokeWidth={1.5}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view: Card grid layout */}
          <div className="md:hidden grid grid-cols-1 gap-4">
            {trendingPages.map((page) => (
              <div
                key={page.id}
                className="group block bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                onClick={() => window.location.href = `/${page.id}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="p-4">
                  <div className="mb-3">
                    <h3 className="text-base font-medium mb-1">
                      <span className="inline-flex items-center my-0.5 text-sm font-medium rounded-lg px-2 py-0.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                        <span className="truncate">{page.title || 'Untitled'}</span>
                      </span>
                    </h3>
                    <div className="text-sm text-muted-foreground">
                      by{' '}
                      {page.userId && page.username ? (
                        <Link
                          href={`/user/${page.userId}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {page.username}
                        </Link>
                      ) : (
                        <span>Anonymous</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="font-medium text-lg">
                        {page.views.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        views in 24h
                      </div>
                    </div>

                    <div className="w-28 h-14 bg-background/50 rounded-md p-1">
                      <SimpleSparkline
                        data={page.hourlyViews}
                        height={48}
                        color="#1768FF"
                        strokeWidth={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
