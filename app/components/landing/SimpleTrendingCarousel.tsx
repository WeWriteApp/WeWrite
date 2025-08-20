"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import PillLink from "../utils/PillLink";
import { Sparkline } from '../ui/sparkline';
import Link from 'next/link';
import ContentCarousel from './ContentCarousel';
import { Loader } from 'lucide-react';
import { UsernameBadge } from '../ui/UsernameBadge';
import { useProductionDataFetchJson } from '../../hooks/useProductionDataFetch';
import { getBatchUserData } from '../../firebase/batchUserData';
import { AllocationControls } from '../payments/AllocationControls';
import { useAuth } from '../../providers/AuthProvider';
// import { getTrendingPages } from '../../firebase/pageViews';

interface TrendingPage {
  id: string;
  title: string;
  views: number;
  hourlyViews: number[];
  userId?: string;
  username?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
}

/**
 * Simple client-side component that fetches and renders trending pages
 */
export default function SimpleTrendingCarousel({ limit = 20 }: { limit?: number }) {
  // Empty array for trending pages - we'll fetch real data
  const fallbackPages: TrendingPage[] = [];
  const fetchJson = useProductionDataFetchJson();
  const { user } = useAuth();

  const [trendingPages, setTrendingPages] = useState<TrendingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch subscription data for users
  const fetchSubscriptionData = async (pages: TrendingPage[]) => {
    try {
      // Get unique user IDs
      const userIds = [...new Set(pages.map(page => page.userId).filter(Boolean))];

      if (userIds.length === 0) {
        console.log('SimpleTrendingCarousel: No user IDs found for subscription data');
        setTrendingPages(pages);
        return;
      }

      console.log(`SimpleTrendingCarousel: Fetching subscription data for ${userIds.length} users`);

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

      console.log('SimpleTrendingCarousel: Updated pages with subscription data');
      setTrendingPages(pagesWithSubscriptions);

    } catch (error) {
      console.error('SimpleTrendingCarousel: Error fetching subscription data:', error);
      // Fall back to pages without subscription data
      setTrendingPages(pages);
    }
  };

  useEffect(() => {
    const fetchTrendingPages = async () => {
      try {
        setLoading(true);
        console.log('SimpleTrendingCarousel: Fetching trending pages with limit', limit);

        // Use the API endpoint to get REAL trending pages (automatically uses production data for logged-out users)
        const response = await fetchJson(`/api/trending?limit=${limit}`);

        // Check for API error
        if (!response.success) {
          console.error('SimpleTrendingCarousel: API returned error:', response.error);
          setError(response.error || 'Failed to load trending pages');
          setLoading(false);
          return;
        }

        // Get pages from standardized API response
        const pages = response.data?.trendingPages || [];

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

          // Fetch subscription data for users
          await fetchSubscriptionData(limitedPages);
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
  }, [limit, fetchJson]);

  return (
    <ContentCarousel
      loading={loading}
      error={error}
      emptyMessage="No trending pages available yet. Check back soon!"
      height={280}
      scrollSpeed={0.5}
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
              height: '260px',
              marginRight: '8px'
            }}
          >
            <div
              className="block h-full cursor-pointer"
              onClick={() => window.location.href = `/${page.id}`}
            >
              <div className="wewrite-card h-full flex flex-col justify-between border-0 shadow-none" style={{ transform: 'none' }}>
                <CardHeader className="p-3">
                  <CardTitle className="text-lg mb-1 break-words h-[52px] overflow-hidden">
                    <PillLink href={`/${page.id}`}>
                      {page.title || 'Untitled'}
                    </PillLink>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    <span className="text-foreground">by{" "}</span>
                    {page.userId ? (
                      <UsernameBadge
                        userId={page.userId}
                        username={page.username || 'Anonymous'}
                        tier={page.tier}
                        subscriptionStatus={page.subscriptionStatus}
                        subscriptionAmount={page.subscriptionAmount}
                        size="sm"
                        variant="link"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-muted-foreground">Anonymous</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <div className="px-3 pb-3 pt-0 mt-auto space-y-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium">{page.views} views</span>
                    <span className="text-sm text-muted-foreground">last 24h</span>
                  </div>
                  <div className="h-8 w-full">
                    <Sparkline
                      data={page.hourlyViews}
                      height={32}
                      strokeWidth={0.8}
                      fillOpacity={0.08}
                    />
                  </div>

                  {/* Allocation controls - show for all users' pages when not viewing your own */}
                  {page.userId && page.id && (!user || user.uid !== page.userId) && (
                    <div className="pt-2 border-t border-border/20" onClick={(e) => e.stopPropagation()}>
                      <AllocationControls
                        pageId={page.id}
                        authorId={page.userId}
                        pageTitle={page.title || 'Untitled'}
                        source="TrendingCarousel"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      ))}
    </ContentCarousel>
  );
}