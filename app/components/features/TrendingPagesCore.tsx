"use client";

import React, { useState, useEffect } from 'react';

import PillLink from "../utils/PillLink";
import { Flame, Loader } from 'lucide-react';
import SimpleSparkline from "../utils/SimpleSparkline";
// import Link from "next/link";
import { Button } from '../ui/button';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { UsernameBadge } from '../ui/UsernameBadge';
import { getBatchUserData } from '../../firebase/batchUserData';
// import { getTrendingPages } from '../../firebase/pageViews';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  views24h?: number;
  hourlyViews: number[];
  userId?: string;
  username?: string;
}

interface TrendingPagesResponse {
  trendingPages?: TrendingPage[];
  error?: string;
}

export default function TrendingPages({ limit = 5 }) {
  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch subscription data for users
  const fetchSubscriptionData = async (pages) => {
    try {
      // Get unique user IDs
      const userIds = [...new Set(pages.map(page => page.userId).filter(Boolean))];

      if (userIds.length === 0) {
        console.log('TrendingPagesCore: No user IDs found for subscription data');
        setTrendingPages(pages);
        return;
      }

      console.log(`TrendingPagesCore: Fetching subscription data for ${userIds.length} users`);

      // Fetch user data with subscription information
      const userData = await getBatchUserData(userIds);

      // Merge subscription data with pages
      const pagesWithSubscriptions = pages.map(page => ({
        ...page,
        tier: page.userId ? userData[page.userId]?.tier : null,
        subscriptionStatus: page.userId ? userData[page.userId]?.subscriptionStatus : null,
        subscriptionAmount: page.userId ? userData[page.userId]?.subscriptionAmount : null,
        username: page.userId ? (userData[page.userId]?.username || page.username) : page.username
      }));

      console.log('TrendingPagesCore: Successfully merged subscription data');
      setTrendingPages(pagesWithSubscriptions);
    } catch (error) {
      console.error('TrendingPagesCore: Error fetching subscription data:', error);
      // Set pages without subscription data as fallback
      setTrendingPages(pages);
    }
  };

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        // Prevent excessive API calls - throttle to max once per 30 seconds
        const now = Date.now();
        const lastFetchKey = 'trendingPages_lastFetch';
        const lastFetch = parseInt(localStorage.getItem(lastFetchKey) || '0');

        if ((now - lastFetch) < 30000) {
          console.log('TrendingPages: Throttling API call, too recent');
          return;
        }

        localStorage.setItem(lastFetchKey, now.toString());

        setLoading(true);
        console.log('TrendingPages: Fetching trending pages with limit:', limit);

        // Get trending pages for the last 24 hours using API endpoint
        const apiResponse = await fetch(`/api/trending?limit=${limit}`);
        if (!apiResponse.ok) {
          throw new Error(`API request failed: ${apiResponse.status}`);
        }
        const response = await apiResponse.json();

        // Check if we got the expected response format
        if (!response || typeof response !== 'object') {
          console.error('TrendingPages: Unexpected response format:', response);
          setError('Failed to load trending pages: Invalid response format');
          setLoading(false);
          return;
        }

        // Check for API error
        if (!response.success) {
          console.error('TrendingPages: API returned error:', response.error);
          setError(response.error || 'Failed to load trending pages');
          setLoading(false);
          setTrendingPages([]);
          return;
        }

        // Get pages from standardized API response
        const pages = response.data?.trendingPages || [];

        console.log('TrendingPages: Received pages:', pages.length);

        if (pages.length === 0) {
          console.log('TrendingPages: No trending pages found');
          setTrendingPages([]);
          setLoading(false);
          return;
        }

        // Check if pages already have hourlyViews data
        const needsHourlyData = !pages[0].hourlyViews;

        if (needsHourlyData) {
          console.log('TrendingPages: Adding fallback hourly data for pages without sparklines');
          // For pages without hourly data, add fallback
          const pagesWithSparklines = pages.map((page) => {
            if (!page.hourlyViews || page.hourlyViews.length === 0) {
              console.log(`Adding fallback hourly data for page ${page.id}`);
              // Use empty array for pages without real hourly data
              // This ensures consistent behavior - if there's no real data, show flat line
              return {
                ...page,
                hourlyViews: Array(24).fill(0)
              };
            }
            return page;
          });

          console.log('TrendingPages: Setting trending pages with consistent hourly data');

          // Fetch subscription data for all users
          await fetchSubscriptionData(pagesWithSparklines);
        } else {
          console.log('TrendingPages: Pages already have hourly data');

          // Fetch subscription data for all users
          await fetchSubscriptionData(pages);
        }
      } catch (err) {
        console.error('Error fetching trending pages:', err);
        setError(`Failed to load trending pages: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingPages();
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center items-center py-8">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="border border-theme-medium rounded-lg overflow-hidden">
          <div className="text-destructive p-4 text-center">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (trendingPages.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border border-theme-medium rounded-lg overflow-hidden">
          <div className="text-muted-foreground p-4 text-center">
            No trending pages found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Desktop view (md and up): Table layout */}
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
                className="border-b border-theme-strong hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/${page.id}`}
              >
                <td className="py-3 px-4">
                  <PillLink href={`/${page.id}`} className="">
                    {page.title || 'Untitled'}
                  </PillLink>
                </td>
                <td className="py-3 px-4">
                  {page.userId ? (
                    <UsernameBadge
                      userId={page.userId}
                      username={page.username || 'Anonymous'}
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
                  {page.views.toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <div className="w-24 h-8 ml-auto">
                    <SimpleSparkline
                      data={page.hourlyViews}
                      height={32}
                      strokeWidth={1.5}
                      color="currentColor"
                      title="24h Activity"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view (smaller than md): Card grid layout */}
      <div className="md:hidden grid grid-cols-1 gap-6">
        {trendingPages.map((page) => (
          <div
            key={page.id}
            className="group block bg-card border border-theme-strong rounded-xl overflow-hidden shadow-sm dark:bg-card/90 dark:hover:bg-card/100 hover:bg-muted/30 transition-all p-5"
            onClick={() => window.location.href = `/${page.id}`}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <div className="mb-3">
                <h3 className="text-base font-medium mb-1">
                  <PillLink href={`/${page.id}`} className="">
                    {page.title || 'Untitled'}
                  </PillLink>
                </h3>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>by{' '}</span>
                  {page.userId ? (
                    <>
                      <span
                        className="text-primary hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/user/${page.userId}`;
                        }}
                      >
                        {page.username || 'Anonymous'}
                      </span>
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
                    {page.views24h ? page.views24h.toLocaleString() : page.views.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    views in 24h
                  </div>
                </div>

                <div className="w-28 h-14 bg-background/50 rounded-md p-1">
                  <SimpleSparkline
                    data={page.hourlyViews}
                    height={48}
                    strokeWidth={2}
                    color="currentColor"
                    title="24h Activity"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All button */}
      <div className="flex justify-center mt-4">
        <Button variant="outline" asChild>
          <a href="/trending">
            View all trending pages
          </a>
        </Button>
      </div>
    </div>
  );
}