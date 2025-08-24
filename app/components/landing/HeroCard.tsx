"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { AuthButton } from '../auth/AuthButton';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { ANALYTICS_EVENTS } from '../../constants/analytics-events';

// Client-side cache for platform statistics (5 minute cache)
interface PlatformStatsCache {
  data: { totalUsers: number; totalPayouts: number };
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

      if (!isNaN(userCount) && !isNaN(payoutTotal) && userCount >= 0 && payoutTotal >= 0) {
        platformStatsCache = {
          data: {
            totalUsers: userCount,
            totalPayouts: payoutTotal
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
  const [totalPayouts, setTotalPayouts] = useState<number | null>(null);
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
          setTotalPayouts(platformStatsCache.data.totalPayouts);
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

          // Validate and set payout total
          const payoutTotal = Number(statsData.totalPayouts);
          if (!isNaN(payoutTotal) && payoutTotal >= 0) {
            console.log('✅ HeroCard: Setting total payouts to:', payoutTotal);
            setTotalPayouts(payoutTotal);
          } else {
            console.error('❌ HeroCard: Invalid payout total:', statsData.totalPayouts);
            setError(`Invalid payout total received: ${statsData.totalPayouts}`);
            return;
          }

          // Cache the results for faster subsequent loads
          platformStatsCache = {
            data: {
              totalUsers: userCount,
              totalPayouts: payoutTotal
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
      <CardContent className="p-6 md:p-8 flex flex-col justify-center min-h-[500px]">
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Text */}
          <div className={`mb-8 ${fadeInClass}`}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Write, share, earn.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto">
              WeWrite is a free speech social writing app where every page is a fundraiser.
            </p>

            {/* Platform Statistics */}
            <div className="mb-8 max-w-3xl mx-auto">
              {error ? (
                <p className="text-lg text-red-600 dark:text-red-400">
                  Unable to load platform statistics: {error}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-lg md:text-xl text-muted-foreground text-center">
                    Join{' '}
                    <Badge variant="secondary" className="mx-1 text-lg md:text-xl text-muted-foreground bg-muted">
                      {isLoading || writerCount === null ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          writers
                        </span>
                      ) : (
                        `${writerCount.toLocaleString()} writers`
                      )}
                    </Badge>
                    {' '}who've made{' '}
                    <Badge variant="secondary" className="mx-1 text-lg md:text-xl text-green-100 bg-green-15 border-green-30">
                      {isLoading || totalPayouts === null ? (
                        <span className="flex items-center gap-1">
                          $<Loader2 className="h-4 w-4 animate-spin" />
                          USD
                        </span>
                      ) : (
                        `$${totalPayouts.toFixed(2)}`
                      )}
                    </Badge>
                    {' '}helping to build the future of humanity's shared knowledge.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - Always show Sign In and Sign Up */}
          <div className={`flex flex-col sm:flex-row justify-center gap-4 ${fadeInClass}`}>
            <AuthButton
              type="login"
              size="lg"
              variant="secondary"
              className="bg-muted hover:bg-muted/80 text-foreground"
              device="hero_card"
            />
            <AuthButton
              type="register"
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white"
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
