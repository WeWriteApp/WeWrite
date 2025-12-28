"use client";

import React, { useEffect, useState } from 'react';
import ContentCarousel from './ContentCarousel';
import { LandingCard, LandingCardText } from './LandingCard';
import { Icon } from '@/components/ui/Icon';

interface PlatformStat {
  id: string;
  label: string;
  icon: 'FileText' | 'Link2' | 'Users' | 'Share2' | 'DollarSign';
  value: string;
  suffix?: string;
}

/**
 * PlatformStatsCarousel - Shows real platform statistics in a horizontally scrolling carousel
 *
 * Displays accurate, truthful stats from the production database:
 * - Total Users (from users collection)
 * - Total Payouts (from writerUsdEarnings collection)
 * - Pages This Month (from pages collection)
 */
export default function PlatformStatsCarousel() {
  const [stats, setStats] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatformStats = async () => {
      try {
        setLoading(true);

        const response = await fetch('/api/public/platform-stats');
        const data = await response.json();

        if (!data.success) {
          console.error('PlatformStatsCarousel: API returned error:', data.error);
          setError(data.error || 'Failed to load platform statistics');
          setLoading(false);
          return;
        }

        // Extract stats from API response - only show real data
        const apiStats = data.data;

        const statsData: PlatformStat[] = [
          {
            id: 'users',
            label: 'Total Users',
            icon: 'Users',
            value: (apiStats.totalUsers || 0).toLocaleString(),
          },
          {
            id: 'payouts',
            label: 'Total Payouts',
            icon: 'DollarSign',
            value: `$${(apiStats.totalPayouts || 0).toLocaleString()}`,
          },
          {
            id: 'pages-month',
            label: 'Pages This Month',
            icon: 'FileText',
            value: (apiStats.pagesThisMonth || 0).toLocaleString(),
          },
        ];

        setStats(statsData);
        setError(null);
      } catch (err) {
        console.error('PlatformStatsCarousel: Exception fetching stats:', err);
        setError('Failed to load platform statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatformStats();
  }, []);

  return (
    <ContentCarousel
      loading={loading}
      error={error}
      emptyMessage="Platform statistics are not available at this time"
      height={120}
      scrollSpeed={0.35}
      reverseDirection={false}
      fullWidth={true}
    >
      {stats.map((stat) => (
        <div
          key={stat.id}
          className="flex-shrink-0"
          style={{
            width: '220px',
            height: '100px',
            marginRight: '8px'
          }}
        >
          <LandingCard
            className="h-full"
            hoverable={false}
            padding="md"
            rounded="xl"
          >
            <div className="flex flex-col h-full justify-center">
              {/* Label */}
              <LandingCardText
                muted
                className="text-xs font-medium uppercase tracking-wide mb-1"
                as="span"
              >
                {stat.label}
              </LandingCardText>

              {/* Value - large number */}
              <LandingCardText
                className="text-2xl font-bold tabular-nums"
                as="div"
              >
                {stat.value}
              </LandingCardText>
            </div>
          </LandingCard>
        </div>
      ))}
    </ContentCarousel>
  );
}
