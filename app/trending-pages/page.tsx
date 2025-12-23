"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import TrendingPages from '../components/features/TrendingPages';

/**
 * Trending Pages Full Page Experience
 * 
 * Dedicated page for discovering trending pages with enhanced functionality:
 * - Full page layout with header
 * - Enhanced trending pages component with more results
 * - Analytics and insights
 * - Better discovery experience for popular content
 */
export default function TrendingPagesPage() {
  const { user, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);



  // Show progressive loading state during hydration
  if (!mounted) {
    return null; // Let NavPageLayout handle loading
  }

  return (
    <NavPageLayout>
      {/* Page Header with Controls */}
      <div className="mb-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">Trending Pages</h1>
        </div>

        <p className="text-muted-foreground text-lg">
          Discover the most popular and trending content on WeWrite. See what's capturing attention right now.
        </p>
      </div>

      {/* Trending Pages Content */}
      <div className="min-h-[600px]">
        <TrendingPages limit={25} showSparklines={true} priority="high" />
      </div>

      {/* Additional Info */}
      <div className="mt-12 p-6 bg-muted/30 rounded-lg">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Icon name="Flame" size={20} className="text-orange-500" />
          About Trending Pages
        </h2>
        <div className="space-y-2 text-muted-foreground">
          <p>
            Trending pages are ranked based on recent activity, views, and engagement.
            The algorithm considers both total views and recent momentum to surface content that's gaining traction.
          </p>
          <p>
            Pages with higher view counts in the last 24 hours are prioritized, helping you discover
            what's currently popular and relevant in the WeWrite community.
          </p>
          <p>
            The sparkline charts show view trends over time, giving you insight into how each page's
            popularity has evolved recently.
          </p>
        </div>
      </div>
    </NavPageLayout>
  );
}
