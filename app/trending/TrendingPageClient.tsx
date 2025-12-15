"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { ChevronLeft, Flame, Loader } from 'lucide-react';
import Link from 'next/link';
import PillLink from '../components/utils/PillLink';
import SimpleSparkline from '../components/utils/SimpleSparkline';
// // import { getTrendingPages } from "../firebase/pageViews";
import { useAuth } from '../providers/AuthProvider';
import { isExactDateFormat } from "../utils/dailyNoteNavigation";
import { useDateFormat } from '../contexts/DateFormatContext';
import { SubscriptionTierBadge } from "../components/ui/SubscriptionTierBadge";
import { UsernameBadge } from "../components/ui/UsernameBadge";
import { getBatchUserData } from "../firebase/batchUserData";

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  views24h?: number;
  hourlyViews: number[];
  userId?: string;
  username?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
}

export default function TrendingPageClient() {
  const router = useRouter();
  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatDateString } = useDateFormat();

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);
        console.log('TrendingPageClient: Fetching trending pages with limit: 50');

        // Get trending pages for the last 24 hours using API endpoint
        const apiResponse = await fetch('/api/trending?limit=50');
        if (!apiResponse.ok) {
          throw new Error(`API request failed: ${apiResponse.status}`);
        }
        const response = await apiResponse.json();

        // Check if we got the expected response format
        if (!response || typeof response !== 'object') {
          console.error('TrendingPageClient: Unexpected response format:', response);
          setError('Failed to load trending pages: Invalid response format');
          setLoading(false);
          return;
        }

        // Check for API error
        if (!response.success) {
          console.error('TrendingPageClient: API returned error:', response.error);
          setError(response.error || 'Failed to load trending pages');
          setLoading(false);
          setTrendingPages([]);
          return;
        }

        // Get pages from standardized API response
        const pages = response.data?.trendingPages || [];

        console.log('TrendingPageClient: Received pages:', pages.length);

        if (pages.length === 0) {
          console.log('TrendingPageClient: No trending pages found');
          setTrendingPages([]);
          setLoading(false);
          return;
        }

        // The API now provides hourlyViews data for all pages, so we can use it directly
        console.log('TrendingPageClient: Using hourly data from API');

        // Extract unique user IDs and fetch subscription data
        const uniqueUserIds = [...new Set(pages.map(page => page.userId).filter(Boolean))];

        if (uniqueUserIds.length > 0) {
          try {
            const batchUserData = await getBatchUserData(uniqueUserIds);

            // Add user data (username and subscription info) to pages
            const pagesWithUserData = pages.map(page => {
              if (!page.userId) return page;

              const userData = batchUserData[page.userId];
              return {
                ...page,
                username: userData?.username || 'Unknown User',
                tier: userData?.tier,
                subscriptionStatus: userData?.subscriptionStatus,
                subscriptionAmount: userData?.subscriptionAmount
              };
            });

            setTrendingPages(pagesWithUserData);
          } catch (subscriptionError) {
            console.error('Error fetching subscription data:', subscriptionError);
            // Still set the pages without subscription data
            setTrendingPages(pages);
          }
        } else {
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
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-center mb-6">
        <h1 className="text-2xl font-bold">
          Trending Pages
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Flame className="h-8 w-8 animate-pulse text-primary mb-4" />
            <p className="text-muted-foreground">Loading trending pages...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-sm bg-muted/50 dark:bg-muted/30 text-primary dark:text-muted-foreground rounded-lg">
          <p>{error}</p>
          <Button
            variant="secondary"
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
          <div className="hidden md:block border border-theme-strong rounded-xl overflow-hidden shadow-sm dark:bg-card/90 dark:hover:bg-card/100 w-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme-strong">
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
                        {page.title && isExactDateFormat(page.title)
                          ? formatDateString(page.title)
                          : (page.title || 'Untitled')}
                      </PillLink>
                    </td>
                    <td className="py-3 px-4">
                      {page.userId && page.username ? (
                        <UsernameBadge
                          userId={page.userId}
                          username={page.username}
                          tier={page.tier}
                          subscriptionStatus={page.subscriptionStatus}
                          subscriptionAmount={page.subscriptionAmount}
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-muted-foreground">Anonymous</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {(page.views24h !== undefined ? page.views24h : page.views).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-24 h-8 ml-auto">
                        <SimpleSparkline
                          data={page.hourlyViews}
                          height={32}
                          strokeWidth={1.5}
                          title={page.title}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view: Card grid layout */}
          <div className="md:hidden grid grid-cols-1 gap-6">
            {trendingPages.map((page) => (
              <div
                key={page.id}
                className="group block bg-card border border-theme-strong rounded-xl overflow-hidden shadow-sm dark:bg-card/90 dark:hover:bg-card/100 hover:bg-muted/30 transition-all"
                onClick={() => window.location.href = `/${page.id}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="p-5">
                  <div className="mb-3">
                    <h3 className="text-base font-medium mb-1">
                      <span className="inline-flex items-center my-0.5 text-sm font-medium rounded-lg px-2 py-0.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                        <span className="truncate">
                          {page.title && isExactDateFormat(page.title)
                            ? formatDateString(page.title)
                            : (page.title || 'Untitled')}
                        </span>
                      </span>
                    </h3>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>by{' '}</span>
                      {page.userId && page.username ? (
                        <>
                          <Link
                            href={`/u/${page.userId}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {page.username}
                          </Link>
                          <SubscriptionTierBadge
                            tier={page.tier}
                            status={page.subscriptionStatus}
                            amount={page.subscriptionAmount}
                            size="sm"
                          />
                        </>
                      ) : (
                        <span>Anonymous</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="font-medium text-lg">
                        {(page.views24h !== undefined ? page.views24h : page.views).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        views in 24h
                      </div>
                    </div>

                    <div className="w-28 h-14 bg-background/50 rounded-md p-1">
                      <SimpleSparkline
                        data={page.hourlyViews}
                        height={48}
                        strokeWidth={2}
                        title={page.title}
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