"use client";

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { AuthButton } from '../auth/AuthButton';
import { Card, CardContent } from '../ui/card';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';

// Client-side cache for platform statistics (5 minute cache)
interface PlatformStatsCache {
  data: { totalUsers: number; totalPayouts: number; pagesLast30Days: number };
  timestamp: number;
}

let platformStatsCache: PlatformStatsCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Preload function to start fetching stats early
const preloadPlatformStats = async () => {
  try {
    const now = Date.now();
    if (platformStatsCache && (now - platformStatsCache.timestamp) < CACHE_DURATION) {
      return; // Already cached
    }

    const response = await fetch('/api/public/platform-stats');
    if (response.ok) {
      const data = await response.json();
      const statsData = data.data || data;

      const userCount = Number(statsData.totalUsers);
      const payoutTotal = Number(statsData.totalPayouts);
      const pagesCount = Number(statsData.pagesLast30Days);

      if (!isNaN(userCount) && !isNaN(payoutTotal) && !isNaN(pagesCount) && userCount >= 0 && payoutTotal >= 0 && pagesCount >= 0) {
        platformStatsCache = {
          data: {
            totalUsers: userCount,
            totalPayouts: payoutTotal,
            pagesLast30Days: pagesCount
          },
          timestamp: now
        };
      }
    }
  } catch {
    // Silently fail on preload - stats will be fetched on component mount
  }
};

interface HeroCardProps {
  fadeInClass: string;
  platformOptions: string[];
  platformIndex: number;
  handlePlatformClick: () => void;
  platformRef: React.RefObject<HTMLSpanElement>;
  // Optional vertical-specific hero text overrides
  heroTitle?: string;
  heroSubtitle?: string;
}

export default function HeroCard({
  fadeInClass,
  platformOptions,
  platformIndex,
  handlePlatformClick,
  platformRef,
  heroTitle = 'Write, share, earn.',
  heroSubtitle = 'WeWrite is a free speech social writing app where every page is a fundraiser.',
}: HeroCardProps) {
  const { user } = useAuth();
  const analytics = useWeWriteAnalytics();
  const isAuthenticated = !!user;
  const [writerCount, setWriterCount] = useState<number | null>(null);
  const [pagesLast30Days, setPagesLast30Days] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start preloading stats immediately when component mounts
  useEffect(() => {
    preloadPlatformStats();
  }, []);

  // Fetch accurate writer count and total payouts from production collections
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Check client-side cache first
        const now = Date.now();
        if (platformStatsCache && (now - platformStatsCache.timestamp) < CACHE_DURATION) {
          setWriterCount(platformStatsCache.data.totalUsers);
          setPagesLast30Days(platformStatsCache.data.pagesLast30Days);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/public/platform-stats');

        if (response.ok) {
          const data = await response.json();
          const statsData = data.data || data;

          // Validate and set user count
          const userCount = Number(statsData.totalUsers);
          if (!isNaN(userCount) && userCount >= 0) {
            setWriterCount(userCount);
          } else {
            setError(`Invalid user count received: ${statsData.totalUsers}`);
            return;
          }

          // Validate and set pages in last 30 days
          const pagesCount = Number(statsData.pagesLast30Days);
          if (!isNaN(pagesCount) && pagesCount >= 0) {
            setPagesLast30Days(pagesCount);
          } else {
            setError(`Invalid pages count received: ${statsData.pagesLast30Days}`);
            return;
          }

          // Cache the results for faster subsequent loads
          platformStatsCache = {
            data: {
              totalUsers: userCount,
              totalPayouts: Number(statsData.totalPayouts),
              pagesLast30Days: pagesCount
            },
            timestamp: now
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(`Failed to fetch stats: ${errorData.error || response.statusText}`);
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
        setError('Unable to load platform statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <Card className="h-full wewrite-card">
      <CardContent className="p-2 md:p-3 flex flex-col justify-center min-h-[280px]">
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Text */}
          <div className={`mb-4 ${fadeInClass}`}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              {heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto">
              {heroSubtitle}
            </p>

            {/* Platform Statistics */}
            <div className="mb-4 max-w-3xl mx-auto">
              {error ? (
                <p className="text-xl md:text-2xl text-red-600 dark:text-red-400">
                  Unable to load platform statistics: {error}
                </p>
              ) : (
                <p className="text-xl md:text-2xl text-muted-foreground text-center">
                  Join{' '}
                  <span className="font-semibold text-foreground">
                    {isLoading || writerCount === null ? (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="Loader" />
                      </span>
                    ) : (
                      writerCount.toLocaleString()
                    )}
                  </span>
                  {' '}writers who've written{' '}
                  <span className="font-semibold text-foreground">
                    {isLoading || pagesLast30Days === null ? (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="Loader" />
                      </span>
                    ) : (
                      pagesLast30Days.toLocaleString()
                    )}
                  </span>
                  {' '}pages in the last 30 days.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons - Always show Sign In and Sign Up */}
          <div className={`flex flex-row gap-4 w-full ${fadeInClass}`}>
            <AuthButton
              type="login"
              size="lg"
              variant="secondary"
              className="flex-1"
              device="hero_card"
            />
            <AuthButton
              type="register"
              size="lg"
              variant="default"
              className="flex-1"
              device="hero_card"
            >
              Sign Up
            </AuthButton>
          </div>


        </div>
      </CardContent>
    </Card>
  );
}
