"use client";

import React, { useState, useEffect } from 'react';

import PillLink from "../utils/PillLink";
import { Flame, Loader } from 'lucide-react';
import SimpleSparkline from "../utils/SimpleSparkline";
// import Link from "next/link";
import { Button } from '../ui/button';
import { SubscriptionTierBadge } from '../ui/SubscriptionTierBadge';
import { UsernameBadge } from '../ui/UsernameBadge';
import { getBatchUserData } from '../../utils/apiClient';
import EmptyState from '../ui/EmptyState';
import { getEnvironmentType } from '../../utils/environmentConfig';
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
        setTrendingPages(pages);
        return;
      }

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

      setTrendingPages(pagesWithSubscriptions);
    } catch (error) {
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
          return;
        }

        localStorage.setItem(lastFetchKey, now.toString());

        setLoading(true);

        // Get trending pages for the last 24 hours using API endpoint
        const apiUrl = `/api/trending?limit=${limit}`;

        const apiResponse = await fetch(apiUrl);
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(`API request failed: ${apiResponse.status} - ${errorText}`);
        }
        const response = await apiResponse.json();

        // Check if we got the expected response format
        if (!response || typeof response !== 'object') {
          setError('Failed to load trending pages: Invalid response format');
          setLoading(false);
          return;
        }

        // Check for API error
        if (!response.success) {
          setError(response.error || 'Failed to load trending pages');
          setLoading(false);
          setTrendingPages([]);
          return;
        }

        // Get pages from standardized API response
        const pages = response.data?.trendingPages || [];

        if (pages.length === 0) {
          setTrendingPages([]);
          setLoading(false);
          return;
        }

        // Check if pages already have hourlyViews data
        const needsHourlyData = !pages[0].hourlyViews;

        if (needsHourlyData) {
          // For pages without hourly data, add fallback
          const pagesWithSparklines = pages.map((page) => {
            if (!page.hourlyViews || page.hourlyViews.length === 0) {
              // Use empty array for pages without real hourly data
              // This ensures consistent behavior - if there's no real data, show flat line
              return {
                ...page,
                hourlyViews: Array(24).fill(0)
              };
            }
            return page;
          });

          // Fetch subscription data for all users
          await fetchSubscriptionData(pagesWithSparklines);
        } else {
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

  // Listen for refresh events from the trending pages page
  useEffect(() => {
    const handleRefreshEvent = () => {
      // Force a refresh by clearing the throttle and refetching
      localStorage.removeItem('trendingPages_lastFetch');

      // Trigger a re-fetch by updating the limit state temporarily
      const fetchTrendingPages = async () => {
        try {
          setLoading(true);

          const apiUrl = `/api/trending?limit=${limit}`;
          const apiResponse = await fetch(apiUrl);
          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API request failed: ${apiResponse.status} - ${errorText}`);
          }
          const response = await apiResponse.json();

          if (!response.success) {
            setError(response.error || 'Failed to load trending pages');
            setTrendingPages([]);
            return;
          }

          const pages = response.trendingPages || [];
          await fetchSubscriptionData(pages);
        } catch (err) {
          setError(`Failed to refresh trending pages: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      fetchTrendingPages();
    };

    window.addEventListener('refreshTrendingPages', handleRefreshEvent);
    return () => {
      window.removeEventListener('refreshTrendingPages', handleRefreshEvent);
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Show structure immediately while loading */}
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Trending Pages</h2>
        </div>

        {/* Desktop skeleton */}
        <div className="hidden md:block border border-theme-strong rounded-xl overflow-hidden shadow-sm">
          <div className="border-b border-theme-strong">
            <div className="flex">
              <div className="py-2 px-4 flex-1"><div className="h-4 w-12 bg-muted rounded animate-pulse" /></div>
              <div className="py-2 px-4 flex-1"><div className="h-4 w-16 bg-muted rounded animate-pulse" /></div>
              <div className="py-2 px-4 w-32"><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto" /></div>
              <div className="py-2 px-4 w-32"><div className="h-4 w-24 bg-muted rounded animate-pulse ml-auto" /></div>
            </div>
          </div>
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="border-b border-theme-strong">
              <div className="flex">
                <div className="py-3 px-4 flex-1"><div className="h-6 w-32 bg-muted rounded animate-pulse" /></div>
                <div className="py-3 px-4 flex-1"><div className="h-5 w-24 bg-muted rounded animate-pulse" /></div>
                <div className="py-3 px-4 w-32"><div className="h-5 w-16 bg-muted rounded animate-pulse ml-auto" /></div>
                <div className="py-3 px-4 w-32"><div className="h-8 w-24 bg-muted rounded animate-pulse ml-auto" /></div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile skeleton */}
        <div className="md:hidden space-y-6">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="bg-card border border-theme-strong rounded-xl p-5">
              <div className="mb-3">
                <div className="h-6 w-40 bg-muted rounded animate-pulse mb-1" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-6 w-16 bg-muted rounded animate-pulse mb-1" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </div>
                <div className="w-28 h-14 bg-muted rounded-md animate-pulse" />
              </div>
            </div>
          ))}
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

  if (trendingPages.length === 0 && !loading) {
    return (
      <EmptyState
        icon={Flame}
        title="No trending pages yet"
        description="Pages will appear here as they gain popularity"
      />
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
            className="wewrite-card group block overflow-hidden hover:bg-[var(--card-bg-hover)] transition-all"
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
        <Button variant="secondary" asChild>
          <a href="/trending">
            View all trending pages
          </a>
        </Button>
      </div>
    </div>
  );
}