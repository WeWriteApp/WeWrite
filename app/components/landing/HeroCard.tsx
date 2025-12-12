"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { AuthButton } from '../auth/AuthButton';
import { Card, CardContent } from '../ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';

// Client-side cache for platform statistics (5 minute cache)
interface PlatformStatsCache {
  data: { totalUsers: number; totalPayouts: number; pagesThisMonth: number };
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
      const pagesCount = Number(statsData.pagesThisMonth);

      if (!isNaN(userCount) && !isNaN(payoutTotal) && !isNaN(pagesCount) && userCount >= 0 && payoutTotal >= 0 && pagesCount >= 0) {
        platformStatsCache = {
          data: {
            totalUsers: userCount,
            totalPayouts: payoutTotal,
            pagesThisMonth: pagesCount
          },
          timestamp: now
        };
        console.log('📦 Preloaded platform stats successfully');
      }
    }
  } catch (error) {
    console.warn('Failed to preload platform stats:', error);
  }
};

interface HeroCardProps {
  fadeInClass: string;
  platformOptions: string[];
  platformIndex: number;
  handlePlatformClick: () => void;
  platformRef: React.RefObject<HTMLSpanElement>;
}

export default function HeroCard({
  fadeInClass,
  platformOptions,
  platformIndex,
  handlePlatformClick,
  platformRef
}: HeroCardProps) {
  console.log('🎯🎯🎯 HeroCard: COMPONENT FUNCTION CALLED!');
  console.log('🎯 HeroCard: Component is rendering!');

  const { user } = useAuth();
  const analytics = useWeWriteAnalytics();
  const isAuthenticated = !!user;
  const [writerCount, setWriterCount] = useState<number | null>(null);
  const [pagesThisMonth, setPagesThisMonth] = useState<number | null>(null);
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
        console.log('🚀 HeroCard: Starting to fetch platform stats...');

        // Check client-side cache first
        const now = Date.now();
        if (platformStatsCache && (now - platformStatsCache.timestamp) < CACHE_DURATION) {
          console.log('📦 HeroCard: Using cached platform stats');
          setWriterCount(platformStatsCache.data.totalUsers);
          setPagesThisMonth(platformStatsCache.data.pagesThisMonth);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/public/platform-stats');
        console.log('🌐 HeroCard: API response status:', response.status, response.ok);

        if (response.ok) {
          const data = await response.json();
          console.log('📊 HeroCard: Platform stats received:', data);

          // Extract the actual data from the API response structure
          const statsData = data.data || data;
          console.log('📈 HeroCard: Extracted stats data:', statsData);

          // Validate and set user count
          const userCount = Number(statsData.totalUsers);
          if (!isNaN(userCount) && userCount >= 0) {
            console.log('✅ HeroCard: Setting writer count to:', userCount);
            setWriterCount(userCount);
          } else {
            console.error('❌ HeroCard: Invalid user count:', statsData.totalUsers);
            setError(`Invalid user count received: ${statsData.totalUsers}`);
            return;
          }

          // Validate and set pages this month
          const pagesCount = Number(statsData.pagesThisMonth);
          if (!isNaN(pagesCount) && pagesCount >= 0) {
            console.log('✅ HeroCard: Setting pages this month to:', pagesCount);
            setPagesThisMonth(pagesCount);
          } else {
            console.error('❌ HeroCard: Invalid pages count:', statsData.pagesThisMonth);
            setError(`Invalid pages count received: ${statsData.pagesThisMonth}`);
            return;
          }

          // Cache the results for faster subsequent loads
          platformStatsCache = {
            data: {
              totalUsers: userCount,
              totalPayouts: Number(statsData.totalPayouts),
              pagesThisMonth: pagesCount
            },
            timestamp: now
          };

          console.log('🎉 HeroCard: Successfully set both values and cached!');
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
              Write, share, earn.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto">
              WeWrite is a free speech social writing app where every page is a fundraiser.
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
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                    ) : (
                      writerCount.toLocaleString()
                    )}
                  </span>
                  {' '}writers who've written{' '}
                  <span className="font-semibold text-foreground">
                    {isLoading || pagesThisMonth === null ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                    ) : (
                      pagesThisMonth.toLocaleString()
                    )}
                  </span>
                  {' '}pages this month.
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
